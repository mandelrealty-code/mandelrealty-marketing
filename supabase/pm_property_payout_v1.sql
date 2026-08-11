-- Per-property cleaning ownership + HST/cohost surcharge (run after pm_hospitable_v1).

alter table public.pm_properties
  add column if not exists cleaning_fee_keeper text not null default 'mrg'
    check (cleaning_fee_keeper in ('mrg', 'host'));

alter table public.pm_properties
  add column if not exists hst_bps int not null default 300
    check (hst_bps >= 0 and hst_bps <= 1000);

alter table public.pm_settings
  add column if not exists default_hst_bps int not null default 300
    check (default_hst_bps >= 0 and default_hst_bps <= 1000);

comment on column public.pm_properties.cleaning_fee_keeper is
  'mrg = MRG keeps cleaning fee and pays cleaners; host = host keeps cleaning and pays cleaners';

comment on column public.pm_properties.hst_bps is
  'Extra % of commission base (nightly − host fees) for HST / cohost, in basis points';
