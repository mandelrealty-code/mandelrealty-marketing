-- Ask MRG host-portal chat (one thread per owner login).
-- Run once in Supabase SQL Editor after portal_owner_v1.sql.

create table if not exists public.portal_ask_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  portal_user_id uuid not null references public.portal_users (id) on delete cascade,
  pm_client_id uuid not null references public.pm_clients (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null,
  billed boolean not null default false
);

create index if not exists portal_ask_messages_user_created_idx
  on public.portal_ask_messages (portal_user_id, created_at desc);

comment on table public.portal_ask_messages is
  'Ask MRG chat. billed=true means a Claude call was made for that assistant turn.';
