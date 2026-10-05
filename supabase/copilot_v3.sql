-- Copilot: skills only. A saved skill with a schedule is run by a Cursor cloud agent.
-- Run once in the Supabase SQL editor, before deploying. Safe to run again.
-- Nothing here sends anything. Skill runs leave reports and drafts in Copilot.

alter table copilot_skills add column if not exists schedule text not null default '';
alter table copilot_skills add column if not exists chat_id uuid;
alter table copilot_skills add column if not exists last_run_at timestamptz;

-- Runs now belong to a skill. The old job column stays for history only.
alter table copilot_runs alter column job_id drop not null;
alter table copilot_runs add column if not exists skill_id uuid references copilot_skills(id) on delete cascade;
alter table copilot_runs add column if not exists agent_id text not null default '';
alter table copilot_runs add column if not exists cursor_run_id text not null default '';

create index if not exists copilot_runs_skill_idx on copilot_runs (skill_id, started_at desc);

-- Move the morning inbox from Jobs into Skills, keeping its chat.
insert into copilot_skills (name, when_text, reads, drafts, must_not, enabled, kind, phone, schedule, chat_id)
select
  'Morning inbox',
  'Every morning around 5:00.',
  'Hospitable guest messages for stays checked in now or arriving in the next 14 days.',
  'A report in this chat: which guests are waiting on a reply, and which guests may have sent their arrival time, licence plate, or number of guests. Quote the line for each detail.',
  'Do not message any guest. Do not say a detail was sent, only that it may have been sent.',
  j.enabled,
  'playbook',
  '',
  'daily',
  j.chat_id
from copilot_jobs j
where j.kind = 'guest_inbox'
  and not exists (select 1 from copilot_skills s where s.name = 'Morning inbox');

update copilot_jobs set enabled = false where kind = 'guest_inbox';
