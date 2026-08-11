-- Click-to-call + AI call notes
-- Run in Supabase SQL Editor.

alter table public.crm_settings
  add column if not exists operator_callback_phone text not null default '';

comment on column public.crm_settings.operator_callback_phone is
  'E.164 phone Twilio dials first for CRM click-to-call (partner cell)';

create table if not exists public.lead_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  call_sid text,
  dial_call_sid text,
  operator_phone text not null default '',
  lead_phone text not null default '',
  status text not null default 'starting',
  recording_sid text,
  recording_url text,
  transcription_sid text,
  transcript text,
  summary text,
  error text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists lead_calls_lead_id_idx on public.lead_calls (lead_id);
create index if not exists lead_calls_call_sid_idx on public.lead_calls (call_sid);

alter table public.lead_calls enable row level security;
