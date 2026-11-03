import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

export type User = { id: string; name: string | null };

declare module "fastify" {
  interface FastifyRequest {
    user: User | null; // set by the hook below before any route runs
  }
}

// The user making the request. Throws only if this plugin wasn't registered before the route
export function userOf(req: FastifyRequest): User {
  if (!req.user) throw new Error("No user: register the users plugin before the routes");
  return req.user;
}

// the random UUID each install of the app makes for itself
const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Who is asking. Each install of the app sends its own random id in X-Device-Id, and every route
// reads the user from req.user. This is not authentication: anyone who knows an id can use it.
// fp() makes the hook apply to the routes registered after this plugin, not just its own.
const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (req, reply) => {
    // the status check and CORS preflight come before the app knows who it is
    if (req.method === "OPTIONS" || req.routeOptions.url === "/health") return;

    const deviceId = req.headers["x-device-id"];
    if (typeof deviceId !== "string" || !DEVICE_ID.test(deviceId)) {
      return reply.code(401).send({ error: "Send X-Device-Id with this app's id" });
    }
    // the first request from an install creates its user; later ones find it
    const { rows } = await app.pg.query<User>(
      `INSERT INTO users (device_id) VALUES ($1)
       ON CONFLICT (device_id) DO UPDATE SET device_id = EXCLUDED.device_id
       RETURNING id, name`,
      [deviceId],
    );
    req.user = rows[0];
  });

  app.get("/me", async (req) => ({ user: userOf(req) }));

  app.put<{ Body: { name: string } }>(
    "/me",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string", minLength: 1, maxLength: 60 } },
        },
      },
    },
    async (req) => {
      const { rows } = await app.pg.query<User>(
        "UPDATE users SET name = $2 WHERE id = $1 RETURNING id, name",
        [userOf(req).id, req.body.name.trim()],
      );
      return { user: rows[0] };
    },
  );
};

export const users = fp(plugin);
