-- STR permit + 180-day calendar-year cap (Toronto / Brampton / Ottawa style).
-- Run after pm_clients_v1.sql

alter table public.pm_properties
  add column if not exists str_permit_number text not null default '';

alter table public.pm_properties
  add column if not exists str_permit_applied_on date;

alter table public.pm_properties
  add column if not exists str_permit_issued_on date;

alter table public.pm_properties
  add column if not exists str_day_cap integer not null default 180;

alter table public.pm_properties
  add column if not exists str_municipality text not null default '';

comment on column public.pm_properties.str_permit_number is
  'Municipal STR registration / permit number';
comment on column public.pm_properties.str_permit_applied_on is
  'Date the permit application was submitted';
comment on column public.pm_properties.str_permit_issued_on is
  'Date the permit became active; renewal is +1 year';
comment on column public.pm_properties.str_day_cap is
  'Max STR nights per calendar year (default 180; resets Jan 1)';
comment on column public.pm_properties.str_municipality is
  'Optional city label (Toronto, Brampton, Ottawa, …)';
