import cors from "@fastify/cors";
import Fastify from "fastify";
import { db } from "./plugins/db.js";
import { uploads } from "./uploads/index.js";

export async function buildApp(
  options: { logger: boolean; databaseUrl?: string } = { logger: true },
) {
  const app = Fastify({ logger: options.logger });
  await app.register(cors, { origin: true });

  // shared plugins first, so the features below can use them
  if (options.databaseUrl) await app.register(db, { connectionString: options.databaseUrl });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(uploads);

  return app;
}
