-- Run once in Supabase → SQL Editor
-- Project: mandelrealty marketing leads inbox
-- Then also run leads_crm_v2.sql if this file was applied before v2 fields existed.

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
  -- Qualifiers (collected on Instant Form + website funnel)
  property_stage text,
  permit_status text,
  launch_timeline text,
  listing_title text not null default '',
  str_allowed text
    check (str_allowed is null or str_allowed in ('yes', 'no', 'unsure')),
  -- Inbox workflow
  status text not null default 'new'
    check (status in (
      'new',
      'engaging',
      'interested',
      'booked',
      'call_done',
      'needs_shane',
      'won',
      'low_fit',
      'skip'
    )),
  notes text default '',
  whats_next text not null default '',
  next_actions jsonb not null default '[]'::jsonb,
  needs_from text not null default 'none'
    check (needs_from in ('none', 'shane', 'partner', 'client')),
  notes_updated_at timestamptz,
  qualified_at timestamptz,
  ai_paused boolean not null default false
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_call_start_iso_idx on public.leads (call_start_iso);
create index if not exists leads_status_idx on public.leads (status);

-- Service role only (no anon access)
alter table public.leads enable row level security;
