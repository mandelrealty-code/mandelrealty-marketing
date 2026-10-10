-- Client marker and live/onboarding stage.
-- Contacts and owners stay in pm_clients and are not listed as clients.
-- Run after pm_clients_v1.sql.

alter table public.pm_clients
  add column if not exists kind text not null default 'owner';

alter table public.pm_clients
  drop constraint if exists pm_clients_kind_check;

alter table public.pm_clients
  add constraint pm_clients_kind_check
  check (kind in ('client', 'contact', 'owner'));

alter table public.pm_clients
  add column if not exists stage text not null default 'live';

alter table public.pm_clients
  drop constraint if exists pm_clients_stage_check;

alter table public.pm_clients
  add constraint pm_clients_stage_check
  check (stage in ('live', 'onboarding'));

update public.pm_clients
set kind = 'client', stage = 'live'
where lower(trim(name)) in (
  'khamraj shewnarain',
  'nance ta',
  'roya ardakani',
  'precilla daniel'
);

update public.pm_clients
set kind = 'contact'
where lower(trim(name)) in ('luba', 'abid', 'ana', 'elizabeth ong')
   or lower(trim(name)) like 'luba %'
   or lower(trim(name)) like 'abid %'
   or lower(trim(name)) like 'ana %'
   or lower(trim(name)) like 'elizabeth ong%';

comment on column public.pm_clients.kind is 'client, contact, or owner. Only client is a client.';
comment on column public.pm_clients.stage is 'live or onboarding. Onboarding clients are a separate group.';
