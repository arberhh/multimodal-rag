import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import Fastify from "fastify";
import type { Embed } from "../search/embed.js";
import { processDocument } from "./process.js";

const id = "2261f126-0a2e-4adc-a34a-0cfdc572a719";

function setup() {
  const queries: { sql: string; values: unknown[] }[] = [];
  const app = Fastify();
  app.decorate("pg", {
    query: async (sql: string, values: unknown[] = []) => {
      queries.push({ sql, values });
      return { rows: [] };
    },
  } as never);
  return { app, queries };
}

const fakeClient = (parsed_output: unknown) =>
  ({
    messages: {
      parse: async () => ({ parsed_output, usage: { input_tokens: 100, output_tokens: 50 } }),
    },
  }) as unknown as Anthropic;

// a fake Voyage: every text becomes the vector [text length], and each call is recorded
function fakeEmbed() {
  const calls: { texts: string[]; inputType: string }[] = [];
  const embed: Embed = async (texts, inputType) => {
    calls.push({ texts, inputType });
    return { vectors: texts.map((t) => [t.length]), tokens: texts.length * 10 };
  };
  return { embed, calls };
}

describe("processDocument", () => {
  const originalCwd = process.cwd();
  let dir: string;

  // the PDF is read from ./uploads, so run each test from its own folder
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "process-test-"));
  });

  beforeEach(async () => {
    process.chdir(dir);
    await mkdir("uploads", { recursive: true });
  });

  afterEach(() => rm(join(dir, "uploads"), { recursive: true, force: true }));

  after(async () => {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  });

  it("stores the pages with their vectors and marks the document ready in one statement", async () => {
    await writeFile(`uploads/${id}.pdf`, "%PDF-1.4 fake");
    const pages = [{ page: 1, text: "Revenue grew", tables: ["| Q1 | 5 |"], figures: [] }];
    const { app, queries } = setup();
    const { embed, calls } = fakeEmbed();

    await processDocument(app, id, fakeClient({ pages }), embed);

    // the page's text and table are embedded together, as a document
    assert.deepEqual(calls, [{ texts: ["Revenue grew\n\n| Q1 | 5 |"], inputType: "document" }]);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /INSERT INTO document_pages/);
    assert.match(queries[0].sql, /SET status = 'ready'/);
    assert.deepEqual(queries[0].values, [id, JSON.stringify([{ ...pages[0], embedding: "[24]" }])]);
  });

  it("gives a blank page no vector instead of embedding nothing", async () => {
    await writeFile(`uploads/${id}.pdf`, "%PDF-1.4 fake");
    const pages = [
      { page: 1, text: "", tables: [], figures: [] },
      { page: 2, text: "Costs fell", tables: [], figures: [] },
    ];
    const { app, queries } = setup();
    const { embed, calls } = fakeEmbed();

    await processDocument(app, id, fakeClient({ pages }), embed);

    assert.deepEqual(calls[0].texts, ["Costs fell"]);
    assert.deepEqual(queries[0].values, [
      id,
      JSON.stringify([
        { ...pages[0], embedding: null },
        { ...pages[1], embedding: "[10]" },
      ]),
    ]);
  });

  it("marks the document failed when embedding the pages fails", async () => {
    await writeFile(`uploads/${id}.pdf`, "%PDF-1.4 fake");
    const pages = [{ page: 1, text: "Revenue grew", tables: [], figures: [] }];
    const { app, queries } = setup();
    const embed: Embed = async () => {
      throw new Error("voyage down");
    };

    await processDocument(app, id, fakeClient({ pages }), embed);

    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /SET status = 'failed'/);
  });

  it("marks the document failed when reading it throws", async () => {
    await writeFile(`uploads/${id}.pdf`, "%PDF-1.4 fake");
    const { app, queries } = setup();

    await processDocument(app, id, fakeClient(null));

    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /SET status = 'failed'/);
    assert.deepEqual(queries[0].values, [id]);
  });

  it("marks the document failed when the file is missing", async () => {
    const { app, queries } = setup();

    await processDocument(app, id, fakeClient({ pages: [] }));

    assert.match(queries[0].sql, /SET status = 'failed'/);
  });

  it("never throws, even if marking it failed also fails", async () => {
    const app = Fastify();
    app.decorate("pg", {
      query: async () => {
        throw new Error("db down");
      },
    } as never);

    await assert.doesNotReject(processDocument(app, id, fakeClient(null)));
  });
});
