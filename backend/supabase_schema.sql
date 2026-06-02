create extension if not exists vector;

create table if not exists document_chunks (
  id bigserial primary key,
  content text not null,
  embedding vector(384) not null,
  filename text not null,
  page integer,
  created_at timestamptz default now()
);

alter table document_chunks
add column if not exists content text;

alter table document_chunks
add column if not exists embedding vector(384);

alter table document_chunks
add column if not exists filename text;

alter table document_chunks
add column if not exists page integer;

alter table document_chunks
add column if not exists created_at timestamptz default now();

create index if not exists document_chunks_embedding_idx
on document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create or replace function match_document_chunks(
  query_embedding vector(384),
  match_count int
)
returns table (
  id bigint,
  content text,
  filename text,
  page integer,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.content,
    document_chunks.filename,
    document_chunks.page,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;

notify pgrst, 'reload schema';
