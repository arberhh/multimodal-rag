import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";
import { db } from "./plugins/db.js";
import { extract } from "./extract/index.js";
import { uploads } from "./uploads/index.js";

export async function buildApp(
  options: { logger: FastifyServerOptions["logger"]; databaseUrl?: string } = { logger: true },
) {
  const app = Fastify({ logger: options.logger });
  await app.register(cors, { origin: true });

  // shared plugins first, so the features below can use them
  if (options.databaseUrl) await app.register(db, { connectionString: options.databaseUrl });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(uploads);
  await app.register(extract);

  return app;
}
