-- HST billing mode: cohost surcharge vs monthly QuickBooks invoice on nightly.
-- Run after pm_property_payout_v1.sql

alter table public.pm_properties
  add column if not exists hst_mode text not null default 'cohost'
    check (hst_mode in ('cohost', 'invoice'));

-- Allow up to 20% (1300 bps = 13% Ontario HST on nightly invoice)
alter table public.pm_properties
  drop constraint if exists pm_properties_hst_bps_check;

alter table public.pm_properties
  add constraint pm_properties_hst_bps_check
  check (hst_bps >= 0 and hst_bps <= 2000);

alter table public.pm_settings
  drop constraint if exists pm_settings_default_hst_bps_check;

alter table public.pm_settings
  add constraint pm_settings_default_hst_bps_check
  check (default_hst_bps >= 0 and default_hst_bps <= 2000);

comment on column public.pm_properties.hst_mode is
  'cohost = % of commission base taken with management fee; invoice = % of nightly accommodation billed monthly (e.g. QuickBooks 13% HST)';
