-- OPS Tasks v2: one task record for the board, Copilot's reminders, Copilot-created tasks and the
-- team calendar (run in the Supabase SQL editor once). Existing tasks keep their data.
-- Status values stay: open = To do, in_progress = Doing, blocked = Waiting, done = Done.
-- Priority values stay: normal = Normal, high = Arrival-blocking.

alter table public.pm_tasks add column if not exists due_at timestamptz null;
alter table public.pm_tasks add column if not exists waiting_on text not null default '';
alter table public.pm_tasks add column if not exists unit_label text not null default '';
alter table public.pm_tasks add column if not exists link jsonb not null default '{}'::jsonb;
alter table public.pm_tasks add column if not exists source jsonb not null default '{}'::jsonb;
alter table public.pm_tasks add column if not exists source_key text not null default '';
alter table public.pm_tasks add column if not exists calendar jsonb not null default '{}'::jsonb;
alter table public.pm_tasks add column if not exists activity jsonb not null default '[]'::jsonb;
alter table public.pm_tasks add column if not exists done_by text not null default '';
alter table public.pm_tasks add column if not exists done_at timestamptz null;
alter table public.pm_tasks add column if not exists closed_by text not null default '';
alter table public.pm_tasks add column if not exists snooze_count integer not null default 0;
alter table public.pm_tasks add column if not exists deleted_at timestamptz null;
alter table public.pm_tasks add column if not exists extra jsonb not null default '{}'::jsonb;

-- One task per source item, ever: Copilot never makes a second task for the same follow-up,
-- turnover, contract or unit, even after the first is done.
create unique index if not exists pm_tasks_source_key_idx
  on public.pm_tasks (source_key)
  where source_key <> '';

-- Calendar-born tasks are found by their event.
create index if not exists pm_tasks_calendar_event_idx
  on public.pm_tasks ((calendar ->> 'eventId'));

create index if not exists pm_tasks_due_at_idx
  on public.pm_tasks (due_at);

comment on column public.pm_tasks.due_at is 'Due time; null with due_on set means a date-only or all-day task.';
comment on column public.pm_tasks.activity is 'Activity trail: [{at, who, text}], oldest first.';
