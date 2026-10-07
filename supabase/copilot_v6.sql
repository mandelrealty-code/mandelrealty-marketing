-- One skill is also one workflow. The canvas (steps, links, boundary) lives on the skill row.
alter table copilot_skills add column if not exists workflow jsonb;
