-- Run in Supabase → SQL Editor after leads table exists.
-- SMS / WhatsApp follow-up queue for Meta + website leads.

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  sequence text not null
    check (sequence in ('hot_sms', 'nurture_sms')),
  step int not null check (step >= 1),
  channel text not null default 'sms'
    check (channel in ('sms', 'whatsapp')),
  body text not null,
  send_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  error text,
  provider_sid text,
  unique (lead_id, sequence, step)
);

create index if not exists lead_followups_due_idx
  on public.lead_followups (status, send_at)
  where status = 'pending';

create index if not exists lead_followups_lead_id_idx
  on public.lead_followups (lead_id);

alter table public.lead_followups enable row level security;
