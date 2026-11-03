import Anthropic from "@anthropic-ai/sdk";
import type { findPages } from "../search/index.js";

// TODO: pick the model (extraction uses claude-haiku-5-5)
const MODEL = "claude-sonnet-5-5";

// The formatting rule lists what the app can draw (apps/mobile/features/chat/parseMarkdown.ts)
const SYSTEM = `You answer questions about the user's documents, using only the pages provided with each question.

- If the answer isn't in the pages, say so plainly. Don't guess or use outside knowledge.
- Say when the pages are unclear or contradict each other.
- Cite the pages you use.
- Give the answer first and keep it short. Add detail only if it helps.
- Reply in the language of the question.
- Format with only: **bold**, "- " bullets, numbered lists, "## " headings and markdown tables. Show each table once. No italics, links, code blocks or nested lists.`;

type Page = Awaited<ReturnType<typeof findPages>>[number];
type Message = { role: "user" | "assistant"; content: string };
export type Source = { documentId: string; fileName: string; page: number };

// Streams an answer to the question from the found pages; each piece of text goes to onText.
// Aborting the signal stops the model mid-answer.
export async function answerQuestion(
  question: string,
  history: Message[],
  pages: Page[],
  onText: (text: string) => void,
  client: Anthropic = new Anthropic(),
  signal?: AbortSignal,
): Promise<{ text: string; sources: Source[] }> {
  // each page is a search result, so Claude can cite it and we can tell which page it used
  const results: Anthropic.SearchResultBlockParam[] = pages.map((p) => ({
    type: "search_result",
    source: `${p.documentId}#page=${p.page}`,
    title: `${p.fileName}, page ${p.page}`,
    content: [{ type: "text", text: p.content }],
    citations: { enabled: true },
  }));

  const stream = client.messages.stream(
    {
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        ...history,
        { role: "user", content: [...results, { type: "text", text: question }] },
      ],
    },
    { signal },
  );
  stream.on("text", onText);
  const message = await stream.finalMessage();

  const texts = message.content.flatMap((b) => (b.type === "text" ? [b] : []));
  // each citation says which page it used, by its position in `pages`
  const cited = new Set(
    texts
      .flatMap((b) => b.citations ?? [])
      .flatMap((c) => (c.type === "search_result_location" ? [c.search_result_index] : [])),
  );

  return {
    text: texts.map((b) => b.text).join(""),
    // the cited pages, each once, best match first
    sources: pages
      .filter((_, i) => cited.has(i))
      .map(({ documentId, fileName, page }) => ({ documentId, fileName, page })),
  };
}
