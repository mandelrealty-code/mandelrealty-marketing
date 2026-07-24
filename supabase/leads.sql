-- Run once in Supabase → SQL Editor
-- Project: mandelrealty marketing leads inbox

create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null,
  address text default '',
  earnings text default '',
  has_listing text not null default 'unknown'
    check (has_listing in ('yes', 'no', 'unknown')),
  call_start_iso timestamptz,
  call_booking text default '',
  source text default '',
  marketing_opt_in boolean not null default false,
  -- Post-book qualifier (mainly for no-listing leads)
  property_stage text,
  permit_status text,
  launch_timeline text,
  -- Inbox workflow
  status text not null default 'new'
    check (status in ('new', 'qualified', 'low_fit', 'contacted', 'done', 'skip')),
  notes text default '',
  qualified_at timestamptz
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_call_start_iso_idx on public.leads (call_start_iso);
create index if not exists leads_status_idx on public.leads (status);

-- Service role only (no anon access)
alter table public.leads enable row level security;
