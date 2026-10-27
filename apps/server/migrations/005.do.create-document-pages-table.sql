CREATE TABLE IF NOT EXISTS document_pages (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  tables JSONB NOT NULL DEFAULT '[]',
  figures JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (document_id, page)
);
