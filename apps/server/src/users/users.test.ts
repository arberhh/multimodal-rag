import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { userOf, users } from "./index.js";

const deviceId = "3f2b8c1d-7e4a-4b9c-a1d2-6e5f4c3b2a10";
const user = { id: "9d1c4e2a-5b6f-4a3e-8c7d-1e2f3a4b5c6d", name: null };

// Fakes Postgres: users come back as the row the query would return. known: whether the device
// already has a user
async function setup({ known = true } = {}) {
  const queries: { sql: string; values: unknown[] }[] = [];
  const app = Fastify();
  app.decorate("pg", {
    query: async (sql: string, values: unknown[] = []) => {
      queries.push({ sql, values });
      if (sql.includes("UPDATE users")) return { rows: [{ ...user, name: values[1] }] };
      if (sql.startsWith("SELECT") && !known) return { rows: [] };
      return { rows: [user] };
    },
  } as never);
  await app.register(users);
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/whoami", async (req) => ({ id: userOf(req).id }));
  return { app, queries };
}

describe("users", () => {
  it("finds the user from X-Device-Id, for every route, without writing", async () => {
    const { app, queries } = await setup();

    const res = await app.inject({ url: "/whoami", headers: { "x-device-id": deviceId } });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { id: user.id });
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /SELECT id, name FROM users WHERE device_id = \$1/);
    assert.deepEqual(queries[0].values, [deviceId]);
  });

  it("creates the user on an install's first request", async () => {
    const { app, queries } = await setup({ known: false });

    const res = await app.inject({ url: "/whoami", headers: { "x-device-id": deviceId } });

    assert.deepEqual(res.json(), { id: user.id });
    assert.match(queries[1].sql, /INSERT INTO users \(device_id\)[\s\S]*ON CONFLICT/);
    assert.deepEqual(queries[1].values, [deviceId]);
  });

  it("refuses a request without a device id, or with one that isn't a UUID", async () => {
    const { app, queries } = await setup();

    assert.equal((await app.inject({ url: "/whoami" })).statusCode, 401);
    const bad = await app.inject({ url: "/whoami", headers: { "x-device-id": "phone" } });
    assert.equal(bad.statusCode, 401);
    assert.equal(queries.length, 0);
  });

  it("lets the status check through without a device id", async () => {
    const { app } = await setup();
    assert.equal((await app.inject({ url: "/health" })).statusCode, 200);
  });

  it("GET /me returns the user and PUT /me sets the name, trimmed", async () => {
    const { app, queries } = await setup();
    const headers = { "x-device-id": deviceId };

    const me = await app.inject({ url: "/me", headers });
    assert.deepEqual(me.json(), { user });

    const named = await app.inject({
      method: "PUT",
      url: "/me",
      headers,
      payload: { name: " Ada " },
    });
    assert.deepEqual(named.json(), { user: { ...user, name: "Ada" } });
    assert.deepEqual(queries.at(-1)?.values, [user.id, "Ada"]);
  });

  it("refuses an empty name, or one of only spaces", async () => {
    const { app } = await setup();
    for (const name of ["", "   "]) {
      // eslint-disable-next-line no-await-in-loop
      const res = await app.inject({
        method: "PUT",
        url: "/me",
        headers: { "x-device-id": deviceId },
        payload: { name },
      });
      assert.equal(res.statusCode, 400, JSON.stringify(name));
    }
  });
});
