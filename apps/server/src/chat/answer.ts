import Anthropic from "@anthropic-ai/sdk";
import type { findPages } from "../search/index.js";

// TODO: pick the model (extraction uses claude-haiku-5-5)
const MODEL = "claude-sonnet-5-5";

// TODO: write the prompt: answer only from the pages, cite them, say when the answer isn't there
const SYSTEM = `answer only from pages, cite them, say when the answer isn't there`;

type Page = Awaited<ReturnType<typeof findPages>>[number];
type Message = { role: "user" | "assistant"; content: string };
export type Source = { documentId: string; fileName: string; page: number };

// Streams an answer to the question from the found pages; each piece of text goes to onText.
export async function answerQuestion(
  question: string,
  history: Message[],
  pages: Page[],
  onText: (text: string) => void,
  client: Anthropic = new Anthropic(),
): Promise<{ text: string; sources: Source[] }> {
  // each page is a search result, so Claude can cite it and we can tell which page it used
  const results: Anthropic.SearchResultBlockParam[] = pages.map((p) => ({
    type: "search_result",
    source: `${p.documentId}#page=${p.page}`,
    title: `${p.fileName}, page ${p.page}`,
    content: [{ type: "text", text: p.content }],
    citations: { enabled: true },
  }));

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [
      ...history,
      { role: "user", content: [...results, { type: "text", text: question }] },
    ],
  });
  stream.on("text", onText);
  const message = await stream.finalMessage();

  // search_result_index points into `pages`, in the order they were sent
  const cited = new Set<number>();
  let text = "";
  for (const block of message.content) {
    if (block.type !== "text") continue;
    text += block.text;
    for (const c of block.citations ?? []) {
      if (c.type === "search_result_location") cited.add(c.search_result_index);
    }
  }

  const sources = [...cited]
    .sort((a, b) => a - b)
    .map((i) => ({
      documentId: pages[i].documentId,
      fileName: pages[i].fileName,
      page: pages[i].page,
    }));
  return { text, sources };
}
