import { buildApp } from "./app.js";
import { getDatabaseUrl } from "./config.js";

const port = Number(process.env.PORT ?? 3000);

// readable logs while developing, plain JSON in production
const logger =
  process.env.NODE_ENV === "production"
    ? true
    : {
        transport: {
          target: "pino-pretty",
          options: { translateTime: "HH:MM:ss", ignore: "pid,hostname,reqId", singleLine: true },
        },
      };

const app = await buildApp({ logger, databaseUrl: getDatabaseUrl() });

// 0.0.0.0 so phones on the same network can reach it
await app.listen({ port, host: "0.0.0.0" });
