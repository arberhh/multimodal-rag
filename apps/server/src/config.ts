// Same variables docker-compose.yml uses, so the server and the database can't drift apart.
export function getDatabaseConfig() {
  const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT } = process.env;
  if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB || !POSTGRES_PORT) {
    throw new Error("POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB and POSTGRES_PORT must be set");
  }

  return {
    host: "localhost",
    port: Number(POSTGRES_PORT),
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DB,
  };
}

export function getDatabaseUrl() {
  const { host, port, user, password, database } = getDatabaseConfig();
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}
