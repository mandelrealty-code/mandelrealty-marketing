-- New-lead SMS alerts for operators (Settings in CRM).
-- Run in Supabase SQL Editor.

alter table public.crm_settings
  add column if not exists lead_notify_sms_enabled boolean not null default false;

alter table public.crm_settings
  add column if not exists lead_notify_phone text not null default '';

comment on column public.crm_settings.lead_notify_sms_enabled is
  'When true, SMS operators on each new CRM lead';
comment on column public.crm_settings.lead_notify_phone is
  'E.164 or CA/US phone to receive New MRG Lead alerts (comma-separated ok)';
