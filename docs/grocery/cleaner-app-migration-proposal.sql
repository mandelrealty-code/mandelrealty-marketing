-- PROPOSAL for the cleaner app (property-cleaner-hub / Stravo, project hyndmdjvjlsbthlqrxge).
-- NOT RUN and NOT in that repo yet. It lives here so it can be reviewed with the Admin migration
-- (supabase/grocery_v1.sql). When approved it becomes a new file in property-cleaner-hub/supabase/migrations/.
--
-- Covers: the cleaner's phone, the cleaner's confirmed planned times, the grocery delivery on a turnover,
-- and the flat "waited for delivery" pay add-on. Table and column names for existing objects
-- (cleaners, cleaning_tasks) come from the Admin-side read of the cleaner app's types; check against the
-- live schema before running, because the generated types file there may lag its migrations.

-- 1. A phone on every cleaner (required for any cleaner assigned to a grocery turnover; enforced below).
alter table public.cleaners add column if not exists phone text not null default '';

-- 2. The cleaner confirms when they will arrive and leave. The delivery slot is chosen inside this window.
alter table public.cleaning_tasks add column if not exists planned_arrival_at timestamptz null;
alter table public.cleaning_tasks add column if not exists planned_departure_at timestamptz null;
alter table public.cleaning_tasks add column if not exists times_confirmed_at timestamptz null;
alter table public.cleaning_tasks add column if not exists times_confirmed_by uuid null;
alter table public.cleaning_tasks add column if not exists grocery_wait_pay_cents integer not null default 0 check (grocery_wait_pay_cents >= 0);

alter table public.cleaning_tasks drop constraint if exists cleaning_tasks_planned_times_order;
alter table public.cleaning_tasks add constraint cleaning_tasks_planned_times_order
  check (planned_arrival_at is null or planned_departure_at is null or planned_departure_at > planned_arrival_at);

-- 3. The grocery delivery shown to the cleaner on the turnover (the "Groceries" section).
create table if not exists public.grocery_deliveries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cleaning_task_id uuid not null references public.cleaning_tasks (id) on delete cascade,
  -- The Admin database's grocery_orders.id. The two databases are linked only by this id.
  admin_order_id uuid not null unique,
  handoff text not null default 'house_door' check (handoff in ('house_door', 'condo_lobby')),
  -- Shown in large text at the top. 'none' only when the guest stated it; 'unknown' never reaches a cleaner.
  allergy_state text not null check (allergy_state in ('none', 'has')),
  allergy_text text not null default '',
  delivery_start timestamptz null,
  delivery_end timestamptz null,
  instructions text not null default '',
  -- [{name, qty, expiry_hint, state: '' | received | missing | damaged | set_aside}]
  items jsonb not null default '[]'::jsonb,
  received_at timestamptz null,
  -- The cleaner waited for the delivery: adds grocery_wait_pay_cents to this clean's pay.
  waited_for_delivery boolean not null default false,
  fridge_photo_url text not null default '',
  counter_photo_url text not null default '',
  note text not null default '',
  constraint grocery_deliveries_photos_when_received check (
    received_at is null or (fridge_photo_url <> '' and counter_photo_url <> '')
  )
);

create index if not exists grocery_deliveries_task_idx on public.grocery_deliveries (cleaning_task_id);

-- 4. A cleaner without a phone number cannot be assigned to a turnover that has a grocery delivery,
--    and a delivery cannot be added to a turnover whose cleaner has no phone.
create or replace function public.require_cleaner_phone_for_grocery() returns trigger
language plpgsql as $$
declare
  has_delivery boolean;
  phone text;
begin
  if tg_table_name = 'cleaning_tasks' then
    select exists (select 1 from public.grocery_deliveries g where g.cleaning_task_id = new.id) into has_delivery;
    if has_delivery and new.cleaner_id is not null then
      select c.phone into phone from public.cleaners c where c.id = new.cleaner_id;
      if coalesce(trim(phone), '') = '' then
        raise exception 'This cleaner has no phone number. A phone is required for a turnover with a grocery delivery.';
      end if;
    end if;
  else
    select c.phone into phone
      from public.cleaning_tasks t join public.cleaners c on c.id = t.cleaner_id
      where t.id = new.cleaning_task_id;
    if found and coalesce(trim(phone), '') = '' then
      raise exception 'The assigned cleaner has no phone number. A phone is required for a grocery delivery.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cleaning_tasks_require_phone_for_grocery on public.cleaning_tasks;
create trigger cleaning_tasks_require_phone_for_grocery
  before update of cleaner_id on public.cleaning_tasks
  for each row execute function public.require_cleaner_phone_for_grocery();

drop trigger if exists grocery_deliveries_require_phone on public.grocery_deliveries;
create trigger grocery_deliveries_require_phone
  before insert on public.grocery_deliveries
  for each row execute function public.require_cleaner_phone_for_grocery();

-- 5. Not in this migration (separate edge function and app work, Phase 4):
--    * ops-hub-sync actions: create/update a delivery from an Admin order; read back confirmed times,
--      received tick, photos, missing items; refuse to assign a cleaner with no phone.
--    * The cleaner UI: confirm planned arrival/departure; the Groceries section on the turnover.
--    * Adding grocery_wait_pay_cents to the cleaner's invoice lines (create_invoice).
--    * RLS policies matching the other cleaning_tasks tables (cleaner reads/updates only their own).
alter table public.grocery_deliveries enable row level security;
