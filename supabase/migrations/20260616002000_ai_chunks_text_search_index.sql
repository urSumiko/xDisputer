-- AI chunk text search performance baseline.
-- Supports the first safe RAG implementation that uses ilike text retrieval.

create extension if not exists pg_trgm;

create index if not exists ai_chunks_content_trgm_idx
on public.ai_chunks using gin(content gin_trgm_ops);

notify pgrst, 'reload schema';
