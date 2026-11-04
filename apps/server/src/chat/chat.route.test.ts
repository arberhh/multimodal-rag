import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import Fastify from "fastify";
import { type Embed } from "../search/embed.js";
import { chat } from "./index.js";
import { asTestUser, testUser } from "../users/testing.js";

const convId = "7b0f1c9e-4c1a-4f0e-9a51-2f6d8c3b1a10";
const docId = "2261f126-0a2e-4adc-a34a-0cfdc572a719";

const pageRow = {
  document_id: docId,
  file_name: "quarterly-report.pdf",
  page: 2,
  score: "0.5",
  text: "| Europe | 0.8 | 0.9 |",
  tables: [],
  figures: [],
};

// Fakes Postgres, Voyage and Claude, so these tests never leave the process.
async function setup({
  exists = true,
  history = [] as { role: string; content: string }[],
  fail = false,
} = {}) {
  const queries: { sql: string; values: unknown[] }[] = [];
  const embedded: string[] = [];
  const embed: Embed = async (texts) => {
    embedded.push(...texts);
    return { vectors: [[0.5, 0.25]], tokens: 4 };
  };
  const client = {
    messages: {
      stream: () => {
        let onText = (_text: string) => {};
        return {
          on: (_event: "text", listener: (text: string) => void) => {
            onText = listener;
          },
          finalMessage: async () => {
            if (fail) throw new Error("model down");
            onText("Europe made ");
            onText("$0.9 million.");
            return {
              content: [
                {
                  type: "text",
                  text: "Europe made $0.9 million.",
                  citations: [
                    {
                      type: "search_result_location",
                      search_result_index: 0,
                      start_block_index: 0,
                      end_block_index: 1,
                    },
                  ],
                },
              ],
            };
          },
        };
      },
    },
  } as unknown as Anthropic;

  const app = Fastify();
  app.decorate("pg", {
    query: async (sql: string, values: unknown[] = []) => {
      queries.push({ sql, values });
      if (sql.includes("INSERT INTO conversations")) return { rows: [{ id: convId }] };
      if (sql.includes("DELETE FROM conversations")) return { rows: [], rowCount: exists ? 1 : 0 };
      if (sql.includes("SELECT id, title")) return { rows: [{ id: convId, title: "Q2?" }] };
      if (sql.includes("FROM conversations")) return { rows: [], rowCount: exists ? 1 : 0 };
      if (sql.includes("SELECT role, content FROM messages")) return { rows: history };
      if (sql.includes("FROM document_pages")) return { rows: [pageRow] };
      return { rows: [] };
    },
  } as never);
  asTestUser(app);
  await app.register(chat, { embed, client });
  return { app, queries, embedded };
}

const ask = (app: Awaited<ReturnType<typeof setup>>["app"], payload: object) =>
  app.inject({ method: "POST", url: `/conversations/${convId}/messages`, payload });

// "event: text\ndata: {...}\n\n" blocks into [event, data] pairs
function events(body: string) {
  return body
    .trim()
    .split("\n\n")
    .map((block) => {
      const [event, data] = block.split("\n");
      return [event.replace("event: ", ""), JSON.parse(data.replace("data: ", ""))];
    });
}

