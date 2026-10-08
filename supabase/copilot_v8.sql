-- Which Hospitable properties Copilot may use. Null means no choice is saved yet.
-- A saved value is a JSON list of {id, name}. The token stays in cipher.

alter table copilot_hospitable
  add column if not exists selected_ids text;
