-- Allow logging Airbnb message rejections so drafts can learn safer wording.
-- Run after staff_portal_v3.sql.

alter table public.pm_outreach_outcomes
  drop constraint if exists pm_outreach_outcomes_outcome_check;

alter table public.pm_outreach_outcomes
  add constraint pm_outreach_outcomes_outcome_check
  check (
    outcome in (
      'interested',
      'soft',
      'not_interested',
      'no_reply',
      'airbnb_rejected'
    )
  );

comment on table public.pm_outreach_outcomes is
  'Host reply outcomes plus Airbnb message rejections. Fed into outreach drafts.';
