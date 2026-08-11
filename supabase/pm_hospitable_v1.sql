-- Hospitable PAT for Clients import.
-- Safe to run alone, or after pm_clients_v1.sql.

create table if not exists public.pm_settings (
  id int primary key default 1 check (id = 1),
  default_commission_bps int not null default 1500
    check (default_commission_bps >= 0 and default_commission_bps <= 10000),
  updated_at timestamptz not null default now()
);

insert into public.pm_settings (id, default_commission_bps)
values (1, 1500)
on conflict (id) do nothing;

alter table public.pm_settings
  add column if not exists hospitable_pat text not null default '';

comment on column public.pm_settings.hospitable_pat is
  'Hospitable Personal Access Token (server-only; never expose full value to browser)';

-- Ensure core Clients tables exist if this file is run before pm_clients_v1.sql
create table if not exists public.pm_clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null default '',
  phone text not null default '',
  status text not null default 'active'
    check (status in ('active', 'paused')),
  lead_id uuid null references public.leads (id) on delete set null
);

create table if not exists public.pm_properties (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id uuid not null references public.pm_clients (id) on delete cascade,
  name text not null,
  address text not null default '',
  hospitable_property_id text not null default '',
  guidebook_property_id text not null default '',
  hub_property_id text not null default '',
  currency text not null default 'CAD',
  active boolean not null default true
);

create table if not exists public.pm_commission_terms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id uuid not null references public.pm_properties (id) on delete cascade,
  rate_bps int not null check (rate_bps >= 0 and rate_bps <= 10000),
  effective_from date not null,
  effective_to date null,
  note text not null default '',
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists pm_clients_status_idx on public.pm_clients (status);
create index if not exists pm_clients_name_idx on public.pm_clients (lower(name));
create index if not exists pm_properties_client_idx on public.pm_properties (client_id);
create index if not exists pm_properties_hospitable_idx
  on public.pm_properties (hospitable_property_id)
  where hospitable_property_id <> '';
create index if not exists pm_commission_property_idx
  on public.pm_commission_terms (property_id, effective_from desc);

create unique index if not exists pm_properties_hospitable_unique
  on public.pm_properties (hospitable_property_id)
  where hospitable_property_id <> '';
