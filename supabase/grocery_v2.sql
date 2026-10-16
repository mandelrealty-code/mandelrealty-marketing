-- Guest grocery pre-stocking, v2 (Admin database). NOT YET RUN: review first, then run once in the
-- Supabase SQL editor of the COPILOT/ADMIN project, AFTER grocery_v1.sql (which has already been run).
-- This file only ALTERs what v1 created, so it is safe to re-run. v1 is left exactly as it was.
--
-- What changed since v1:
--   1. Security: public (anon) and signed-in (authenticated) access is revoked on every grocery table, on top of RLS.
--   2. The minimum is the estimated ITEMS subtotal, $40 (configurable), so refunded items can't pull an order
--      under Instacart+'s $35 free-delivery threshold.
--   3. Guest cancels after the order is placed: cancel the Instacart order first. Nothing is owed if it cancels.
--      Money is requested only if Instacart can't cancel, only for the exact receipt, never the estimate.
--   4. Allergy guests: every item is confirmed against its Instacart listing before an order can be placed,
--      and every item is Refund (no replacements). Both are enforced by the database too.
--   5. A feature flag, OFF by default: nothing can be created until it is switched on, and then only for the trial properties.
--   6. A flagged thread (a message Copilot never sent) blocks drafting until a partner clears it.

-- ---------- 1. Security ----------
-- RLS stays on (v1 enabled it) with NO policies, so the app's service role is the only way in. Revoking the grants
-- as well means a mistake later (RLS switched off, or a permissive policy added) still doesn't open these tables to the
-- public anon key. They hold guest names and allergy information.

do $$
declare
  t text;
