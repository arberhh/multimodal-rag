-- the pages an answer came from: [{ documentId, fileName, page }]. Null for user messages.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sources JSONB;
