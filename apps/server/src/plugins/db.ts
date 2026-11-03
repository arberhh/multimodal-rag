import fastifyPostgres from "@fastify/postgres";
import fp from "fastify-plugin";

// fp() makes app.pg visible to every plugin registered after this one.
export const db = fp<{ connectionString: string }>(async (app, { connectionString }) => {
  await app.register(fastifyPostgres, { connectionString });
  // an idle connection the database drops (a restart, a stop) is reported here. Without a
  // listener Node treats it as unhandled and the whole server crashes; the pool reconnects on
  // the next query
  app.pg.pool.on("error", (err) => app.log.error({ err }, "A database connection was lost"));
});
