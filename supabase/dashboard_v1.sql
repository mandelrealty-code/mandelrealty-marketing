-- Partner dashboard actions (notification cards). Run in Supabase SQL editor.
-- Do not auto-run from the app. Requires partners and leads tables.

CREATE TABLE IF NOT EXISTS dashboard_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  -- 'contract_signed' | 'awaiting_signature' |
  -- 'onboarding_milestone' | 'follow_up'
  partner_id uuid REFERENCES partners(id),
  -- null = visible to both partners
  lead_id uuid REFERENCES leads(id)
    ON DELETE CASCADE,
  unit_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  dismissed_at timestamptz,
  actioned_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  dashboard_actions_partner_idx
  ON dashboard_actions(partner_id, dismissed_at);

COMMENT ON TABLE dashboard_actions IS
  'Needs-action cards on the partner Dashboard. Shared when partner_id is null; otherwise only that partner sees the card.';
