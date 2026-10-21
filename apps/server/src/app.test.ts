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
    // Same host the server binds to, so phones on the network can connect.
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
