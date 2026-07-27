-- Run in Supabase → SQL Editor
-- Instant Form–style qualifiers on website leads

alter table public.leads
  add column if not exists listing_title text not null default '';

-- yes | no | unsure | null
alter table public.leads
  add column if not exists str_allowed text;

alter table public.leads drop constraint if exists leads_str_allowed_check;
alter table public.leads
  add constraint leads_str_allowed_check
  check (str_allowed is null or str_allowed in ('yes', 'no', 'unsure'));
