import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { answerQuestion } from "./answer.js";

const pages = [
  { documentId: "doc-1", fileName: "report.pdf", page: 1, score: 0.5, content: "Revenue grew 23%" },
  { documentId: "doc-1", fileName: "report.pdf", page: 2, score: 0.4, content: "| Europe | 0.9 |" },
];

// The model is faked, so these tests never call the API. It streams `pieces`, then returns `content`.
function fakeClient(pieces: string[], content: unknown[]) {
  const requests: Record<string, any>[] = [];
  const client = {
    messages: {
      stream: (request: Record<string, any>) => {
        requests.push(request);
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
  return { client, requests };
}

const cite = (search_result_index: number) => ({
  type: "search_result_location",
  search_result_index,
});

describe("answerQuestion", () => {
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
    assert.deepEqual(first.content, [{ type: "text", text: "Revenue grew 23%" }]);
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
      { documentId: "doc-1", fileName: "report.pdf", page: 1 },
      { documentId: "doc-1", fileName: "report.pdf", page: 2 },
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
