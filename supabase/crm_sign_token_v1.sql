-- Magic signing link for CRM-sent contracts (no portal login).
-- Run in the Supabase SQL editor after crm_contract_v1.sql.
-- Do not run automatically from the app.

ALTER TABLE pm_contracts
  ADD COLUMN IF NOT EXISTS sign_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS sign_token_used_at timestamptz;

COMMENT ON COLUMN pm_contracts.sign_token IS
  'One-time token for /sign?token=… magic link (CRM sends only)';
COMMENT ON COLUMN pm_contracts.sign_token_used_at IS
  'When the magic link was used to sign; null while still open';
