import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { FastifyBaseLogger } from "fastify";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const MODEL = "claude-haiku-5-5";
// the API takes 32 MB per request and base64 adds a third
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const PROMPT = `Read this PDF page by page. For every page return:
- page: the page number, starting at 1
- text: all body text in reading order, without tables
- tables: each table as a markdown table
- figures: one description per chart or picture, saying what it shows, including key values or trends
Use only what is on the page. Do not invent anything. Use empty lists when a page has no tables or figures.`;

const PageContent = z.object({
  page: z.number().int(),
  text: z.string(),
  tables: z.array(z.string()),
  figures: z.array(z.string()),
});

export type PageContent = z.infer<typeof PageContent>;

export async function extractPages(
  path: string,
  client: Anthropic = new Anthropic(),
  log?: FastifyBaseLogger,
): Promise<PageContent[]> {
  const bytes = await readFile(path);
  if (bytes.length > MAX_PDF_BYTES) throw new Error("PDF is too large to read");
  const data = bytes.toString("base64");

  const startedAt = Date.now();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(z.object({ pages: z.array(PageContent) })) },
  });

  if (!response.parsed_output) throw new Error("Claude did not return the pages");

  const pages = response.parsed_output.pages;
  log?.info(
    {
      model: MODEL,
      pdfBytes: bytes.length,
      pages: pages.length,
      tables: pages.reduce((n, p) => n + p.tables.length, 0),
      figures: pages.reduce((n, p) => n + p.figures.length, 0),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      seconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
    },
    "Claude answered",
  );
  return pages;
}
