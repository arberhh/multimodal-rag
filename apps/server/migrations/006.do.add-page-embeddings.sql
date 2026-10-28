CREATE EXTENSION IF NOT EXISTS vector;

-- 1024 numbers per page: the size voyage-4 returns
ALTER TABLE document_pages ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS document_pages_embedding_idx
  ON document_pages USING hnsw (embedding vector_cosine_ops);
