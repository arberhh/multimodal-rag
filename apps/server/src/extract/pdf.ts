import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { FastifyBaseLogger } from "fastify";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const MODEL = "claude-haiku-5-5";
// the API takes 32 MB per request and base64 adds a third
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const PROMPT = `Transcribe this PDF for a search index. Copy the content word for word; do not summarise. Put each piece of content in one place only.

Return one object per page, in order, even for a blank page:
- page: position in the file (1 = first page), not the printed number
- printed_page_label: the number printed on the page, or null
- text: body text in reading order (one column at a time), as markdown with headings, lists, captions, footnotes and equations (LaTeX). Leave out running headers and footers. Keep numbers and units exactly as printed.
- tables: every table, including tables shown as images. Each has title (or null), markdown (every row and column; repeat merged cell values), notes (footnotes or source, or null) and continued_from_page (or null).
- figures: every chart, diagram, map, photo or screenshot that carries information. Each has type, title (or null), text_in_figure (all text inside it), data and description.
  data is for charts only (otherwise null): a markdown table of the plotted values, one row per x value, slice or point and one column per series. Prefix estimated values with "~".
  description is 1-2 sentences: the trend or comparison, or for a diagram its parts and how they connect.

Use only what is on the page. Write [illegible] for anything unreadable. Use empty lists when a page has no tables or figures.`;

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
