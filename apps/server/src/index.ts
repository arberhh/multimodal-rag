import cors from "@fastify/cors";
import Fastify from "fastify";

const port = Number(process.env.PORT ?? 3000);

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

// 0.0.0.0 so phones on the same network can reach it
await app.listen({ port, host: "0.0.0.0" });
