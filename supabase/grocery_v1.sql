-- Guest grocery pre-stocking, v1 (Admin database). NOT YET RUN: review first, then run once in the
-- Supabase SQL editor. Nothing in the app reads or writes these tables until Phase 2.
--
-- Nothing here sends, books or charges anything. Guest messages are drafts a partner approves one by
-- one; Instacart orders are placed by a partner; Airbnb money requests are sent by a partner.
--
-- The cleaner app (property-cleaner-hub, a separate Supabase project) holds the cleaner's phone and
-- confirmed times. See docs/grocery/cleaner-app-migration-proposal.sql.

-- ---------- Settings (one row) ----------

create table if not exists public.grocery_settings (
  id int primary key default 1 check (id = 1),
  stocking_fee_cents int not null default 1000 check (stocking_fee_cents >= 0),
  minimum_order_cents int not null default 3500 check (minimum_order_cents >= 0),
  offer_days_before int not null default 7 check (offer_days_before >= 0),
  no_offer_within_hours int not null default 72 check (no_offer_within_hours >= 0),
  -- Toronto minutes after midnight that the offer is queued for approval (540 = 9:00 AM).
  offer_queue_minutes int not null default 540 check (offer_queue_minutes between 0 and 1439),
  reminder_after_days int not null default 2 check (reminder_after_days >= 0),
  list_lock_hours_before_arrival int not null default 72 check (list_lock_hours_before_arrival >= 0),
  order_window_from_hours int not null default 48,
  order_window_to_hours int not null default 24,
  default_check_in_minutes int not null default 960 check (default_check_in_minutes between 0 and 1439),
  receipt_entry_hours int not null default 4,
  receipt_to_request_hours int not null default 4,
  escalate_open_request_hours int not null default 72,
  cleaner_times_alert_hours int not null default 72,
  -- Flat amount added to a clean's pay when the cleaner waited for a delivery. 0 until you set it.
  waited_for_delivery_cents int not null default 0 check (waited_for_delivery_cents >= 0),
  updated_at timestamptz not null default now()
);

insert into public.grocery_settings (id) values (1) on conflict (id) do nothing;

-- ---------- Message templates ----------
-- auto_send exists so offers and reminders CAN be automated per template after the trial. It defaults to
-- off and no code reads it in this phase: every message still waits for a partner to press approve.

