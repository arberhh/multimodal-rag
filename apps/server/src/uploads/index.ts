import type { FastifyPluginAsync } from "fastify";

export const uploads: FastifyPluginAsync = async (app) => {
  app.post("/uploads", async () => ({ message: "uploads connected" }));
};
