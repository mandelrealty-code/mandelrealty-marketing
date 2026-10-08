-- Copilot's Hospitable token. The cipher is the only copy of the token.
-- The app shows last4. It does not show the token again.

create table if not exists copilot_hospitable (
  id int primary key,
  cipher text not null default '',
  last4 text not null default '',
  saved_at timestamptz,
  checked_at timestamptz,
  property_count int not null default 0
);
