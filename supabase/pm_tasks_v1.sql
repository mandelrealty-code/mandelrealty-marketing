-- OPS Tasks (run in Supabase SQL editor).

create table if not exists public.pm_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  detail text not null default '',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'blocked', 'done')),
  priority text not null default 'normal'
    check (priority in ('normal', 'high')),
  assignee text not null default '',
  due_on date null,
  property_id uuid null references public.pm_properties (id) on delete set null,
  client_id uuid null references public.pm_clients (id) on delete set null,
  year_month text not null default '',
  task_type text not null default 'other'
    check (task_type in ('cleaning', 'maintenance', 'owner', 'compliance', 'statement', 'supplies', 'marketing', 'software', 'other')),
  created_by text not null default '',
  repeat_rule text not null default 'off'
    check (repeat_rule in ('off', 'weekly', 'monthly'))
);

create index if not exists pm_tasks_status_due_idx
  on public.pm_tasks (status, due_on);

create index if not exists pm_tasks_assignee_idx
  on public.pm_tasks (assignee);

create index if not exists pm_tasks_property_idx
  on public.pm_tasks (property_id);

comment on table public.pm_tasks is
  'OPS team tasks — cleaning, maintenance, owner, compliance, statement, supplies, marketing, software';
