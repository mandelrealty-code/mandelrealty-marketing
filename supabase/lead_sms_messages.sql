-- Run in Supabase → SQL Editor after leads table exists.
-- Full SMS thread (outbound + inbound replies) per lead.

create table if not exists public.lead_sms_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid references public.leads (id) on delete set null,
  direction text not null
    check (direction in ('inbound', 'outbound')),
  from_phone text not null default '',
  to_phone text not null default '',
  body text not null,
  provider_sid text,
  unique (provider_sid)
);

create index if not exists lead_sms_messages_lead_id_idx
  on public.lead_sms_messages (lead_id, created_at);

create index if not exists lead_sms_messages_from_phone_idx
  on public.lead_sms_messages (from_phone);

alter table public.lead_sms_messages enable row level security;
