import cors from "@fastify/cors";
import Fastify from "fastify";

export async function buildApp(options: { logger: boolean } = { logger: true }) {
  const app = Fastify(options);
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
