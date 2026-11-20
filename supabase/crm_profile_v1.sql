-- Property profile fields on leads (CRM Details → Property profile).
-- Run in Supabase SQL Editor (admin project). Do not run from app deploy.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS property_place_id text,
  ADD COLUMN IF NOT EXISTS property_city text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS ownership text,
  ADD COLUMN IF NOT EXISTS airbnb_live boolean,
  ADD COLUMN IF NOT EXISTS permit_status text,
  ADD COLUMN IF NOT EXISTS furnished text,
  ADD COLUMN IF NOT EXISTS occupants text,
  ADD COLUMN IF NOT EXISTS occupant_notes text,
  ADD COLUMN IF NOT EXISTS str_rules_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS str_rules_city text;

comment on column public.leads.property_address is 'Sales-call property address (Places autocomplete). Separate from leads.address contact field.';
comment on column public.leads.property_city is 'City extracted from Places components for STR rules lookup.';
comment on column public.leads.ownership is 'owns | renting';
comment on column public.leads.furnished is 'yes | partially | no';
comment on column public.leads.occupants is 'vacant | tenants | family';
