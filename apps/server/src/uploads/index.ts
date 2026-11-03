import multipart from "@fastify/multipart";
import type {
  Document,
  DocumentResponse,
  DocumentsResponse,
  ErrorResponse,
} from "@multimodal-rag/shared";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { userOf } from "../users/index.js";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

async function removeFile(path: string) {
  try {
    await unlink(path);
  } catch {
    // already gone, which is what we wanted
  }
}

async function saveToDatabase(
  app: FastifyInstance,
  { id, user, fileName, size }: { id: string; user: string; fileName: string; size: number },
) {
  const { rows } = await app.pg.query<Document>(
    `INSERT INTO documents (id, file_name, size_bytes, user_id) VALUES ($1, $2, $3, $4)
     RETURNING id, file_name, size_bytes, status, created_at`,
    [id, fileName, size, user],
  );
  return rows[0];
}

async function getDocuments(app: FastifyInstance, user: string) {
  return await app.pg.query<Document>(
    `SELECT id, file_name, size_bytes, status, created_at FROM documents
     WHERE user_id = $1 ORDER BY created_at DESC`,
    [user],
  );
}

export const uploads: FastifyPluginAsync<{ onUploaded?: (id: string) => void }> = async (
  app,
  { onUploaded },
) => {
  // without a limit, files are capped at Fastify's 1 MB body limit, too small for real PDFs
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES } });
  await mkdir("uploads", { recursive: true });

  app.post<{ Reply: DocumentResponse | ErrorResponse }>("/uploads", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    // random name: the client's filename must never decide where we write
    const id = randomUUID();
    const path = `uploads/${id}.pdf`;
    try {
      await pipeline(data.file, createWriteStream(path));
      const doc = await saveToDatabase(app, {
        id,
        user: userOf(req).id,
        fileName: data.filename,
        size: (await stat(path)).size,
      });
      onUploaded?.(id); // e.g. start reading the PDF; the upload does not wait for it
      return { doc };
    } catch (err) {
      await removeFile(path); // too big or no row: don't keep a half file
      throw err;
    }
  });

  app.get<{ Reply: DocumentsResponse }>("/uploads", async (req) => ({
    docs: (await getDocuments(app, userOf(req).id)).rows,
  }));

  app.delete<{ Params: { id: string }; Reply: { 204: void; 404: ErrorResponse } }>(
    "/uploads/:id",
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } } },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      // the document's pages go with it (ON DELETE CASCADE). Someone else's document is "not
      // found" too, so its id gives nothing away
      const { rowCount } = await app.pg.query(
        "DELETE FROM documents WHERE id = $1 AND user_id = $2",
        [id, userOf(req).id],
      );
      if (rowCount === 0) return reply.code(404).send({ error: "Document not found" });

      await removeFile(`uploads/${id}.pdf`); // the row is gone, so a missing file is fine
      return reply.code(204).send();
    },
  );
};
