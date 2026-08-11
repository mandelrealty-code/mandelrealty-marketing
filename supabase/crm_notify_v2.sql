-- Named operator recipients for new-lead SMS alerts.
-- Run in Supabase SQL Editor (after crm_notify_v1.sql if needed).

alter table public.crm_settings
  add column if not exists lead_notify_recipients jsonb not null default '[]'::jsonb;

comment on column public.crm_settings.lead_notify_recipients is
  'JSON array of {id,name,phone,welcome_sent_at} for New MRG Lead SMS alerts';
