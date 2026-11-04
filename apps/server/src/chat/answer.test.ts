import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { answerQuestion } from "./answer.js";

const pages = [
  {
    documentId: "doc-1",
    fileName: "report.pdf",
    page: 1,
    score: 0.5,
    blocks: ["## Summary\n\nRevenue grew 23%", "Costs fell 4%", "| Q2 | Q3 |"],
  },
  {
    documentId: "doc-1",
    fileName: "report.pdf",
    page: 2,
    score: 0.4,
    blocks: ["| Europe | 0.9 |"],
  },
];

// The model is faked, so these tests never call the API. It streams `pieces`, then returns `content`.
function fakeClient(pieces: string[], content: unknown[]) {
  const requests: Record<string, any>[] = [];
  const options: Record<string, any>[] = [];
  const client = {
    messages: {
      stream: (request: Record<string, any>, option: Record<string, any> = {}) => {
        requests.push(request);
        options.push(option);
        let onText = (_text: string) => {};
        return {
          on: (_event: "text", listener: (text: string) => void) => {
            onText = listener;
          },
          finalMessage: async () => {
            for (const piece of pieces) onText(piece);
            return { content };
          },
        };
      },
    },
  } as unknown as Anthropic;
  return { client, requests, options };
}

// a citation of blocks start to end (not included) of a page
const cite = (search_result_index: number, start = 0, end = start + 1) => ({
  type: "search_result_location",
  search_result_index,
  start_block_index: start,
  end_block_index: end,
});

describe("answerQuestion", () => {
  it("passes the signal on, so aborting it stops the model", async () => {
    const { client, options } = fakeClient([], [{ type: "text", text: "ok", citations: null }]);
    const signal = new AbortController().signal;

    await answerQuestion("Q?", [], pages, () => {}, client, signal);

    assert.equal(options[0].signal, signal);
  });

  it("sends the history, then the pages as search results and the question", async () => {
    const { client, requests } = fakeClient([], [{ type: "text", text: "ok", citations: null }]);
    const history = [
      { role: "user" as const, content: "How much did revenue grow?" },
      { role: "assistant" as const, content: "23%" },
    ];

    await answerQuestion("And in Europe?", history, pages, () => {}, client);

    const { messages } = requests[0];
    assert.deepEqual(messages.slice(0, 2), history);
    const [first, second, question] = messages[2].content;
    assert.equal(first.type, "search_result");
    assert.equal(first.title, "report.pdf, page 1");
    // one block per paragraph, table or figure, so a citation names the part it used
    assert.deepEqual(first.content, [
      { type: "text", text: "## Summary\n\nRevenue grew 23%" },
      { type: "text", text: "Costs fell 4%" },
      { type: "text", text: "| Q2 | Q3 |" },
    ]);
    assert.deepEqual(first.citations, { enabled: true });
    assert.equal(second.title, "report.pdf, page 2");
    assert.deepEqual(question, { type: "text", text: "And in Europe?" });
  });

  // pages arrive best match first; the sources keep that order, whatever order they were cited in
  it("streams each piece of text and returns each cited page once, best match first", async () => {
    const { client } = fakeClient(
      ["Europe made ", "$0.9 million", "."],
      [
        { type: "text", text: "Europe made ", citations: null },
        { type: "text", text: "$0.9 million", citations: [cite(1), cite(0), cite(1)] },
        { type: "text", text: ".", citations: null },
      ],
    );
    const streamed: string[] = [];

    const result = await answerQuestion("Europe Q2?", [], pages, (t) => streamed.push(t), client);

    assert.deepEqual(streamed, ["Europe made ", "$0.9 million", "."]);
    assert.equal(result.text, "Europe made $0.9 million.");
    assert.deepEqual(result.sources, [
      {
        documentId: "doc-1",
        fileName: "report.pdf",
        page: 1,
        quote: "## Summary\n\nRevenue grew 23%",
      },
      { documentId: "doc-1", fileName: "report.pdf", page: 2, quote: "| Europe | 0.9 |" },
    ]);
  });

  it("quotes only the cited blocks of a page, each once and in page order", async () => {
    const { client } = fakeClient(
      [],
      [
        { type: "text", text: "Tables first", citations: [cite(0, 2)] },
        { type: "text", text: ", then the summary", citations: [cite(0, 0), cite(0, 2)] },
      ],
    );

    const result = await answerQuestion("Q?", [], pages, () => {}, client);

    assert.deepEqual(result.sources, [
      {
        documentId: "doc-1",
        fileName: "report.pdf",
        page: 1,
        quote: "## Summary\n\nRevenue grew 23%\n\n| Q2 | Q3 |",
      },
    ]);
  });

  it("returns no sources when the answer cites nothing", async () => {
    const { client } = fakeClient(
      ["Not in the documents."],
      [{ type: "text", text: "Not in the documents.", citations: null }],
    );

    const result = await answerQuestion("Who is the CEO?", [], pages, () => {}, client);

    assert.deepEqual(result.sources, []);
  });
});
