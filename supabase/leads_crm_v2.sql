-- Run in Supabase → SQL Editor (after leads.sql)
-- Adds call notes workflow: next steps checklist + clearer pipeline statuses

-- Expand status pipeline
alter table public.leads drop constraint if exists leads_status_check;

update public.leads set status = 'call_done' where status = 'contacted';
update public.leads set status = 'won' where status = 'done';

alter table public.leads
  add constraint leads_status_check
  check (status in (
    'new',
    'qualified',
    'low_fit',
    'call_done',
    'needs_shane',
    'onboarding',
    'won',
    'skip'
  ));

-- Checklist of post-call next steps, e.g.
-- [{"id":"cohost","label":"Setup cohost access","done":false,"owner":"shane"}]
alter table public.leads
  add column if not exists next_actions jsonb not null default '[]'::jsonb;

-- Who needs to act next
alter table public.leads
  add column if not exists needs_from text not null default 'none'
  check (needs_from in ('none', 'shane', 'partner', 'client'));

alter table public.leads
  add column if not exists notes_updated_at timestamptz;
