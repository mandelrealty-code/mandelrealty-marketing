-- CRM caller selector + team member phone numbers.
-- Run in Supabase SQL editor. Do not run from deploy.

ALTER TABLE crm_settings
  ADD COLUMN IF NOT EXISTS active_caller_phone text
  DEFAULT '';

ALTER TABLE pm_team_members
  ADD COLUMN IF NOT EXISTS phone text
  DEFAULT '';

COMMENT ON COLUMN crm_settings.active_caller_phone IS
  'Number Twilio dials first on CRM Call. Empty = fall back to operator_callback_phone.';

COMMENT ON COLUMN pm_team_members.phone IS
  'Optional cell for CRM caller dropdown (E.164 or local format).';
