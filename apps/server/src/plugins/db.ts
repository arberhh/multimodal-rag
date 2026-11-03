import fastifyPostgres from "@fastify/postgres";
import fp from "fastify-plugin";

// fp() makes app.pg visible to every plugin registered after this one.
export const db = fp<{ connectionString: string }>(async (app, { connectionString }) => {
  // the search filters by user after the vector index scan. Without iterative scans the index
  // hands over only its 40 nearest pages, so a user whose pages aren't among them gets few or no
  // results. strict_order keeps scanning until the limit is met, in exact distance order
  await app.register(fastifyPostgres, {
    connectionString,
    options: "-c hnsw.iterative_scan=strict_order",
  });
  // an idle connection the database drops (a restart, a stop) is reported here. Without a
  // listener Node treats it as unhandled and the whole server crashes; the pool reconnects on
  // the next query
  app.pg.pool.on("error", (err) => app.log.error({ err }, "A database connection was lost"));
});
