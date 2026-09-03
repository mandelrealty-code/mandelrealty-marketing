-- Time entries: start/end timestamps (run after staff_portal_v1.sql).

alter table public.pm_time_entries
  add column if not exists started_at timestamptz null;

alter table public.pm_time_entries
  add column if not exists ended_at timestamptz null;

-- Allow shifts longer than a calendar day (overnight) up to 48h.
alter table public.pm_time_entries drop constraint if exists pm_time_entries_hours_check;
alter table public.pm_time_entries
  add constraint pm_time_entries_hours_check
  check (hours > 0 and hours <= 48);

comment on column public.pm_time_entries.started_at is
  'When the employee started this work block (timezone-aware).';
comment on column public.pm_time_entries.ended_at is
  'When the employee ended this work block (timezone-aware).';
