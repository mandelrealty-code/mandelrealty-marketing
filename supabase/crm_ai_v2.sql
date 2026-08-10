-- Run in Supabase → SQL Editor after crm_ai_v1.sql
-- Remove needs_shane, add nurturing stage + offer_path for AI closer routing.

alter table public.leads drop constraint if exists leads_status_check;

update public.leads set status = 'engaging' where status = 'needs_shane';

alter table public.leads
  add constraint leads_status_check
  check (status in (
    'new',
    'engaging',
    'nurturing',
    'interested',
    'booked',
    'call_done',
    'won',
    'low_fit',
    'skip'
  ));

alter table public.leads
  add column if not exists offer_path text not null default 'unknown';

alter table public.leads drop constraint if exists leads_offer_path_check;
alter table public.leads
  add constraint leads_offer_path_check
  check (offer_path in ('management', 'makeover', 'education', 'unknown'));
