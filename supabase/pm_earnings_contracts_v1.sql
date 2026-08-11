-- Earnings cache + contracts (run after pm_hospitable_v1.sql).

create table if not exists public.pm_reservations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.pm_properties (id) on delete cascade,
  hospitable_reservation_id text not null,
  platform text not null default '',
  platform_id text not null default '',
  status text not null default '',
  check_in date null,
  check_out date null,
  nights int not null default 0,
  currency text not null default 'CAD',
  gross_cents bigint not null default 0,
  host_payout_cents bigint not null default 0,
  financials_json jsonb not null default '{}'::jsonb,
  raw_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (hospitable_reservation_id)
);

create index if not exists pm_reservations_property_checkout_idx
  on public.pm_reservations (property_id, check_out);

create table if not exists public.pm_manual_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id uuid not null references public.pm_properties (id) on delete cascade,
  expense_date date not null,
  category text not null default 'other'
    check (category in (
      'cleaning', 'supplies', 'maintenance', 'utilities', 'other'
    )),
  label text not null default '',
  amount_cents bigint not null check (amount_cents >= 0),
  note text not null default ''
);

create index if not exists pm_manual_expenses_property_date_idx
  on public.pm_manual_expenses (property_id, expense_date);

create table if not exists public.pm_contracts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid null references public.pm_clients (id) on delete cascade,
  property_id uuid null references public.pm_properties (id) on delete cascade,
  title text not null,
  filename text not null default '',
  mime text not null default 'application/pdf',
  storage_path text not null default '',
  signed_on date null,
  effective_from date null,
  effective_to date null,
  status text not null default 'signed'
    check (status in ('draft', 'signed', 'expired')),
  note text not null default '',
  check (client_id is not null or property_id is not null)
);

create index if not exists pm_contracts_client_idx on public.pm_contracts (client_id);
create index if not exists pm_contracts_property_idx on public.pm_contracts (property_id);

alter table public.pm_settings
  add column if not exists hospitable_last_sync_at timestamptz null;

-- Private storage for signed contracts (service role uploads).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pm-contracts',
  'pm-contracts',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
