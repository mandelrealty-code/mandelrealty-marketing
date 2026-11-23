-- Onboarding pipeline (OPS). Run in the Supabase SQL editor. Nothing here runs from the app.
-- Run order: after pm_team_members_v1.sql and pm_clients_v1.sql.
--
-- Staff types: the OPS assignee roster is pm_team_members (names, the same names pm_tasks.assignee uses; a staff login in
-- staff_users creates a roster row). It had no idea what kind of person each one is, so the type goes on the roster.
-- Onboarding follows the same convention as pm_tasks: an assignee is a roster NAME, not an id.

alter table public.pm_team_members
  add column if not exists staff_type text not null default '';

-- Recreate the check so re-runs and fresh DBs allow booker (Team invite + coordinator portal).
alter table public.pm_team_members
  drop constraint if exists pm_team_members_staff_type_check;
alter table public.pm_team_members
  add constraint pm_team_members_staff_type_check
  check (staff_type in ('', 'onboarder', 'va', 'software', 'booker', 'operations', 'partner'));

comment on column public.pm_team_members.staff_type is
  'What kind of team member this is: onboarder, va, software, booker, operations or partner. Empty until a partner sets it.';

-- ---------- One row per unit going through onboarding ----------

create table if not exists public.onboarding_units (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  address text not null,
  unit_type text not null default '',          -- for example "2BD Condo", "Studio"
  owner_name text not null default '',
  client_id uuid null references public.pm_clients (id) on delete set null,
  assignee text not null default '',           -- roster name, the person who owns the unit
  started_on date not null default current_date,
  live_on date null,                           -- set when the Live stage is done
  block_reason text not null default '',       -- why the unit is blocked, shown on the flag
  archived boolean not null default false,
  constraint onboarding_units_address_nonempty check (length(trim(address)) > 0)
);

create index if not exists onboarding_units_assignee_idx on public.onboarding_units (assignee);
create index if not exists onboarding_units_active_idx on public.onboarding_units (archived, started_on desc);

-- ---------- Where each unit is, stage by stage ----------
-- The seven stages are fixed: Audit, Furniture, Procurement, Install, App Setup, Software, Live.
-- Status: todo, active, submitted (waiting for approval), blocked, done.

create table if not exists public.onboarding_unit_stages (
  unit_id uuid not null references public.onboarding_units (id) on delete cascade,
  stage text not null
    check (stage in ('Audit', 'Furniture', 'Procurement', 'Install', 'App Setup', 'Software', 'Live')),
  position int not null check (position between 0 and 6),
  status text not null default 'todo'
    check (status in ('todo', 'active', 'submitted', 'blocked', 'done')),
  updated_at timestamptz not null default now(),
  primary key (unit_id, stage)
);

-- ---------- The checklist inside each stage ----------

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unit_id uuid not null references public.onboarding_units (id) on delete cascade,
  stage text not null
    check (stage in ('Audit', 'Furniture', 'Procurement', 'Install', 'App Setup', 'Software', 'Live')),
  label text not null,
  assignee text not null default '',           -- roster name
  due_on date null,
  done boolean not null default false,
  done_at timestamptz null,
  sort int not null default 0
);

create index if not exists onboarding_tasks_unit_idx on public.onboarding_tasks (unit_id, stage, sort);
create index if not exists onboarding_tasks_due_idx on public.onboarding_tasks (due_on) where done = false;

-- ---------- The weekly schedule (who is where, when) ----------

create table if not exists public.onboarding_schedule (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unit_id uuid not null references public.onboarding_units (id) on delete cascade,
  assignee text not null default '',           -- roster name
  stage text not null
    check (stage in ('Audit', 'Furniture', 'Procurement', 'Install', 'App Setup', 'Software', 'Live')),
  task text not null,
  start_on date not null,
  span_days int not null default 1 check (span_days between 1 and 14),
  start_time text not null default '',         -- for example "10:00 AM"
  status text not null default 'Scheduled'
    check (status in ('Scheduled', 'In progress', 'Done', 'Blocked'))
);

create index if not exists onboarding_schedule_start_idx on public.onboarding_schedule (start_on, assignee);

-- ---------- The default checklist for each stage ----------
-- Copied into onboarding_tasks when a unit is added to the pipeline. Edit these rows to change the standard checklist.
-- default_type is the staff type that usually does the task, so assignment can follow the roster's staff_type.
-- App Setup and Live have no standard tasks yet: add them here when you decide what they are.

create table if not exists public.onboarding_task_templates (
  id uuid primary key default gen_random_uuid(),
  stage text not null
    check (stage in ('Audit', 'Furniture', 'Procurement', 'Install', 'App Setup', 'Software', 'Live')),
  label text not null,
  default_type text not null default ''
    check (default_type in ('', 'onboarder', 'va', 'software', 'operations', 'partner')),
  sort int not null default 0,
  unique (stage, label)
);

insert into public.onboarding_task_templates (stage, label, default_type, sort) values
  ('Audit', 'Schedule walkthrough with owner', 'onboarder', 10),
  ('Audit', 'Book access with owner', 'onboarder', 20),
  ('Audit', 'Collect keys & building access', 'onboarder', 30),
  ('Audit', 'Walkthrough & condition photos', 'onboarder', 40),
  ('Audit', 'Room measurements', 'onboarder', 50),
  ('Audit', 'Inventory existing furniture', 'va', 60),
  ('Audit', 'Send audit summary to owner', 'onboarder', 70),
  ('Furniture', 'Style direction board', 'va', 10),
  ('Furniture', 'Furniture measurements', 'onboarder', 20),
  ('Furniture', 'Furniture report & shopping list', 'va', 30),
  ('Furniture', 'Owner budget approval', 'onboarder', 40),
  ('Procurement', 'Order furniture package', 'va', 10),
  ('Procurement', 'Order linens & kitchen kit', 'va', 20),
  ('Procurement', 'Order smart lock & noise sensor', 'software', 30),
  ('Procurement', 'Confirm delivery window', 'va', 40),
  ('Procurement', 'Book install crew', 'onboarder', 50),
  ('Install', 'Book freight elevator', 'onboarder', 10),
  ('Install', 'Furniture assembly', 'onboarder', 20),
  ('Install', 'Hang art & mirrors', 'onboarder', 30),
  ('Install', 'Turnover clean', 'va', 40),
  ('Software', 'Create listing in PMS', 'software', 10),
  ('Software', 'Connect smart lock', 'software', 20),
  ('Software', 'Pricing rules & minimum stay', 'software', 30),
  ('Software', 'Guest messaging templates', 'va', 40)
on conflict (stage, label) do nothing;

-- Row Level Security: server-only. The app reaches these tables with the service-role key, which bypasses RLS,
-- so there are deliberately NO policies: the public anon key and signed-in users can't read or write them.
alter table public.onboarding_units enable row level security;
alter table public.onboarding_unit_stages enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.onboarding_schedule enable row level security;
alter table public.onboarding_task_templates enable row level security;