create table if not exists public.grocery_templates (
  key text primary key check (key in ('offer', 'reminder', 'clarify', 'estimate', 'missing_items', 'receipt', 'payment_request')),
  body text not null default '',
  auto_send boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------- Catalogue ----------
-- Pack contents plus the 50 to 100 most requested items, each with a pre-chosen replacement.

create table if not exists public.grocery_catalog (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  -- Other words guests use for it, matched when reading their list.
  aliases text[] not null default '{}',
  category text not null default '',
  -- Which packs it belongs to (breakfast, essentials, snack). Packs are priced at cost, so they are quoted as estimates.
  packs text[] not null default '{}' check (packs <@ array['breakfast', 'essentials', 'snack']::text[]),
  -- Estimated unit price. The guest pays the receipt, never this.
  unit_cents bigint not null default 0 check (unit_cents >= 0),
  shelf_stable boolean not null default true,
  -- Known allergens: peanut, tree_nut, sesame, dairy, egg, fish, shellfish, soy, wheat, gluten, sulphites, mustard.
  allergens text[] not null default '{}',
  -- The replacement Instacart should use when this item is out of stock (non-allergy guests only).
  preset_replacement text not null default '',
  active boolean not null default true
);

create unique index if not exists grocery_catalog_name_idx on public.grocery_catalog (lower(name));

-- ---------- Orders ----------

create table if not exists public.grocery_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  property_id uuid not null references public.pm_properties (id) on delete restrict,
  hospitable_reservation_id text not null,
  booking_platform text not null default 'airbnb',
  guest_name text not null default '',

  status text not null default 'offered' check (status in (
    'offered', 'awaiting_reply', 'list_received', 'clarifying', 'awaiting_guest_approval', 'approved',
    'in_checkout_queue', 'placed', 'stocked', 'receipt_received', 'payment_requested', 'paid',
    'declined', 'expired', 'cancelled', 'unpaid_escalated'
  )),

  -- A split order is two orders for one reservation: the shelf-stable part (at the clean) and the fresh part (after check-in).
  part text not null default 'all' check (part in ('all', 'shelf', 'fresh')),
  delivery_to text not null default 'cleaner' check (delivery_to in ('cleaner', 'guest')),
  handoff text not null default 'house_door' check (handoff in ('house_door', 'condo_lobby')),

  -- {"state":"unset"} | {"state":"none",...} | {"state":"has","allergens":[],"other":[],...}. Silence is never "none".
  allergy jsonb not null default '{"state":"unset"}'::jsonb,

  -- The estimate the guest saw, and their own approval message, kept as our record.
  estimate_cents bigint not null default 0 check (estimate_cents >= 0),
  estimate_sent_at timestamptz null,
  estimate_hash text not null default '',
  approval jsonb null,

  arrival_at timestamptz not null,
  clean_start_at timestamptz null,
  -- The cleaner's confirmed planned arrival and departure (mirrored from the cleaner app).
  cleaner_window_start timestamptz null,
  cleaner_window_end timestamptz null,
  cleaner_name text not null default '',
  cleaner_phone text not null default '',
  -- The cleaner app's turnover (cleaning_tasks.id) this order belongs to.
  hub_task_id text not null default '',

  slot_start timestamptz null,
  slot_end timestamptz null,

  -- Partner checkout: replacements checked, leave-at-door off, all-Refund confirmed (allergy guests).
  checkout jsonb not null default '{"replacementsChecked":false,"leaveAtDoorOff":false,"allRefundConfirmed":false}'::jsonb,
  instacart_order_number text not null default '',
  placed_by text not null default '',
  placed_at timestamptz null,

  -- Cleaner: received tick, fridge and counter photos, missing items, waited-for-delivery.
  stocking jsonb not null default '{}'::jsonb,

  -- The exact Instacart receipt, line by line: groceries, service fee, delivery fee, tax, tip, any other line.
  receipt_lines jsonb not null default '[]'::jsonb,
  receipt_total_cents bigint not null default 0 check (receipt_total_cents >= 0),
  receipt_ref text not null default '',
  receipt_at timestamptz null,

  -- What was asked for: the receipt, plus the stocking fee only when a cleaner received and stocked it.
  stocking_fee_cents bigint not null default 0 check (stocking_fee_cents >= 0),
  payment_request_cents bigint not null default 0 check (payment_request_cents >= 0),
  payment_requested_at timestamptz null,
  payment_requested_by text not null default '',
  paid_at timestamptz null,

  cancelled_by text not null default '' check (cancelled_by in ('', 'guest', 'host', 'airbnb')),
  cancelled_after_placed boolean not null default false,
  owed_cents bigint not null default 0 check (owed_cents >= 0),

  -- Backstops. The app enforces all of these first; the database refuses even if the app has a bug.
  -- 1. Past the guest's approval, the allergy answer must be stored ("none" counts only when stated).
  constraint grocery_orders_allergy_answered check (
    status in ('offered', 'awaiting_reply', 'list_received', 'clarifying', 'declined', 'expired', 'cancelled')
    or allergy ->> 'state' in ('none', 'has')
  ),
  -- 2. An order is "approved" and beyond only with the guest's own stored approval.
  constraint grocery_orders_approval_stored check (
    status in ('offered', 'awaiting_reply', 'list_received', 'clarifying', 'awaiting_guest_approval', 'declined', 'expired', 'cancelled')
    or approval is not null
  ),
  -- 3. Placed and beyond means an Instacart order number was entered.
  constraint grocery_orders_order_number check (
    status not in ('placed', 'stocked', 'receipt_received', 'payment_requested', 'paid', 'unpaid_escalated')
    or instacart_order_number <> ''
  ),
  -- 4. A payment request needs a receipt (or a cancellation that owes).
  constraint grocery_orders_request_has_basis check (
    status not in ('payment_requested', 'paid', 'unpaid_escalated')
    or receipt_total_cents > 0 or owed_cents > 0
  ),
  constraint grocery_orders_slot_order check (slot_end is null or slot_start is null or slot_end > slot_start),
  constraint grocery_orders_window_order check (cleaner_window_end is null or cleaner_window_start is null or cleaner_window_end > cleaner_window_start)
);

-- One live order per reservation part. Declined, expired and cancelled orders don't block a new one.
create unique index if not exists grocery_orders_live_part_idx
  on public.grocery_orders (hospitable_reservation_id, part)
  where status not in ('declined', 'expired', 'cancelled');

create index if not exists grocery_orders_status_idx on public.grocery_orders (status);
create index if not exists grocery_orders_property_idx on public.grocery_orders (property_id);
create index if not exists grocery_orders_arrival_idx on public.grocery_orders (arrival_at);
create index if not exists grocery_orders_clean_idx on public.grocery_orders (clean_start_at);

-- ---------- Items ----------

