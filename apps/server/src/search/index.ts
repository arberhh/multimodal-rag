import type { SearchResponse, SearchResult } from "@multimodal-rag/shared";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { pageBlocks } from "./content.js";
import { type Embed, embedTexts } from "./embed.js";
import { userOf } from "../users/index.js";

// <=> is pgvector's cosine distance, so 1 - distance is the similarity (1 = same meaning)
const SEARCH_SQL = `
  SELECT p.document_id, d.file_name, p.page, p.text, p.tables, p.figures,
         1 - (p.embedding <=> $1::vector) AS score
  FROM document_pages p
  JOIN documents d ON d.id = p.document_id
  WHERE p.embedding IS NOT NULL AND d.user_id = $4
    AND ($3::uuid IS NULL OR p.document_id = $3::uuid)
  ORDER BY p.embedding <=> $1::vector
  LIMIT $2`;

// The pages closest in meaning to the question, best first, from the user's own documents. Each
// page comes in blocks, the parts Claude can cite one at a time.
export async function findPages(
  app: FastifyInstance,
  question: string,
  { user, limit = 5, document }: { user: string; limit?: number; document?: string },
  embed: Embed = embedTexts,
): Promise<(Omit<SearchResult, "content"> & { blocks: string[] })[]> {
  const { vectors } = await embed([question], "query");
  const { rows } = await app.pg.query(SEARCH_SQL, [
    JSON.stringify(vectors[0]),
    limit,
    document ?? null,
    user,
  ]);

  return rows.map((r) => ({
    documentId: r.document_id as string,
    fileName: r.file_name as string,
    page: r.page as number,
    score: Number(r.score),
    blocks: pageBlocks(r),
  }));
}

export const search: FastifyPluginAsync<{ embed?: Embed }> = async (
  app,
  { embed = embedTexts },
) => {
  app.get<{ Querystring: { q: string; limit: number; document?: string }; Reply: SearchResponse }>(
    "/search",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 1, maxLength: 500 },
            limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
            document: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req) => {
      const { q, limit, document } = req.query;
      const user = userOf(req).id;
      const pages = await findPages(app, q, { user, limit, document }, embed);
      return {
        results: pages.map(({ documentId, fileName, page, score, blocks }) => ({
          documentId,
          fileName,
          page,
          score,
          content: blocks.join("\n\n"),
        })),
      };
    },
  );
};
