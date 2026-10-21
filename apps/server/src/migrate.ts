import pg from "pg";
import Postgrator from "postgrator";
import { join } from "node:path";
import { getDatabaseConfig } from "./config.js";

const config = getDatabaseConfig();
const client = new pg.Client(config);

try {
  await client.connect();

  const postgrator = new Postgrator({
    migrationPattern: join(import.meta.dirname, "../migrations/*"),
    driver: "pg",
    database: config.database,
    schemaTable: "migrations",
    currentSchema: "public",
    execQuery: (query) => client.query(query),
  });

  const applied = await postgrator.migrate();
  console.log(
    applied.length === 0
      ? "Already at the latest migration."
      : `Applied ${applied.length} migration(s).`,
  );
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
