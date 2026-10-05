-- Copilot jobs: work the site does on its own (the morning inbox).
-- Run once in the Supabase SQL editor, before deploying. Safe to run again.
-- Nothing here sends anything. Jobs only read and leave a report in Copilot.

create table if not exists copilot_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null,
  title text not null,
  chat_id uuid,
  settings jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz
);

-- One morning inbox, not two.
create unique index if not exists copilot_jobs_kind_idx on copilot_jobs (kind);

create table if not exists copilot_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references copilot_jobs(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  trigger text not null default 'schedule',
  result jsonb,
  error text not null default ''
);

create index if not exists copilot_runs_job_idx on copilot_runs (job_id, started_at desc);

-- "This needs you." Set only by a job report, never by a normal answer.
-- Existing chats stay null, so nothing lights up after this change.
alter table copilot_chats add column if not exists needs_you_at timestamptz;
