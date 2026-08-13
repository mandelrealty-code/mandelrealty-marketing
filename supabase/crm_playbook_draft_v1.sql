-- CRM Phase 3: per-lead Draft vs Autopilot + next-steps playbook + SMS review queue.
-- Run in Supabase SQL Editor.

alter table public.leads
  add column if not exists ai_send_mode text not null default 'autopilot';

alter table public.leads
  drop constraint if exists leads_ai_send_mode_check;

alter table public.leads
  add constraint leads_ai_send_mode_check
  check (ai_send_mode in ('draft', 'autopilot'));

alter table public.leads
  add column if not exists playbook_steps jsonb not null default '[]'::jsonb;

create table if not exists public.sms_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  body text not null,
  step_title text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'discarded'))
);

create unique index if not exists sms_drafts_one_pending
  on public.sms_drafts (lead_id)
  where status = 'pending';

create index if not exists sms_drafts_lead_idx
  on public.sms_drafts (lead_id, created_at desc);

comment on column public.leads.ai_send_mode is 'draft = queue SMS for approve; autopilot = send immediately';
comment on column public.leads.playbook_steps is 'Ordered next-step checklist [{id,title,status}]';
comment on table public.sms_drafts is 'AI SMS waiting for operator approve / edit / send';
