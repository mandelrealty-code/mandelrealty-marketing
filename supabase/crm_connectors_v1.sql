-- PriceLabs API key storage for OPS Settings → Connectors.
-- Run in Supabase SQL Editor (admin project). Do not run from app deploy.

alter table public.crm_settings
  add column if not exists pricelabs_api_key text;

comment on column public.crm_settings.pricelabs_api_key is
  'Optional PriceLabs API key saved from OPS Settings → Connectors. Env PRICELABS_API_KEY still wins when set.';
