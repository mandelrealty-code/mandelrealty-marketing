-- Open items and unattended-check memory.
-- Run once in the Supabase SQL editor. Safe to run again.
-- Nothing here sends mail or messages.

create table if not exists copilot_open_items (
  id text primary key,
  statement text not null,
  verified_on text not null,
  status text not null,
  source text not null default '',
  asked_on text not null default ''
);

create table if not exists copilot_check_state (
  kind text not null,
  key text not null,
  primary key (kind, key)
);

-- Row Level Security: server-only. The app reaches these tables with the service-role key, which bypasses RLS,
-- so there are deliberately NO policies: the public anon key and signed-in users can't read or write them.
alter table public.copilot_open_items enable row level security;
alter table public.copilot_check_state enable row level security;