create table if not exists public.grocery_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.grocery_orders (id) on delete cascade,
  position int not null default 0,
  name text not null,
  qty int not null default 1 check (qty > 0),
  unit_cents bigint not null default 0 check (unit_cents >= 0),
  catalog_id uuid null references public.grocery_catalog (id) on delete set null,
  in_catalogue boolean not null default false,
  allergens text[] not null default '{}',
  -- False for off-catalogue items: ingredients unknown, so a partner checks them for an allergy guest.
  tags_known boolean not null default false,
  shelf_stable boolean not null default true,
  source text not null default 'guest_list' check (source in ('guest_list', 'welcome_basket', 'pack')),
  preset_replacement text not null default '',
  -- refund = no replacement, preset = the catalogue replacement, best_match = Instacart's choice.
  rule text not null default 'refund' check (rule in ('refund', 'preset', 'best_match')),
  removed boolean not null default false,
  removed_reason text not null default '',
  partner_confirmed boolean not null default false,
  partner_confirmed_by text not null default '',
  -- Cleaner: '' (not yet), received, missing, damaged, set_aside (not on the list for an allergy guest).
  received_state text not null default '' check (received_state in ('', 'received', 'missing', 'damaged', 'set_aside')),
  expiry_date date null,
  note text not null default ''
);

create index if not exists grocery_order_items_order_idx on public.grocery_order_items (order_id, position);

-- ---------- Guest messages: drafts waiting for a partner ----------
-- Every guest message is queued here as a draft. Only a partner pressing approve moves it to approved_sent,
-- and that records who. Copilot never sends on its own.

create table if not exists public.grocery_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.grocery_orders (id) on delete cascade,
  kind text not null check (kind in ('offer', 'reminder', 'clarify', 'estimate', 'missing_items', 'receipt', 'payment_request')),
  body text not null default '',
  -- Problems found by the message check (links, contact details, placeholders): a message with any can't be approved.
  problems jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'approved_sent', 'discarded')),
  due_at timestamptz not null default now(),
  queued_at timestamptz not null default now(),
  approved_by text not null default '',
  approved_at timestamptz null,
  hospitable_message_ref text not null default '',
  constraint grocery_messages_approved_by_partner check (status <> 'approved_sent' or (approved_by <> '' and approved_at is not null)),
  constraint grocery_messages_clean_when_sent check (status <> 'approved_sent' or jsonb_array_length(problems) = 0)
);

create index if not exists grocery_messages_queue_idx on public.grocery_messages (status, due_at);

-- ---------- Audit trail (append only) ----------

create table if not exists public.grocery_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.grocery_orders (id) on delete cascade,
  at timestamptz not null default now(),
  who text not null default 'Copilot',
  kind text not null default 'status',
  from_status text not null default '',
  to_status text not null default '',
  detail jsonb not null default '{}'::jsonb
);

create index if not exists grocery_events_order_idx on public.grocery_events (order_id, at);

-- ---------- Alerts already raised (so each is raised once per order) ----------

create table if not exists public.grocery_alerts (
  key text primary key,
  order_id uuid not null references public.grocery_orders (id) on delete cascade,
  code text not null,
  raised_at timestamptz not null default now(),
  resolved_at timestamptz null
);

-- ---------- Books: two categories, kept apart from everything else ----------
-- Pass-through spend and the guest's reimbursement are recorded here, NOT in pm_manual_expenses (which feeds
-- owner statements) or pm_company_expenses, and never mixed with cleaner supply reimbursements.

create table if not exists public.grocery_ledger (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  order_id uuid not null references public.grocery_orders (id) on delete restrict,
  entry_date date not null,
  category text not null check (category in ('guest_groceries_passthrough', 'guest_grocery_reimbursement')),
  amount_cents bigint not null check (amount_cents >= 0),
  note text not null default ''
);

create index if not exists grocery_ledger_order_idx on public.grocery_ledger (order_id);
create index if not exists grocery_ledger_date_idx on public.grocery_ledger (entry_date);

comment on column public.grocery_ledger.category is
  'guest_groceries_passthrough = the card spend on Instacart; guest_grocery_reimbursement = what the guest paid back.';

-- Server-side only: no anon access (the app uses the service role, like the other admin tables).
alter table public.grocery_settings enable row level security;
alter table public.grocery_templates enable row level security;
alter table public.grocery_catalog enable row level security;
alter table public.grocery_orders enable row level security;
alter table public.grocery_order_items enable row level security;
alter table public.grocery_messages enable row level security;
alter table public.grocery_events enable row level security;
alter table public.grocery_alerts enable row level security;
alter table public.grocery_ledger enable row level security;
