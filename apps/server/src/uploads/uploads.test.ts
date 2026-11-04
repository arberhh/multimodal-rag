import assert from "node:assert/strict";
import { basename, join } from "node:path";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import Fastify from "fastify";
import { uploads } from "./index.js";
import { asTestUser, testUser } from "../users/testing.js";

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
  asTestUser(app);
  return { app, calls };
}

const upload = (name: string, content: BlobPart) => {
  const form = new FormData();
  form.append("file", new Blob([content]), name);
  return form;
};
const pdf = (name = "doc.pdf") => upload(name, "%PDF-1.4 test");
// a .docx is a zip file, and .doc an older Office file: these are their first bytes
const docx = (name = "notes.docx") => upload(name, new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]));
const doc = (name = "old.doc") =>
  upload(name, new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1]));

// stands in for LibreOffice: writes <outDir>/<the input's name>.pdf, as soffice does
const toPdf = async (input: string, outDir: string) => {
  await writeFile(join(outDir, basename(input).replace(/\.\w+$/, ".pdf")), "%PDF-1.4 converted");
};
const insertRow = ({ values: [id, file_name, size_bytes] }: Call) => ({
  rows: [{ id, file_name, size_bytes, status: "processing" }],
});

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
      assert.deepEqual(calls[0].values, [id, "report.pdf", "%PDF-1.4 test".length, testUser.id]);
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
      const { app } = setup(({ values: [id] }) => ({ rows: [{ id, status: "processing" }] }));
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

  describe("POST /uploads with a Word file", () => {
    for (const [kind, form] of [
      ["docx", docx("notes.docx")],
      ["doc", doc("notes.doc")],
    ] as const) {
      it(`turns a .${kind} into a PDF and keeps only the PDF`, async () => {
        const inputs: string[] = [];
        const { app } = setup(insertRow);
        await app.register(uploads, {
          toPdf: async (input, outDir) => {
            inputs.push(input);
            await toPdf(input, outDir);
          },
        });

        const res = await app.inject({ method: "POST", url: "/uploads", payload: form });

        assert.equal(res.statusCode, 200);
        const { id, file_name } = res.json().doc;
        assert.equal(file_name, `notes.${kind}`);
        assert.deepEqual(inputs, [`uploads/${id}.${kind}`]);
        assert.deepEqual(await readdir(join(dir, "uploads")), [`${id}.pdf`]);
        await app.close();
      });
    }

    it("returns 422 and keeps nothing when the Word file can't be turned into a PDF", async () => {
      const { app, calls } = setup(insertRow);
      await app.register(uploads, {
        toPdf: async () => {
          throw new Error("soffice failed");
        },
      });

      const res = await app.inject({ method: "POST", url: "/uploads", payload: docx() });

      assert.equal(res.statusCode, 422);
      assert.deepEqual(res.json(), { error: "Couldn't read this Word file" });
      assert.deepEqual(await readdir(join(dir, "uploads")), []);
      assert.equal(calls.length, 0);
      await app.close();
    });

    it("refuses anything that isn't a PDF or a Word file, whatever it's called", async () => {
      const { app, calls } = setup(insertRow);
      await app.register(uploads, { toPdf });

      const res = await app.inject({
        method: "POST",
        url: "/uploads",
        payload: upload("fake.pdf", "just some text"),
      });

      assert.equal(res.statusCode, 415);
      assert.deepEqual(await readdir(join(dir, "uploads")), []);
      assert.equal(calls.length, 0);
      await app.close();
    });
  });

  describe("POST /uploads/google", () => {
    const docId = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
    const link = `https://docs.google.com/document/d/${docId}/edit?usp=sharing`;

    // stands in for fetch, answering with what Google sends
    const google = (body: string, headers: Record<string, string>, status = 200) => {
      const urls: string[] = [];
      const fetchGoogle: typeof fetch = async (url) => {
        urls.push(String(url));
        return new Response(body, { status, headers });
      };
      return { urls, fetchGoogle };
    };
    const shared = {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="Q3 plan.pdf"; filename*=UTF-8''Q3%20plan.pdf`,
    };

    it("saves a shared doc's PDF export, named after the doc", async () => {
      const { urls, fetchGoogle } = google("%PDF-1.4 from google", shared);
      const { app, calls } = setup(insertRow);
      await app.register(uploads, { fetchGoogle });

      const res = await app.inject({
        method: "POST",
        url: "/uploads/google",
        payload: { url: link },
      });

      assert.equal(res.statusCode, 200);
      const { id, file_name } = res.json().doc;
      assert.equal(file_name, "Q3 plan.pdf");
      assert.deepEqual(urls, [`https://docs.google.com/document/d/${docId}/export?format=pdf`]);
      assert.deepEqual(await readdir(join(dir, "uploads")), [`${id}.pdf`]);
      assert.deepEqual(calls[0].values, [
        id,
        "Q3 plan.pdf",
        "%PDF-1.4 from google".length,
        testUser.id,
      ]);
      await app.close();
    });

    it("says to share the doc when Google answers with its sign-in page", async () => {
      const { fetchGoogle } = google("<html>Sign in</html>", { "content-type": "text/html" });
      const { app, calls } = setup(insertRow);
      await app.register(uploads, { fetchGoogle });

      const res = await app.inject({
        method: "POST",
        url: "/uploads/google",
        payload: { url: link },
      });

      assert.equal(res.statusCode, 422);
      assert.match(res.json().error, /Anyone with the link/);
      assert.deepEqual(await readdir(join(dir, "uploads")), []);
      assert.equal(calls.length, 0);
      await app.close();
    });

    it("returns 400 for a link that isn't a Google Doc, without fetching it", async () => {
      const { urls, fetchGoogle } = google("%PDF-1.4", shared);
      const { app } = setup(insertRow);
      await app.register(uploads, { fetchGoogle });

      for (const url of [
        "https://example.com/document/d/abc",
        "http://localhost:3000/health",
        "",
      ]) {
        // eslint-disable-next-line no-await-in-loop
        const res = await app.inject({ method: "POST", url: "/uploads/google", payload: { url } });
        assert.equal(res.statusCode, 400, url);
      }
      assert.equal(urls.length, 0);
      await app.close();
    });

    it("returns 502 when Google can't be reached", async () => {
      const { app } = setup(insertRow);
      await app.register(uploads, {
        fetchGoogle: async () => {
          throw new TypeError("fetch failed");
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/uploads/google",
        payload: { url: link },
      });

      assert.equal(res.statusCode, 502);
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
      // only the user's documents
      assert.match(calls[0].sql, /WHERE user_id = \$1 ORDER BY created_at DESC/);
      assert.deepEqual(calls[0].values, [testUser.id]);
      await app.close();
    });
  });

  describe("DELETE /uploads/:id", () => {
    const id = "2261f126-0a2e-4adc-a34a-0cfdc572a719";

    it("removes the documents row and the file", async () => {
      const { app, calls } = setup(() => ({ rowCount: 1 }));
      await app.register(uploads);
      await writeFile(join(dir, "uploads", `${id}.pdf`), "%PDF-1.4 test");

      const res = await app.inject({ method: "DELETE", url: `/uploads/${id}` });

      assert.equal(res.statusCode, 204);
      assert.match(calls[0].sql, /DELETE FROM documents/);
      assert.deepEqual(calls[0].values, [id, testUser.id]);
      assert.deepEqual(await readdir(join(dir, "uploads")), []);
      await app.close();
    });

    it("still succeeds when the file is already gone", async () => {
      const { app } = setup(() => ({ rowCount: 1 }));
      await app.register(uploads);

      const res = await app.inject({ method: "DELETE", url: `/uploads/${id}` });

      assert.equal(res.statusCode, 204);
      await app.close();
    });

    it("returns 404 for an unknown document and keeps other files", async () => {
      const { app } = setup(() => ({ rowCount: 0 }));
      await app.register(uploads);
      await writeFile(join(dir, "uploads", `${id}.pdf`), "%PDF-1.4 test");

      const res = await app.inject({ method: "DELETE", url: `/uploads/${id}` });

      assert.equal(res.statusCode, 404);
      assert.deepEqual(await readdir(join(dir, "uploads")), [`${id}.pdf`]);
      await app.close();
    });

    it("returns 400 for an id that isn't a uuid, so it can't reach a file path", async () => {
      const { app, calls } = setup(() => ({ rowCount: 1 }));
      await app.register(uploads);

      const res = await app.inject({ method: "DELETE", url: "/uploads/..%2F..%2Fevil" });

      assert.equal(res.statusCode, 400);
      assert.equal(calls.length, 0);
      await app.close();
    });
  });
});
