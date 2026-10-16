-- Copilot's Hospitable token. The cipher is the only copy of the token.
-- The app shows last4. It does not show the token again.

create table if not exists copilot_hospitable (
  id int primary key,
  cipher text not null default '',
  last4 text not null default '',
  saved_at timestamptz,
  checked_at timestamptz,
  property_count int not null default 0,
  selected_ids text
);

-- Row Level Security: server-only. The app reaches these tables with the service-role key, which bypasses RLS,
-- so there are deliberately NO policies: the public anon key and signed-in users can't read or write them.
alter table public.copilot_hospitable enable row level security;
