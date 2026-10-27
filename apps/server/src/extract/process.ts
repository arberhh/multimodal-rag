import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyInstance } from "fastify";
import { extractPages } from "./pdf.js";

// Reads an uploaded PDF, stores its pages and marks the document ready.
// Never throws: a failure is logged and the document is marked failed.
export async function processDocument(app: FastifyInstance, id: string, client?: Anthropic) {
  const log = app.log.child({ doc: id });
  try {
    log.info("Started reading the document");
    const pages = await extractPages(`uploads/${id}.pdf`, client, log);

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
    log.info({ pages: pages.length }, "Pages saved, document is ready");
  } catch (err) {
    log.error({ err }, "Reading the document failed, marking it failed");
    await app.pg
      .query("UPDATE documents SET status = 'failed' WHERE id = $1", [id])
      .catch((statusErr: unknown) =>
        log.error({ err: statusErr }, "Could not mark the document failed"),
      );
  }
}
