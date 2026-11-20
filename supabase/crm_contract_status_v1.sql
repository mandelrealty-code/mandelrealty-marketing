-- Allow CRM contract cancel: contract_status may be 'cancelled'.
-- Run in the Supabase SQL editor after onboarding_v4.sql.
-- Do not run automatically from the app.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_contract_status_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_contract_status_check
  CHECK (contract_status IS NULL OR contract_status IN ('signed', 'sent', 'not_sent', 'cancelled'));
