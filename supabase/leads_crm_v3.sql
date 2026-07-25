-- Run in Supabase → SQL Editor
alter table public.leads
  add column if not exists whats_next text not null default '';
