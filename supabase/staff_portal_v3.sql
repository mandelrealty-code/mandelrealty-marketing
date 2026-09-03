-- Outreach learning: host reply outcomes for VA craft-message loop.
-- Run after staff_portal_v1.sql (and v2 if used).

create table if not exists public.pm_outreach_outcomes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  staff_user_id uuid not null references public.staff_users (id) on delete cascade,
  host_name text not null default '',
  neighborhood text not null default '',
  star_rating text not null default '',
  listing_url text not null default '',
  issues text[] not null default '{}',
  notes text not null default '',
  first_message text not null default '',
  follow_up_message text not null default '',
  thread_snippet text not null default '',
  outcome text not null
    check (outcome in ('interested', 'soft', 'not_interested', 'no_reply')),
  outcome_note text not null default ''
);

create index if not exists pm_outreach_outcomes_created_idx
  on public.pm_outreach_outcomes (created_at desc);

create index if not exists pm_outreach_outcomes_outcome_idx
  on public.pm_outreach_outcomes (outcome, created_at desc);

create index if not exists pm_outreach_outcomes_staff_idx
  on public.pm_outreach_outcomes (staff_user_id, created_at desc);

comment on table public.pm_outreach_outcomes is
  'VA-marked host interest outcomes. Fed into outreach AI prompts so drafts improve over time.';
