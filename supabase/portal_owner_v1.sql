-- Owner portal auth + contract templates + awaiting signature (Phase 1).
-- Run in Supabase SQL Editor after pm_clients_v1 / pm_earnings_contracts_v1.

create table if not exists public.portal_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pm_client_id uuid not null references public.pm_clients (id) on delete cascade,
  email text not null,
  slug text not null,
  password_hash text not null default '',
  must_change_password boolean not null default true,
  invite_token text not null default '',
  invited_at timestamptz null,
  last_login_at timestamptz null,
  first_name text not null default '',
  unique (slug),
  unique (pm_client_id)
);

create unique index if not exists portal_users_email_lower_idx
  on public.portal_users (lower(email));

create index if not exists portal_users_slug_idx on public.portal_users (slug);

create table if not exists public.pm_contract_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  label text not null,
  filename text not null default '',
  mime text not null default 'application/pdf',
  storage_path text not null default '',
  archived boolean not null default false
);

create index if not exists pm_contract_templates_active_idx
  on public.pm_contract_templates (archived, updated_at desc);

-- Expand contract statuses for portal signing
alter table public.pm_contracts drop constraint if exists pm_contracts_status_check;
alter table public.pm_contracts
  add constraint pm_contracts_status_check
  check (status in ('draft', 'awaiting_signature', 'signed', 'expired'));

alter table public.pm_contracts
  add column if not exists template_id uuid null references public.pm_contract_templates (id) on delete set null;

alter table public.pm_contracts
  add column if not exists signature_name text not null default '';

alter table public.pm_contracts
  add column if not exists signature_image_path text not null default '';

alter table public.pm_contracts
  add column if not exists signed_storage_path text not null default '';

alter table public.pm_contracts
  add column if not exists signed_at timestamptz null;

comment on table public.portal_users is 'Owner portal logins keyed by slug under /owner/{slug}';
comment on table public.pm_contract_templates is 'Reusable agreement PDFs for Send portal invite';
