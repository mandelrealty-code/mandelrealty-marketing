-- Individual partner logins (Shane + Ryan). Run in Supabase SQL editor.
-- Do not auto-run from the app. Passwords are set in Settings → Partner accounts.

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'partner',
  created_at timestamptz DEFAULT now()
);

-- Seed the two partners. Passwords are empty until set in Settings.
INSERT INTO partners (name, email, role)
VALUES
  ('Shane Mosoff', 'shane@mandelrealtygroup.com', 'partner'),
  ('Ryan Mandel', 'ryan@mandelrealtygroup.com', 'partner')
ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE partners IS
  'Individual partner logins for Shane and Ryan. Both have full admin access. Stored separately so the dashboard knows which partner is active.';

COMMENT ON COLUMN partners.password_hash IS
  'scrypt hash (same format as staff_users). Empty until the partner sets a password in Settings.';
