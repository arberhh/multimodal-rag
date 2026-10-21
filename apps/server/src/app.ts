import cors from "@fastify/cors";
import Fastify from "fastify";
import { uploads } from "./uploads/index.js";

export async function buildApp(options: { logger: boolean } = { logger: true }) {
  const app = Fastify(options);
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(uploads);

  return app;
}
