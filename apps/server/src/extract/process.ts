import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyInstance } from "fastify";
import { pageContent } from "../search/content.js";
import { type Embed, embedTexts } from "../search/embed.js";
import { extractPages } from "./pdf.js";

// Reads an uploaded PDF, stores its pages and marks the document ready.
// Never throws: a failure is logged and the document is marked failed.
export async function processDocument(
  app: FastifyInstance,
  id: string,
  client?: Anthropic,
  embed: Embed = embedTexts,
) {
  const log = app.log.child({ doc: id });
  try {
    log.info("Started reading the document");
    const pages = await extractPages(`uploads/${id}.pdf`, client, log);

    // a vector per page, so a question can be matched to a page by meaning; blank pages get none
    const contents = pages.map(pageContent);
    const toEmbed = contents.flatMap((content, i) => (content ? [i] : []));
    const { vectors, tokens } = await embed(
      toEmbed.map((i) => contents[i]),
      "document",
    );
    const embeddings = new Map(
      toEmbed.map((pageIndex, n) => [pageIndex, JSON.stringify(vectors[n])]),
    );
    const rows = pages.map((page, i) => ({ ...page, embedding: embeddings.get(i) ?? null }));

    // one statement, so the pages and the status change together or not at all
    await app.pg.query(
      `WITH inserted AS (
         INSERT INTO document_pages (document_id, page, text, tables, figures, embedding)
         SELECT $1, p.page, p.text, p.tables, p.figures, p.embedding::vector
         FROM jsonb_to_recordset($2::jsonb)
           AS p(page int, text text, tables jsonb, figures jsonb, embedding text)
       )
       UPDATE documents SET status = 'ready' WHERE id = $1`,
      [id, JSON.stringify(rows)],
    );
    log.info({ pages: pages.length, embeddingTokens: tokens }, "Pages saved, document is ready");
  } catch (err) {
    log.error({ err }, "Reading the document failed, marking it failed");
    await app.pg
      .query("UPDATE documents SET status = 'failed' WHERE id = $1", [id])
      .catch((statusErr: unknown) =>
        log.error({ err: statusErr }, "Could not mark the document failed"),
      );
  }
}
