import type { FastifyPluginAsync } from "fastify";

export const extract: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    "/extract/:id",
    // a bad id gets a 400 here, instead of a 500 from Postgres rejecting it as a uuid
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } } },
      },
    },
    async (req, reply) => {
      const { rows } = await app.pg.query(
        "SELECT page, text, tables, figures FROM document_pages WHERE document_id = $1 ORDER BY page",
        [req.params.id],
      );
      if (rows.length === 0) return reply.code(404).send({ error: "No pages for this document" });
      return { id: req.params.id, pages: rows };
    },
  );
};
