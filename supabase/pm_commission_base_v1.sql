-- Commission base is per-property: some hosts are billed on room fee (nightly),
-- others on nightly minus Airbnb host service fee (cohost-style).
-- Run after pm_property_payout_v2.sql

alter table public.pm_properties
  add column if not exists commission_base_mode text not null default 'nightly_minus_host_fee'
    check (commission_base_mode in ('nightly', 'nightly_minus_host_fee'));

comment on column public.pm_properties.commission_base_mode is
  'nightly = room fee × commission % (bill gross bookings); nightly_minus_host_fee = (room fee − Airbnb host fee) × commission %';

comment on column public.pm_properties.hst_mode is
  'cohost = HST % added into take on commission base; invoice = HST % of MRG fee billed monthly (e.g. QuickBooks)';
