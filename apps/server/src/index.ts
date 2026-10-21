import { buildApp } from "./app.js";
import { getDatabaseUrl } from "./config.js";

const port = Number(process.env.PORT ?? 3000);

const app = await buildApp({ logger: true, databaseUrl: getDatabaseUrl() });

// 0.0.0.0 so phones on the same network can reach it
await app.listen({ port, host: "0.0.0.0" });
