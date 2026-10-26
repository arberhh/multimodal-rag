import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const MODEL = "claude-haiku-5-5";

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
): Promise<PageContent[]> {
  const data = (await readFile(path)).toString("base64");

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
  return response.parsed_output.pages;
}
