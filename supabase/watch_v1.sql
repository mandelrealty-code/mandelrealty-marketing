-- Watch loop ledger: every item the agent surfaced (or saw the Overview already shows), once, with how it ended.
-- Run once in the Copilot Supabase project (NOT the cleaner app's project). Safe to run again.
-- Nothing here sends mail or messages.

create table if not exists copilot_watch_items (
  key text primary key,
  kind text not null,
  title text not null,
  property text not null default '',
  chat_id text not null default '',
  status text not null default 'surfaced',
  surfaced_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists copilot_watch_items_status_idx on copilot_watch_items (status, surfaced_at desc);

-- Row Level Security: server-only (service role bypasses it); no policies, so the public key can't read or write.
alter table public.copilot_watch_items enable row level security;
