import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { buildApp } from "./app.js";

// ARB-64: the app shows "Connected" when GET /health returns ok:true and { status: "ok" }.
describe("GET /health", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let baseUrl: string;

  before(async () => {
    app = await buildApp({ logger: false });
    // bind the way index.ts does (0.0.0.0, for phones on the network), on any free port
    await app.listen({ port: 0, host: "0.0.0.0" });
    baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  });

  after(() => app.close());

  it("returns 200 with status ok, which the mobile app reads as connected", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.ok, true);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  it("allows cross-origin calls from the web build", async () => {
    const res = await fetch(`${baseUrl}/health`, { headers: { Origin: "http://localhost:8081" } });
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:8081");
  });
});

describe("GET /health without the database", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  // nothing listens on port 1, so every query fails at once
  before(async () => {
    app = await buildApp({ logger: false, databaseUrl: "postgres://nobody@127.0.0.1:1/none" });
  });

  after(() => app.close());

  it("returns 503, which the mobile app reads as not connected", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.json(), { status: "database unreachable" });
  });

  it("keeps running when the database drops a connection", () => {
    // with no listener, emitting "error" throws, which is what crashed the server
    assert.doesNotThrow(() => app.pg.pool.emit("error", new Error("connection terminated")));
  });
});
