import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

async function saveToDatabase(app: FastifyInstance, id: string, fileName: string, size: number) {
  await app.pg.query("INSERT INTO documents (id, file_name, size_bytes) VALUES ($1, $2, $3)", [
    id,
    fileName,
    size,
  ]);
}

async function getDocuments(app: FastifyInstance) {
  return await app.pg.query(
    "SELECT id, file_name, size_bytes, status, created_at FROM documents ORDER BY created_at DESC",
  );
}

export const uploads: FastifyPluginAsync = async (app) => {
  await app.register(multipart);
  await mkdir("uploads", { recursive: true });

  app.post("/uploads", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    // random name: the client's filename must never decide where we write
    const id = randomUUID();
    const path = `uploads/${id}.pdf`;
    await pipeline(data.file, createWriteStream(path));

    try {
      await saveToDatabase(app, id, data.filename, (await stat(path)).size);
    } catch (err) {
      await unlink(path); // no row, so no orphan file
      throw err;
    }

    return { id, name: data.filename };
  });

  app.get("/uploads", async () => ({ docs: (await getDocuments(app)).rows }));
};
