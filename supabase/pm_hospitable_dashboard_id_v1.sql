-- Optional Hospitable dashboard numeric id (my.hospitable.com/properties/property/{id}/…).
-- Apps/API/MCP still use hospitable_property_id (UUID).

alter table public.pm_properties
  add column if not exists hospitable_dashboard_id text not null default '';

comment on column public.pm_properties.hospitable_dashboard_id is
  'Numeric id for Hospitable web dashboard deep links only. Not used by API/MCP.';
