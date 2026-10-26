import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import Fastify from "fastify";
import { uploads } from "./index.js";

type Call = { sql: string; values: unknown[] };

// The routes only need app.pg.query, so a fake keeps these tests free of Postgres.
function setup(query: (call: Call) => unknown) {
  const calls: Call[] = [];
  const app = Fastify();
  app.decorate("pg", {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      return query({ sql, values });
    },
  } as never);
  return { app, calls };
}

const pdf = (name = "doc.pdf") => {
  const form = new FormData();
  form.append("file", new Blob(["%PDF-1.4 test"], { type: "application/pdf" }), name);
  return form;
};

describe("uploads", () => {
  const originalCwd = process.cwd();
  let dir: string;

  // the plugin writes to ./uploads, so run each test from its own empty folder
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "uploads-test-"));
  });

  beforeEach(() => process.chdir(dir));

  afterEach(async () => {
    await rm(join(dir, "uploads"), { recursive: true, force: true });
  });

  after(async () => {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  });

  describe("POST /uploads", () => {
    it("saves the file and a documents row with the same id", async () => {
      // like Postgres' RETURNING: hand back the inserted row
      const { app, calls } = setup(({ values: [id, file_name, size_bytes] }) => ({
        rows: [{ id, file_name, size_bytes, status: "processing" }],
      }));
      await app.register(uploads);

      const res = await app.inject({ method: "POST", url: "/uploads", payload: pdf("report.pdf") });

      assert.equal(res.statusCode, 200);
      const { id, file_name, status } = res.json().doc;
      assert.equal(file_name, "report.pdf");
      assert.equal(status, "processing");
      assert.deepEqual(await readdir(join(dir, "uploads")), [`${id}.pdf`]);
      assert.equal(calls.length, 1);
      assert.match(calls[0].sql, /INSERT INTO documents/);
      assert.deepEqual(calls[0].values, [id, "report.pdf", "%PDF-1.4 test".length]);
      await app.close();
    });

    it("tells onUploaded the new id, but not when the insert fails", async () => {
      const ids: string[] = [];
      const ok = setup(({ values: [id] }) => ({ rows: [{ id }] }));
      await ok.app.register(uploads, { onUploaded: (id) => ids.push(id) });
      const res = await ok.app.inject({ method: "POST", url: "/uploads", payload: pdf() });
      assert.deepEqual(ids, [res.json().doc.id]);
      await ok.app.close();

      const failing = setup(() => {
        throw new Error("db down");
      });
      await failing.app.register(uploads, { onUploaded: (id) => ids.push(id) });
      await failing.app.inject({ method: "POST", url: "/uploads", payload: pdf() });
      assert.equal(ids.length, 1);
      await failing.app.close();
    });

    it("never uses the client's filename as the stored path", async () => {
      const { app } = setup(() => ({ rows: [] }));
      await app.register(uploads);

      await app.inject({ method: "POST", url: "/uploads", payload: pdf("../../evil.pdf") });

      const files = await readdir(join(dir, "uploads"));
      assert.equal(files.length, 1);
      assert.doesNotMatch(files[0], /evil/);
      await app.close();
    });

    it("returns 400 when no file is sent", async () => {
      const { app, calls } = setup(() => ({ rows: [] }));
      await app.register(uploads);

      const form = new FormData();
      form.append("note", "no file here");
      const res = await app.inject({ method: "POST", url: "/uploads", payload: form });

      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.json(), { error: "No file uploaded" });
      assert.equal(calls.length, 0);
      await app.close();
    });

    it("removes the file when the insert fails", async () => {
      const { app } = setup(() => {
        throw new Error("db down");
      });
      await app.register(uploads);

      const res = await app.inject({ method: "POST", url: "/uploads", payload: pdf() });

      assert.equal(res.statusCode, 500);
      assert.deepEqual(await readdir(join(dir, "uploads")), []);
      await app.close();
    });
  });

  describe("GET /uploads", () => {
    it("returns the document rows from the database", async () => {
      const rows = [
        {
          id: "1",
          file_name: "a.pdf",
          size_bytes: 13,
          status: "processing",
          created_at: "2026-10-21T00:00:00.000Z",
        },
      ];
      const { app, calls } = setup(() => ({ rows }));
      await app.register(uploads);

      const res = await app.inject({ method: "GET", url: "/uploads" });

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { docs: rows });
      assert.match(calls[0].sql, /FROM documents ORDER BY created_at DESC/);
      await app.close();
    });
  });
});
