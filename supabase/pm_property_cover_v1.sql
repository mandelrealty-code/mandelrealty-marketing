-- Property cover / hero photo for owner statements and host portal.
-- Run after pm_clients_v1.sql (pm_properties exists).
-- Uses existing pm-contracts storage bucket (images already allowed).

alter table public.pm_properties
  add column if not exists cover_image_path text not null default '';

alter table public.pm_properties
  add column if not exists cover_image_filename text not null default '';

alter table public.pm_properties
  add column if not exists cover_image_mime text not null default '';

comment on column public.pm_properties.cover_image_path is
  'Supabase storage path in pm-contracts bucket (property-covers/…)';
