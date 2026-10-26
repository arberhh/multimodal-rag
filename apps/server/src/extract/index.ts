import type { FastifyPluginAsync } from "fastify";
import { extractPages } from "./pdf.js";

export const extract: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    "/extract/:id",
    // uuid only, so the id can't point outside the uploads folder
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } } },
      },
    },
    async (req, reply) => {
      const path = `uploads/${req.params.id}.pdf`;
      try {
        return { id: req.params.id, pages: await extractPages(path) };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          return reply.code(404).send({ error: "Document not found" });
        }
        throw err;
      }
    },
  );
};
