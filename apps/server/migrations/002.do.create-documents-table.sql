CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  file_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
