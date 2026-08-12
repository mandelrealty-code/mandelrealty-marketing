-- Toronto MAT quarterly filing tracking (owner files; MRG reminds).
-- Run after pm_str_compliance_v1.sql

alter table public.pm_properties
  add column if not exists mat_required boolean not null default false;

comment on column public.pm_properties.mat_required is
  'When true, track City of Toronto MAT quarterly filings for this unit';

create table if not exists public.pm_mat_filings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.pm_properties (id) on delete cascade,
  year integer not null,
  quarter integer not null check (quarter between 1 and 4),
  /** due | filed — overdue is derived on read when due_on < today and not filed */
  status text not null default 'due',
  filed_on date,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (property_id, year, quarter)
);

create index if not exists pm_mat_filings_property_idx
  on public.pm_mat_filings (property_id, year desc, quarter desc);

comment on table public.pm_mat_filings is
  'Toronto MAT quarterly filing status per property (owner files; nil returns required)';
