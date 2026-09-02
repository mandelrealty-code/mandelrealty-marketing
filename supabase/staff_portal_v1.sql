-- Employee / VA portal auth + time entries (run in Supabase SQL editor).
-- Independent of portal_users (hosts). Assignees on pm_tasks match display_name.

create table if not exists public.staff_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null,
  slug text not null,
  display_name text not null,
  first_name text not null default '',
  password_hash text not null default '',
  must_change_password boolean not null default true,
  invite_token text not null default '',
  invited_at timestamptz null,
  last_login_at timestamptz null,
  active boolean not null default true
);

create unique index if not exists staff_users_slug_idx
  on public.staff_users (slug);

create unique index if not exists staff_users_email_lower_idx
  on public.staff_users (lower(email));

create unique index if not exists staff_users_display_name_lower_idx
  on public.staff_users (lower(trim(display_name)));

create index if not exists staff_users_active_idx
  on public.staff_users (active);

comment on table public.staff_users is
  'Employee / VA portal logins keyed by slug under /team/{slug}. display_name matches pm_tasks.assignee.';

create table if not exists public.pm_time_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  staff_user_id uuid not null references public.staff_users (id) on delete cascade,
  work_date date not null,
  hours numeric(6, 2) not null
    check (hours > 0 and hours <= 24),
  note text not null default '',
  task_id uuid null references public.pm_tasks (id) on delete set null
);

create index if not exists pm_time_entries_staff_date_idx
  on public.pm_time_entries (staff_user_id, work_date desc);

create index if not exists pm_time_entries_work_date_idx
  on public.pm_time_entries (work_date desc);

comment on table public.pm_time_entries is
  'Manual timesheet entries from the employee portal.';
