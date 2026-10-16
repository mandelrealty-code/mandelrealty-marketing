-- Copilot chats, drafts, and reminders. Run once in the Supabase SQL editor.
-- Nothing here sends mail. Drafts stay waiting until a person approves them.

create table if not exists copilot_chats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  kind text not null default 'chat'
);

create table if not exists copilot_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references copilot_chats(id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null,
  body text not null,
  draft jsonb
);

create index if not exists copilot_messages_chat_idx on copilot_messages (chat_id, created_at);

create table if not exists copilot_reminders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  due_on date not null,
  text text not null,
  done boolean not null default false
);

create table if not exists copilot_memory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  note text not null
);

create table if not exists copilot_dismissals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  card_id text not null unique
);

create table if not exists copilot_skills (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  when_text text not null,
  reads text not null,
  drafts text not null,
  must_not text not null,
  enabled boolean not null default true,
  kind text not null default 'playbook',
  phone text not null default ''
);

alter table copilot_skills add column if not exists kind text not null default 'playbook';
alter table copilot_skills add column if not exists phone text not null default '';

create table if not exists copilot_text_numbers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  phone text not null unique
);

create table if not exists copilot_text_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  skill_id uuid,
  unit text not null default '',
  body text not null,
  link text not null default ''
);

-- Row Level Security: server-only. The app reaches these tables with the service-role key, which bypasses RLS,
-- so there are deliberately NO policies: the public anon key and signed-in users can't read or write them.
alter table public.copilot_chats enable row level security;
alter table public.copilot_messages enable row level security;
alter table public.copilot_reminders enable row level security;
alter table public.copilot_memory enable row level security;
alter table public.copilot_dismissals enable row level security;
alter table public.copilot_skills enable row level security;
alter table public.copilot_text_numbers enable row level security;
alter table public.copilot_text_log enable row level security;
