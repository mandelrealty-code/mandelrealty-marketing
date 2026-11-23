-- Allow staff_type = 'booker' on pm_team_members.
-- onboarding_v1.sql added staff_type with a CHECK that omitted booker, but Team → Invite
-- and the coordinator portal use booker as a first-class role. Without this, inviting a
-- Booker creates the staff_users login then fails before the invite email is sent.
--
-- Run in the admin Supabase SQL editor (project qyowojkufarzhcpsiram).

alter table public.pm_team_members
  add column if not exists staff_type text not null default '';

alter table public.pm_team_members
  drop constraint if exists pm_team_members_staff_type_check;

alter table public.pm_team_members
  add constraint pm_team_members_staff_type_check
  check (staff_type in ('', 'onboarder', 'va', 'software', 'booker', 'operations', 'partner'));

comment on column public.pm_team_members.staff_type is
  'What kind of team member this is: onboarder, va, software, booker, operations or partner. Empty until a partner sets it.';
