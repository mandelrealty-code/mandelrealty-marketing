-- Business memory v1: durable facts the Copilot agent keeps across months.
-- Run once in the Copilot Supabase project (NOT the cleaner app's project). Safe to run again.
-- Nothing here sends mail or messages.

create table if not exists copilot_business_facts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  subject_key text not null unique,
  fact text not null,
  category text not null default 'other',
  source text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  previous_fact text not null default ''
);

create index if not exists copilot_business_facts_active_idx on copilot_business_facts (active, updated_at desc);

-- Row Level Security: server-only (service role bypasses it); no policies, so the public key can't read or write.
alter table public.copilot_business_facts enable row level security;
