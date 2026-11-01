import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

async function removeFile(path: string) {
  try {
    await unlink(path);
  } catch {
    // already gone, which is what we wanted
  }
}

async function saveToDatabase(app: FastifyInstance, id: string, fileName: string, size: number) {
  const { rows } = await app.pg.query(
    `INSERT INTO documents (id, file_name, size_bytes) VALUES ($1, $2, $3)
     RETURNING id, file_name, size_bytes, status, created_at`,
    [id, fileName, size],
  );
  return rows[0];
}

async function getDocuments(app: FastifyInstance) {
  return await app.pg.query(
    "SELECT id, file_name, size_bytes, status, created_at FROM documents ORDER BY created_at DESC",
  );
}

export const uploads: FastifyPluginAsync<{ onUploaded?: (id: string) => void }> = async (
  app,
  { onUploaded },
) => {
  // without a limit, files are capped at Fastify's 1 MB body limit, too small for real PDFs
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES } });
  await mkdir("uploads", { recursive: true });

  app.post("/uploads", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    // random name: the client's filename must never decide where we write
    const id = randomUUID();
    const path = `uploads/${id}.pdf`;
    try {
      await pipeline(data.file, createWriteStream(path));
      const doc = await saveToDatabase(app, id, data.filename, (await stat(path)).size);
      onUploaded?.(id); // e.g. start reading the PDF; the upload does not wait for it
      return { doc };
    } catch (err) {
      await removeFile(path); // too big or no row: don't keep a half file
      throw err;
    }
  });

  app.get("/uploads", async () => ({ docs: (await getDocuments(app)).rows }));

  app.delete<{ Params: { id: string } }>(
    "/uploads/:id",
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } } },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      // the document's pages go with it (ON DELETE CASCADE)
      const { rowCount } = await app.pg.query("DELETE FROM documents WHERE id = $1", [id]);
      if (rowCount === 0) return reply.code(404).send({ error: "Document not found" });

      await removeFile(`uploads/${id}.pdf`); // the row is gone, so a missing file is fine
      return reply.code(204).send();
    },
  );
};
