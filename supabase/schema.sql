-- Maine Aquaculture License Assistant — Supabase schema.
-- Apply with: psql "$POSTGRES_URL_NON_POOLING" -f supabase/schema.sql
--
-- Two concerns, one database: conversation/application state (so a user can
-- leave and resume — see the original spec's "save progress" flow) and the
-- pgvector store for regulatory document RAG. Both are accessed exclusively
-- via the Supabase service_role key from server-side API routes; RLS is
-- enabled with no policies so anon/authenticated access is denied by
-- default (service_role bypasses RLS by design, so the app is unaffected).

create extension if not exists vector;

-- One row per conversation. `user_id` is an anonymous per-browser token held
-- in a cookie; a browser may own many conversations. `title` is derived from
-- the first user message and is null until that message arrives.
create table if not exists conversations (
  id text primary key,
  user_id text,
  title text,
  profile jsonb not null default '{}'::jsonb,
  routing jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table conversations enable row level security;

-- The chat list query: "this browser's conversations, most recent first."
create index if not exists conversations_user_updated_idx
  on conversations (user_id, updated_at desc);

-- Regulatory document chunks for RAG. Populated by scripts/ingest.ts.
-- Dimension 1536 matches OpenRouter's openai/text-embedding-3-small.
create table if not exists document_chunks (
  id bigint generated always as identity primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

alter table document_chunks enable row level security;

create index if not exists document_chunks_embedding_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);

-- Cosine-similarity search, called via supabase.rpc('match_document_chunks', ...).
create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_count int default 4
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.content,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
