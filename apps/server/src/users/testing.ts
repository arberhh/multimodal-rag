import type { FastifyInstance } from "fastify";
import type { User } from "./index.js";

export const testUser: User = { id: "9d1c4e2a-5b6f-4a3e-8c7d-1e2f3a4b5c6d", name: null };

// Stands in for the users plugin in route tests: every request comes from testUser
export function asTestUser(app: FastifyInstance) {
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req) => {
    req.user = testUser;
  });
}
