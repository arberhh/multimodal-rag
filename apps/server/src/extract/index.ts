import type { FastifyPluginAsync } from "fastify";
import { idParams } from "../schemas.js";
import { userOf } from "../users/index.js";

export const extract: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    "/extract/:id",
    { schema: { params: idParams } },
    async (req, reply) => {
      const { rows } = await app.pg.query(
        `SELECT p.page, p.text, p.tables, p.figures FROM document_pages p
         JOIN documents d ON d.id = p.document_id
         WHERE p.document_id = $1 AND d.user_id = $2 ORDER BY p.page`,
        [req.params.id, userOf(req).id],
      );
      if (rows.length === 0) return reply.code(404).send({ error: "No pages for this document" });
      return { id: req.params.id, pages: rows };
    },
  );
};
