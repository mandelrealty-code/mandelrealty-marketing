-- Onboarding v4: the entry flow. A unit links to the CRM lead it came from, and a lead carries the sale details
-- (plan, who booked and closed it, contract status) plus a link back to its unit.
-- Run in the Supabase SQL editor after onboarding_v3.sql. Nothing here runs from the app.

-- Where a unit came from
ALTER TABLE onboarding_units
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS booked_by text,
  ADD COLUMN IF NOT EXISTS closed_by text,
  ADD COLUMN IF NOT EXISTS onboarding_fee_reason text;

-- One live unit per lead: a lead already in onboarding cannot be started twice.
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_units_lead_live_idx
  ON onboarding_units (lead_id)
  WHERE lead_id IS NOT NULL AND archived = false;

-- Sale details on the CRM lead, and the link to its unit
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS booked_by text,
  ADD COLUMN IF NOT EXISTS closed_by text,
  ADD COLUMN IF NOT EXISTS contract_status text,
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS onboarding_unit_id uuid REFERENCES onboarding_units(id) ON DELETE SET NULL;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_contract_status_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_contract_status_check
  CHECK (contract_status IS NULL OR contract_status IN ('signed', 'sent', 'not_sent', 'cancelled'));
-- If v4 already ran without cancelled, also run crm_contract_status_v1.sql.

-- The onboarding fee can be charged, waived (with a reason) or still to be confirmed.
ALTER TABLE onboarding_units DROP CONSTRAINT IF EXISTS onboarding_units_fee_status_check;
ALTER TABLE onboarding_units
  ADD CONSTRAINT onboarding_units_fee_status_check
  CHECK (onboarding_fee_status IS NULL OR onboarding_fee_status IN ('charged', 'waived', 'tbc'));