describe("chat routes", () => {
  it("POST /conversations creates a conversation", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "POST", url: "/conversations" });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().conversation.id, convId);
  });

  it("streams the answer, then the sources, and saves both messages", async () => {
    const { app, queries } = await setup();

    const res = await ask(app, { question: "How much did Europe make in Q2?", document: docId });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"] as string, /text\/event-stream/);
    const sources = [
      {
        documentId: docId,
        fileName: "quarterly-report.pdf",
        page: 2,
        quote: "| Europe | 0.8 | 0.9 |",
      },
    ];
    assert.deepEqual(events(res.body), [
      ["text", { text: "Europe made " }],
      ["text", { text: "$0.9 million." }],
      ["done", { sources }],
    ]);

    // the search is limited to the chosen document
    const search = queries.find((q) => q.sql.includes("document_pages"));
    assert.equal(search?.values[2], docId);

    const saved = queries.filter((q) => q.sql.includes("INSERT INTO messages"));
    assert.deepEqual(saved[0].values, [convId, "How much did Europe make in Q2?"]);
    assert.deepEqual(saved[1].values, [
      convId,
      "Europe made $0.9 million.",
      JSON.stringify(sources),
    ]);
  });

  it("searches a follow-up together with the previous question", async () => {
    const { app, embedded } = await setup({
      history: [
        { role: "user", content: "How much did Europe make in Q2?" },
        { role: "assistant", content: "$0.9 million." },
      ],
    });

    await ask(app, { question: "And in Q3?" });

    assert.deepEqual(embedded, ["How much did Europe make in Q2?\nAnd in Q3?"]);
  });

  it("sends an error event and saves no answer when the model fails", async () => {
    const { app, queries } = await setup({ fail: true });

    const res = await ask(app, { question: "Anything?" });

    assert.deepEqual(events(res.body), [["error", { error: "Could not answer the question" }]]);
    assert.equal(queries.filter((q) => q.sql.includes("INSERT INTO messages")).length, 1);
  });

  it("returns 404 for an unknown conversation, without searching", async () => {
    const { app, embedded } = await setup({ exists: false });
    const res = await ask(app, { question: "Anything?" });
    assert.equal(res.statusCode, 404);
    assert.equal(embedded.length, 0);
  });

  it("returns 400 for a missing or empty question, or a bad id", async () => {
    const { app } = await setup();
    assert.equal((await ask(app, {})).statusCode, 400);
    assert.equal((await ask(app, { question: "" })).statusCode, 400);
    const bad = await app.inject({
      method: "POST",
      url: "/conversations/nope/messages",
      payload: { question: "a" },
    });
    assert.equal(bad.statusCode, 400);
  });

  it("GET /conversations/:id/messages returns the history", async () => {
    const { app, queries } = await setup();
    const res = await app.inject({ url: `/conversations/${convId}/messages` });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { messages: [] });
    // checks the conversation is the user's, then reads it
    assert.deepEqual(queries[0].values, [convId, testUser.id]);
    assert.deepEqual(queries[1].values, [convId]);
  });

  it("POST /conversations gives the conversation to the user", async () => {
    const { app, queries } = await setup();
    await app.inject({ method: "POST", url: "/conversations" });
    assert.deepEqual(queries[0].values, [testUser.id]);
  });

  it("names the conversation after its first question and moves it to the top", async () => {
    const { app, queries } = await setup();

    await ask(app, { question: "How much did Europe make in Q2?" });

    const update = queries.find((q) => q.sql.includes("UPDATE conversations"));
    assert.match(
      update?.sql ?? "",
      /title = COALESCE\(title, left\(\$2, 80\)\), updated_at = now\(\)/,
    );
    assert.deepEqual(update?.values, [convId, "How much did Europe make in Q2?"]);
  });

  it("only answers in the user's own conversations", async () => {
    const { app, queries } = await setup();
    await ask(app, { question: "Anything?" });
    assert.deepEqual(queries[0].values, [convId, testUser.id]);
  });

  it("GET /conversations lists the user's named conversations, latest first", async () => {
    const { app, queries } = await setup();

    const res = await app.inject({ url: "/conversations?limit=5" });

    assert.deepEqual(res.json(), { conversations: [{ id: convId, title: "Q2?" }] });
    assert.match(
      queries[0].sql,
      /WHERE user_id = \$1 AND title IS NOT NULL\s+ORDER BY updated_at DESC/,
    );
    assert.deepEqual(queries[0].values, [testUser.id, 5]);
  });

  it("GET /conversations lists 50 by default", async () => {
    const { app, queries } = await setup();
    await app.inject({ url: "/conversations" });
    assert.deepEqual(queries[0].values, [testUser.id, 50]);
  });

  it("DELETE /conversations/:id removes the user's conversation, or answers 404", async () => {
    const own = await setup();
    const res = await own.app.inject({ method: "DELETE", url: `/conversations/${convId}` });
    assert.equal(res.statusCode, 204);
    assert.deepEqual(own.queries[0].values, [convId, testUser.id]);

    const other = await setup({ exists: false });
    const missing = await other.app.inject({ method: "DELETE", url: `/conversations/${convId}` });
    assert.equal(missing.statusCode, 404);
  });

  it("GET /conversations/:id/messages answers 404 for someone else's conversation", async () => {
    const { app } = await setup({ exists: false });
    const res = await app.inject({ url: `/conversations/${convId}/messages` });
    assert.equal(res.statusCode, 404);
  });
});
