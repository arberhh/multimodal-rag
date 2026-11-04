import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { extract } from "./index.js";
import { asTestUser, testUser } from "../users/testing.js";

const id = "2261f126-0a2e-4adc-a34a-0cfdc572a719";

async function setup(rows: unknown[]) {
  const calls: unknown[][] = [];
  const app = Fastify();
  app.decorate("pg", {
    query: async (_sql: string, values: unknown[]) => {
      calls.push(values);
      return { rows };
    },
  } as never);
  asTestUser(app);
  await app.register(extract);
  return { app, calls };
}

describe("GET /extract/:id", () => {
  it("returns the stored pages", async () => {
    const rows = [
      { page: 1, text: "Revenue grew", tables: ["| Q1 | 5 |"], figures: [] },
      { page: 2, text: "Costs fell", tables: [], figures: ["Bar chart: costs fall"] },
    ];
    const { app, calls } = await setup(rows);

    const res = await app.inject({ url: `/extract/${id}` });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { id, pages: rows });
    // only the user's own document
    assert.deepEqual(calls, [[id, testUser.id]]);
  });

  it("returns 404 when no pages are stored", async () => {
    const { app } = await setup([]);
    assert.equal((await app.inject({ url: `/extract/${id}` })).statusCode, 404);
  });

  it("returns 400 for an id that is not a uuid, without touching the database", async () => {
    const { app, calls } = await setup([]);

    const res = await app.inject({ url: "/extract/not-a-uuid" });

    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
});
