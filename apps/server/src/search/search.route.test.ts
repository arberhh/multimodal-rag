import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { type Embed } from "./embed.js";
import { search } from "./index.js";
import { asTestUser, testUser } from "../users/testing.js";

const docId = "2261f126-0a2e-4adc-a34a-0cfdc572a719";

async function setup(rows: unknown[] = []) {
  const queries: { sql: string; values: unknown[] }[] = [];
  const embedded: { texts: string[]; inputType: string }[] = [];
  const embed: Embed = async (texts, inputType) => {
    embedded.push({ texts, inputType });
    return { vectors: [[0.5, 0.25]], tokens: 4 };
  };
  const app = Fastify();
  app.decorate("pg", {
    query: async (sql: string, values: unknown[]) => {
      queries.push({ sql, values });
      return { rows };
    },
  } as never);
  asTestUser(app);
  await app.register(search, { embed });
  return { app, queries, embedded };
}

describe("GET /search", () => {
  it("embeds the question and returns the closest pages with document and page", async () => {
    const { app, queries, embedded } = await setup([
      {
        document_id: docId,
        file_name: "quarterly-report.pdf",
        page: 2,
        score: "0.83",
        text: "# 2. Revenue by region",
        tables: ["| Region | Q1 |"],
        figures: ["Bar chart of revenue"],
      },
    ]);

    const res = await app.inject({ url: "/search?q=how much did Europe make" });

    assert.equal(res.statusCode, 200);
    // the question is embedded as a query, not as a document
    assert.deepEqual(embedded, [{ texts: ["how much did Europe make"], inputType: "query" }]);
    assert.deepEqual(res.json(), {
      results: [
        {
          documentId: docId,
          fileName: "quarterly-report.pdf",
          page: 2,
          score: 0.83,
          content: "# 2. Revenue by region\n\n| Region | Q1 |\n\nBar chart of revenue",
        },
      ],
    });
    // vector, limit (5 by default), no document filter, and only the user's documents
    assert.deepEqual(queries[0].values, ["[0.5,0.25]", 5, null, testUser.id]);
  });

  it("passes the limit and the document filter to the search", async () => {
    const { app, queries } = await setup();

    await app.inject({ url: `/search?q=revenue&limit=3&document=${docId}` });

    assert.deepEqual(queries[0].values, ["[0.5,0.25]", 3, docId, testUser.id]);
  });

  it("returns an empty list when nothing is stored yet", async () => {
    const { app } = await setup([]);
    const res = await app.inject({ url: "/search?q=anything" });
    assert.deepEqual(res.json(), { results: [] });
  });

  it("returns 400 for a missing, empty or oversized question, or a bad filter, without calling Voyage", async () => {
    const { app, embedded } = await setup();

    for (const url of [
      "/search",
      "/search?q=",
      `/search?q=${"x".repeat(501)}`,
      "/search?q=a&limit=0",
      "/search?q=a&limit=21",
      "/search?q=a&document=not-a-uuid",
    ]) {
      // eslint-disable-next-line no-await-in-loop
      assert.equal((await app.inject({ url })).statusCode, 400, url);
    }
    assert.equal(embedded.length, 0);
  });
});
