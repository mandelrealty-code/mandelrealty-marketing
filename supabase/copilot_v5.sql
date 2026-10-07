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
