-- Per-lead AI override when global AI is off (test one chat safely).
-- Run in Supabase SQL Editor.

alter table public.leads
  add column if not exists ai_force_on boolean not null default false;

comment on column public.leads.ai_force_on is
  'When true, AI may text this lead even if crm_settings.ai_responses_enabled is false';
