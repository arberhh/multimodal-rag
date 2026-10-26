import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { extractPages } from "./pdf.js";

// The model is faked, so these tests never call the API.
function fakeClient(parsed_output: unknown) {
  const requests: Record<string, any>[] = [];
  const client = {
    messages: {
      parse: async (request: Record<string, any>) => {
        requests.push(request);
        return { parsed_output };
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

describe("extractPages", () => {
  let dir: string;
  let path: string;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "extract-test-"));
    path = join(dir, "report.pdf");
    await writeFile(path, "%PDF-1.4 fake");
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("sends the PDF to the model and returns the pages it read", async () => {
    const pages = [
      { page: 1, text: "Revenue grew", tables: ["| Q1 | 5 |"], figures: [] },
      { page: 2, text: "Costs fell", tables: [], figures: ["Bar chart: costs fall each quarter"] },
    ];
    const { client, requests } = fakeClient({ pages });

    assert.deepEqual(await extractPages(path, client), pages);

    const document = requests[0].messages[0].content[0];
    assert.equal(document.type, "document");
    assert.equal(document.source.media_type, "application/pdf");
    assert.equal(document.source.data, Buffer.from("%PDF-1.4 fake").toString("base64"));
  });

  it("throws when the model returns nothing usable", async () => {
    const { client } = fakeClient(null);
    await assert.rejects(extractPages(path, client), /did not return/);
  });

  it("refuses a PDF that is too large, before calling the model", async () => {
    const big = join(dir, "big.pdf");
    await writeFile(big, Buffer.alloc(21 * 1024 * 1024));
    const { client, requests } = fakeClient({ pages: [] });

    await assert.rejects(extractPages(big, client), /too large/);
    assert.equal(requests.length, 0);
  });

  it("throws ENOENT for a missing file, before calling the model", async () => {
    const { client, requests } = fakeClient({ pages: [] });
    await assert.rejects(extractPages(join(dir, "nope.pdf"), client), { code: "ENOENT" });
    assert.equal(requests.length, 0);
  });
});
