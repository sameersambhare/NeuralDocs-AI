create extension if not exists vector;

create table if not exists document_chunks (
  id bigserial primary key,
  content text not null,
  embedding vector(384) not null,
  workspace_id text not null default 'default',
  filename text not null,
  page integer,
  content_type text not null default 'text',
  extraction_method text not null default 'text',
  table_index integer,
  created_at timestamptz default now()
);

alter table document_chunks
add column if not exists content text;

alter table document_chunks
add column if not exists embedding vector(384);

alter table document_chunks
add column if not exists workspace_id text default 'default';

alter table document_chunks
add column if not exists filename text;

alter table document_chunks
add column if not exists page integer;

alter table document_chunks
add column if not exists content_type text default 'text';

alter table document_chunks
add column if not exists extraction_method text default 'text';

alter table document_chunks
add column if not exists table_index integer;

alter table document_chunks
add column if not exists created_at timestamptz default now();

create index if not exists document_chunks_embedding_idx
on document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index if not exists document_chunks_workspace_id_idx
on document_chunks (workspace_id);

drop function if exists match_document_chunks(vector(384), int, text, text[]);
drop function if exists match_document_chunks(vector(384), int, text);

create or replace function match_document_chunks(
  query_embedding vector(384),
  match_count int,
  workspace_filter text default null,
  filename_filters text[] default null
)
returns table (
  id bigint,
  content text,
  workspace_id text,
  filename text,
  page integer,
  content_type text,
  extraction_method text,
  table_index integer,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.content,
    document_chunks.workspace_id,
    document_chunks.filename,
    document_chunks.page,
    document_chunks.content_type,
    document_chunks.extraction_method,
    document_chunks.table_index,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where (
    workspace_filter is null
    or document_chunks.workspace_id = workspace_filter
  )
  and (
    filename_filters is null
    or document_chunks.filename = any(filename_filters)
  )
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;

notify pgrst, 'reload schema';
