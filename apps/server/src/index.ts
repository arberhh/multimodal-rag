import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

// Same variables docker-compose.yml uses, so the server and the database can't drift apart.
const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT } = process.env;
if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB || !POSTGRES_PORT) {
  throw new Error("POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB and POSTGRES_PORT must be set");
}
const databaseUrl = `postgres://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}`;

const app = await buildApp({ logger: true, databaseUrl });

// 0.0.0.0 so phones on the same network can reach it
await app.listen({ port, host: "0.0.0.0" });
