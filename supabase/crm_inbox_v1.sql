-- CRM inbox: track when a lead's SMS thread was last opened (unread dots).
-- Run in Supabase SQL Editor.

alter table public.leads
  add column if not exists sms_last_read_at timestamptz;

comment on column public.leads.sms_last_read_at is
  'When CRM last opened this lead SMS thread; inbound after this = unread';
