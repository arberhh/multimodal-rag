import fastifyPostgres from "@fastify/postgres";
import fp from "fastify-plugin";

// fp() makes app.pg visible to every plugin registered after this one.
export const db = fp<{ connectionString: string }>(async (app, { connectionString }) => {
  await app.register(fastifyPostgres, { connectionString });
});
