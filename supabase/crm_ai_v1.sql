-- Run in Supabase → SQL Editor after leads + lead_sms_messages exist.
-- AI pre-closer CRM: stages, AI toggles, knowledge base (RAG), settings.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- Pipeline stages (migrate legacy statuses)
-- Drop check FIRST — old constraint still only allows 'qualified' / 'onboarding'
-- ---------------------------------------------------------------------------
alter table public.leads drop constraint if exists leads_status_check;

update public.leads set status = 'engaging' where status = 'qualified';
update public.leads set status = 'won' where status = 'onboarding';

alter table public.leads
  add constraint leads_status_check
  check (status in (
    'new',
    'engaging',
    'interested',
    'booked',
    'call_done',
    'needs_shane',
    'won',
    'low_fit',
    'skip'
  ));

alter table public.leads
  add column if not exists ai_paused boolean not null default false;

-- ---------------------------------------------------------------------------
-- SMS meta (AI-generated flag, etc.)
-- ---------------------------------------------------------------------------
alter table public.lead_sms_messages
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Global CRM settings (single row)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_settings (
  id int primary key default 1 check (id = 1),
  ai_responses_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.crm_settings (id, ai_responses_enabled)
values (1, true)
on conflict (id) do nothing;

alter table public.crm_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  filename text not null default '',
  mime text not null default 'text/plain',
  storage_path text not null default '',
  active boolean not null default true,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'failed')),
  error text,
  chunk_count int not null default 0
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  doc_id uuid not null references public.knowledge_docs (id) on delete cascade,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists knowledge_chunks_doc_id_idx
  on public.knowledge_chunks (doc_id);

-- Optional after you have chunks: create an HNSW index for faster search
-- create index knowledge_chunks_embedding_idx on public.knowledge_chunks
--   using hnsw (embedding vector_cosine_ops);

alter table public.knowledge_docs enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Similarity search over active docs only
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  match_threshold float default 0.7
)
returns table (
  id uuid,
  doc_id uuid,
  content text,
  similarity float,
  doc_title text
)
language sql
stable
as $$
  select
    c.id,
    c.doc_id,
    c.content,
    (1 - (c.embedding <=> query_embedding))::float as similarity,
    d.title as doc_title
  from public.knowledge_chunks c
  inner join public.knowledge_docs d on d.id = c.doc_id
  where d.active = true
    and d.status = 'ready'
    and c.embedding is not null
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- Storage bucket for original files (create in Dashboard if this fails)
insert into storage.buckets (id, name, public)
values ('knowledge', 'knowledge', false)
on conflict (id) do nothing;
