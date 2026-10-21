import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

export const uploads: FastifyPluginAsync = async (app) => {
  await app.register(multipart);
  await mkdir("uploads", { recursive: true });

  app.post("/uploads", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    // random name: the client's filename must never decide where we write
    const id = randomUUID();
    await pipeline(data.file, createWriteStream(`uploads/${id}.pdf`));
    return { id, name: data.filename };
  });
};
