import cors from "@fastify/cors";
import type { HealthResponse } from "@multimodal-rag/shared";
import Fastify, { type FastifyServerOptions } from "fastify";
import { chat } from "./chat/index.js";
import { db } from "./plugins/db.js";
import { extract } from "./extract/index.js";
import { processDocument } from "./extract/process.js";
import { search } from "./search/index.js";
import { uploads } from "./uploads/index.js";
import { users } from "./users/index.js";

export async function buildApp(
  options: { logger: FastifyServerOptions["logger"]; databaseUrl?: string } = { logger: true },
) {
  const app = Fastify({ logger: options.logger });
  await app.register(cors, { origin: true });

  // shared plugins first, so the features below can use them. users needs the database, and
  // tells every route below who is asking
  if (options.databaseUrl) {
    await app.register(db, { connectionString: options.databaseUrl });
    await app.register(users);
  }

  // healthy only if the database answers too: without it every other route fails
  app.get<{ Reply: HealthResponse }>("/health", async (req, reply) => {
    if (!app.hasDecorator("pg")) return { status: "ok" };
    try {
      await app.pg.query("SELECT 1");
      return { status: "ok" };
    } catch (err) {
      req.log.error({ err }, "The database is unreachable");
      return reply.code(503).send({ status: "database unreachable" });
    }
  });
  await app.register(uploads, { onUploaded: (id) => processDocument(app, id) });
  await app.register(extract);
  await app.register(search);
  await app.register(chat);

  return app;
}
