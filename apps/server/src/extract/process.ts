import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyInstance } from "fastify";
import { extractPages } from "./pdf.js";

// Reads an uploaded PDF, stores its pages and marks the document ready.
// Never throws: a failure is logged and the document is marked failed.
export async function processDocument(app: FastifyInstance, id: string, client?: Anthropic) {
  try {
    const pages = await extractPages(`uploads/${id}.pdf`, client);

    // one statement, so the pages and the status change together or not at all
    await app.pg.query(
      `WITH inserted AS (
         INSERT INTO document_pages (document_id, page, text, tables, figures)
         SELECT $1, p.page, p.text, p.tables, p.figures
         FROM jsonb_to_recordset($2::jsonb) AS p(page int, text text, tables jsonb, figures jsonb)
       )
       UPDATE documents SET status = 'ready' WHERE id = $1`,
      [id, JSON.stringify(pages)],
    );
    app.log.info({ id, pages: pages.length }, "document processed");
  } catch (err) {
    app.log.error({ err, id }, "document processing failed");
    await app.pg
      .query("UPDATE documents SET status = 'failed' WHERE id = $1", [id])
      .catch((statusErr: unknown) =>
        app.log.error({ err: statusErr, id }, "could not mark failed"),
      );
  }
}
