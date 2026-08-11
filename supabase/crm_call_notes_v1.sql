-- Dedicated call notes (Claude call summary) separate from general notes + what's next.
-- Run once in Supabase SQL Editor.

alter table public.leads
  add column if not exists call_notes text not null default '';

comment on column public.leads.call_notes is
  'AI/human call summaries from CRM click-to-call (separate from general notes)';

comment on column public.leads.whats_next is
  'Team next steps to move the lead toward becoming a client';