begin
  foreach t in array array[
    'grocery_settings', 'grocery_templates', 'grocery_catalog', 'grocery_orders', 'grocery_order_items',
    'grocery_messages', 'grocery_events', 'grocery_alerts', 'grocery_ledger'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on table public.%I from authenticated', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on sequence public.grocery_events_id_seq from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on sequence public.grocery_events_id_seq from authenticated;
  end if;
end $$;

-- ---------- 2. Settings: the $40 minimum and the feature flag ----------

alter table public.grocery_settings add column if not exists instacart_free_delivery_cents int not null default 3500 check (instacart_free_delivery_cents >= 0);
alter table public.grocery_settings alter column minimum_order_cents set default 4000;
update public.grocery_settings set minimum_order_cents = 4000 where id = 1 and minimum_order_cents = 3500;

-- The minimum may not sit below Instacart's own threshold.
alter table public.grocery_settings drop constraint if exists grocery_settings_minimum_above_threshold;
alter table public.grocery_settings add constraint grocery_settings_minimum_above_threshold check (minimum_order_cents >= instacart_free_delivery_cents);

-- Every grocery feature is behind this. Off by default. Only the trial properties are active.
alter table public.grocery_settings add column if not exists enabled boolean not null default false;
alter table public.grocery_settings add column if not exists trial_property_ids uuid[] not null default '{}';

-- ---------- 3. Cancellation: cancel the Instacart order first ----------
-- na = no cancellation after placing. pending = a partner must try to cancel it in Instacart (possible until the shopper
-- starts). cancelled = nothing is owed. cannot_cancel = wait for the receipt, then request exactly that.

alter table public.grocery_orders add column if not exists instacart_cancel text not null default 'na'
  check (instacart_cancel in ('na', 'pending', 'cancelled', 'cannot_cancel'));

-- Money is only ever requested on a receipt, never the estimate (replaces v1's looser rule).
alter table public.grocery_orders drop constraint if exists grocery_orders_request_has_basis;
alter table public.grocery_orders add constraint grocery_orders_request_has_basis check (
  status not in ('payment_requested', 'paid', 'unpaid_escalated') or receipt_total_cents > 0
);

-- An amount is owed after a cancellation only when Instacart couldn't cancel, and only on a receipt.
alter table public.grocery_orders drop constraint if exists grocery_orders_owed_only_after_refusal;
alter table public.grocery_orders add constraint grocery_orders_owed_only_after_refusal check (
  owed_cents = 0 or (instacart_cancel = 'cannot_cancel' and receipt_total_cents > 0)
);

alter table public.grocery_orders drop constraint if exists grocery_orders_instacart_cancel_state;
alter table public.grocery_orders add constraint grocery_orders_instacart_cancel_state check (
  instacart_cancel = 'na' or cancelled_after_placed
);

comment on column public.grocery_orders.instacart_cancel is
  'After a guest cancels a placed order. Requesting money on a cancelled Airbnb reservation is unconfirmed: a partner checks with Airbnb first.';

-- ---------- 4. Allergy guests: every item checked against its Instacart listing ----------

alter table public.grocery_order_items add column if not exists listing_checked boolean not null default false;
alter table public.grocery_order_items add column if not exists listing_checked_by text not null default '';
alter table public.grocery_order_items add column if not exists listing_checked_at timestamptz null;

alter table public.grocery_order_items drop constraint if exists grocery_order_items_listing_checked_by;
alter table public.grocery_order_items add constraint grocery_order_items_listing_checked_by check (
  not listing_checked or (listing_checked_by <> '' and listing_checked_at is not null)
);

-- For an allergy guest: from the guest's approval request onward every item is Refund (no replacements), and from
-- "placed" onward a partner has confirmed all-Refund and checked EVERY item against its Instacart listing.
create or replace function public.grocery_allergy_gate() returns trigger
language plpgsql as $$
begin
  if new.allergy ->> 'state' = 'has' then
    if new.status in ('awaiting_guest_approval', 'approved', 'in_checkout_queue', 'placed', 'stocked', 'receipt_received', 'payment_requested', 'paid') then
      if exists (select 1 from public.grocery_order_items i where i.order_id = new.id and not i.removed and i.rule <> 'refund') then
        raise exception 'For an allergy guest every item must be set to Refund (no replacements).';
      end if;
    end if;
    if new.status in ('placed', 'stocked', 'receipt_received', 'payment_requested', 'paid') then
      if coalesce(new.checkout ->> 'allRefundConfirmed', 'false') <> 'true' then
        raise exception 'A partner must confirm every item is set to Refund before this order is placed.';
      end if;
      if exists (select 1 from public.grocery_order_items i where i.order_id = new.id and not i.removed and not i.listing_checked) then
        raise exception 'Every item must be confirmed against its Instacart product listing before this order is placed.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists grocery_orders_allergy_gate on public.grocery_orders;
create trigger grocery_orders_allergy_gate
  before insert or update on public.grocery_orders
  for each row execute function public.grocery_allergy_gate();

-- ---------- 5. The feature flag, in the database too ----------
-- Nothing new can be created while the flag is off, or for a property outside the trial. Orders already in flight
-- can still be updated, so a partner can always cancel or finish one.

create or replace function public.grocery_require_flag() returns trigger
language plpgsql as $$
declare
  s record;
  prop uuid;
begin
  select enabled, trial_property_ids into s from public.grocery_settings where id = 1;
  if tg_table_name = 'grocery_orders' then
    prop := new.property_id;
  else
    select o.property_id into prop from public.grocery_orders o where o.id = new.order_id;
  end if;
  if not coalesce(s.enabled, false) then
    raise exception 'Grocery features are switched off.';
  end if;
  if prop is null or not (prop = any (coalesce(s.trial_property_ids, '{}'::uuid[]))) then
    raise exception 'This property is not in the grocery trial.';
  end if;
  return new;
end;
$$;

drop trigger if exists grocery_orders_require_flag on public.grocery_orders;
create trigger grocery_orders_require_flag
  before insert on public.grocery_orders
  for each row execute function public.grocery_require_flag();

-- ---------- 6. A gap in the thread: flag it, never draft over it ----------
-- A reply in the thread that Copilot never sent (probably a partner in the Airbnb app) flags the thread. Until a
-- partner clears the flag, no new draft is queued for it.

alter table public.grocery_orders add column if not exists thread_gap_flagged boolean not null default false;
alter table public.grocery_orders add column if not exists thread_gap_reason text not null default '';
alter table public.grocery_orders add column if not exists thread_gap_resolved_by text not null default '';
alter table public.grocery_orders add column if not exists thread_gap_resolved_at timestamptz null;

alter table public.grocery_orders drop constraint if exists grocery_orders_gap_resolution;
alter table public.grocery_orders add constraint grocery_orders_gap_resolution check (
  thread_gap_resolved_by = '' or thread_gap_resolved_at is not null
);

create or replace function public.grocery_messages_guard() returns trigger
language plpgsql as $$
declare
  gap boolean;
  resolved text;
begin
  select o.thread_gap_flagged, o.thread_gap_resolved_by into gap, resolved from public.grocery_orders o where o.id = new.order_id;
  if coalesce(gap, false) and coalesce(resolved, '') = '' then
    raise exception 'A partner must review this thread first. Nothing is drafted over it.';
  end if;
  return new;
end;
$$;

drop trigger if exists grocery_messages_guard on public.grocery_messages;
create trigger grocery_messages_guard
  before insert on public.grocery_messages
  for each row execute function public.grocery_messages_guard();

-- Drafts are also behind the flag.
drop trigger if exists grocery_messages_require_flag on public.grocery_messages;
create trigger grocery_messages_require_flag
  before insert on public.grocery_messages
  for each row execute function public.grocery_require_flag();

-- ---------- Check it worked (read only) ----------
-- Every grocery table should show rls_on = true and zero policies:
--   select c.relname, c.relrowsecurity as rls_on, (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relname like 'grocery\_%' and c.relkind = 'r' order by 1;
-- Nothing should be granted to anon or authenticated:
--   select table_name, grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name like 'grocery\_%' and grantee in ('anon', 'authenticated');
-- The flag should be off:
--   select enabled, trial_property_ids, minimum_order_cents, instacart_free_delivery_cents from public.grocery_settings;
