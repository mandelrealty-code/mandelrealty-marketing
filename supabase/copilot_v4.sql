-- Copilot memory files. One row is one markdown file.
-- Run once in the Supabase SQL editor. Safe to run again.
-- Nothing here sends mail or messages.

create table if not exists copilot_memory_files (
  path text primary key,
  body text not null,
  origin text not null default 'you',
  updated_at timestamptz not null default now()
);

create table if not exists copilot_memory_claims (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  path text not null,
  quote text not null,
  message_id text not null default '',
  chat_id text not null default '',
  status text not null default 'active',
  supersedes_claim_id uuid
);

create index if not exists copilot_memory_claims_path_idx on copilot_memory_claims (path, created_at desc);

-- Row Level Security: server-only. The app reaches these tables with the service-role key, which bypasses RLS,
-- so there are deliberately NO policies: the public anon key and signed-in users can't read or write them.
alter table public.copilot_memory_files enable row level security;
alter table public.copilot_memory_claims enable row level security;
