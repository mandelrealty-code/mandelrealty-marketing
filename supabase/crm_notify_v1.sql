-- New-lead SMS alerts for operators (Settings in CRM).
-- Run in Supabase SQL Editor.

alter table public.crm_settings
  add column if not exists lead_notify_sms_enabled boolean not null default false;

alter table public.crm_settings
  add column if not exists lead_notify_phone text not null default '';

alter table public.crm_settings
  add column if not exists lead_notify_recipients jsonb not null default '[]'::jsonb;

comment on column public.crm_settings.lead_notify_sms_enabled is
  'When true, SMS operators on each new CRM lead';
comment on column public.crm_settings.lead_notify_phone is
  'Legacy comma-separated phones (kept in sync with lead_notify_recipients)';
comment on column public.crm_settings.lead_notify_recipients is
  'JSON array of {id,name,phone,welcome_sent_at} for New MRG Lead SMS alerts';
