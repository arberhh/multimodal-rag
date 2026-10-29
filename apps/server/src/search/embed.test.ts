import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { embedTexts } from "./embed.js";

// fetch is faked, so these tests never call Voyage
function fakeVoyage() {
  const requests: { url: string; headers: Record<string, string>; body: any }[] = [];
  mock.method(globalThis, "fetch", async (url: string, init: any) => {
    const body = JSON.parse(init.body);
    requests.push({ url, headers: init.headers, body });
    // return the vectors out of order, to check they are put back in order
    const data = body.input
      .map((text: string, index: number) => ({ index, embedding: [text.length] }))
      .reverse();
    return new Response(JSON.stringify({ data, usage: { total_tokens: body.input.length * 3 } }));
  });
  return requests;
}

describe("embedTexts", () => {
  const originalKey = process.env.VOYAGE_API_KEY;

  beforeEach(() => {
    process.env.VOYAGE_API_KEY = "test-key";
  });

  afterEach(() => {
    mock.restoreAll();
    if (originalKey === undefined) delete process.env.VOYAGE_API_KEY;
    else process.env.VOYAGE_API_KEY = originalKey;
  });

  it("sends the texts with the key, the model and the input type", async () => {
    const requests = fakeVoyage();

    await embedTexts(["a question"], "query");

    assert.equal(requests[0].url, "https://api.voyageai.com/v1/embeddings");
    assert.equal(requests[0].headers.Authorization, "Bearer test-key");
    assert.deepEqual(requests[0].body, {
      input: ["a question"],
      model: "voyage-3.5",
      input_type: "query",
    });
  });

  it("returns one vector per text, in order, and adds up the tokens", async () => {
    fakeVoyage();

    const { vectors, tokens } = await embedTexts(["a", "bb", "ccc"], "document");

    assert.deepEqual(vectors, [[1], [2], [3]]);
    assert.equal(tokens, 9);
  });

  it("splits a long list into several requests and keeps the order", async () => {
    const requests = fakeVoyage();
    const texts = Array.from({ length: 40 }, (_, i) => "x".repeat(i + 1));

    const { vectors } = await embedTexts(texts, "document");

    assert.equal(requests.length, 3); // 16 + 16 + 8
    assert.deepEqual(
      vectors.map((v) => v[0]),
      texts.map((t) => t.length),
    );
  });

  it("makes no request for an empty list", async () => {
    const requests = fakeVoyage();

    assert.deepEqual(await embedTexts([], "document"), { vectors: [], tokens: 0 });
    assert.equal(requests.length, 0);
  });

  it("throws a clear error when the key is missing", async () => {
    delete process.env.VOYAGE_API_KEY;
    await assert.rejects(embedTexts(["a"], "query"), /VOYAGE_API_KEY is not set/);
  });

  it("throws with the status when Voyage answers with an error", async () => {
    mock.method(globalThis, "fetch", async () => new Response("bad key", { status: 401 }));
    await assert.rejects(embedTexts(["a"], "query"), /401 bad key/);
  });
});
