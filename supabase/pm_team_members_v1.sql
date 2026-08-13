-- OPS team members (assignee roster). Run in Supabase SQL editor.

create table if not exists public.pm_team_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  constraint pm_team_members_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists pm_team_members_name_unique_idx
  on public.pm_team_members (lower(trim(name)));

create index if not exists pm_team_members_name_idx
  on public.pm_team_members (name);

comment on table public.pm_team_members is
  'OPS assignee roster — simple names for task assignment';
