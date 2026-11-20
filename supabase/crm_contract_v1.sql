-- CRM → contract send: link a lead to the OPS client and the latest agreement.
-- Run in the Supabase SQL editor after portal_owner_v1.sql / pm_earnings_contracts_v1.sql.
-- Do not run automatically from the app.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS contract_id text;

COMMENT ON COLUMN leads.client_id IS
  'pm_clients.id — set when first contract is sent';
COMMENT ON COLUMN leads.contract_id IS
  'pm_contracts.id — most recent contract sent';
