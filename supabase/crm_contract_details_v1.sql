-- CRM contract details (plan / term / launch / benchmarks / blank flag).
-- Run in Supabase SQL editor. Do not auto-run from the app.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contract_plan_tier text,
  ADD COLUMN IF NOT EXISTS contract_term text,
  ADD COLUMN IF NOT EXISTS contract_launch_payment text,
  ADD COLUMN IF NOT EXISTS contract_benchmarks jsonb,
  ADD COLUMN IF NOT EXISTS contract_is_blank boolean DEFAULT false;

COMMENT ON COLUMN leads.contract_plan_tier IS
  'standard | full_service | aligned_growth | confidence_partner';
COMMENT ON COLUMN leads.contract_term IS
  '12 | 24';
COMMENT ON COLUMN leads.contract_launch_payment IS
  'A | B | C | D';
COMMENT ON COLUMN leads.contract_benchmarks IS
  '{ jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec } in dollars';
COMMENT ON COLUMN leads.contract_is_blank IS
  'true when sent as blank for review; false when filled and stamped';
