-- First-SMS welcome message templates (CRM Settings → Welcome messages).
-- Run in Supabase SQL Editor (admin project). Do not run from app deploy.

alter table public.crm_settings
  add column if not exists welcome_message_templates jsonb not null default '[]'::jsonb;

comment on column public.crm_settings.welcome_message_templates is
  'JSON array of {id,name,trigger,message,is_default}. One row should have is_default true for unmatched lead sources. {name} is interpolated at send time.';
