import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Chat from "~/app/chat";
import { parseEvents } from "~/features/chat/sse";
import { parseMarkdown, parseSpans } from "~/features/chat/parseMarkdown";

jest.mock("~/features/server/config", () => ({ serverUrl: "http://test-server" }));
// SwiftUI only renders in native builds, so these tests use the web view
const mockSetString = jest.fn(async () => true);
const mockParams: { id?: string } = {};
jest.mock("one", () => ({
  Link: () => null,
  useSafeAreaInsets: () => ({ bottom: 0 }),
  useLocalSearchParams: () => mockParams,
  One: {
    platform: "web",
    Storage: { getItem: () => "test-device", setItem() {} },
    Clipboard: { setString: (text: string) => mockSetString(text) },
    Haptics: { impact() {}, notification() {}, selection() {} },
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// A request the test feeds by hand, so it can check the screen between two pieces of the answer.
class FakeRequest {
  static last: FakeRequest;
  status = 200;
  responseText = "";
  body = "";
  url = "";
  aborted = false;
  onprogress?: () => void;
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;

  open(_method: string, url: string) {
    this.url = url;
    FakeRequest.last = this;
  }
  setRequestHeader() {}
  send(body: string) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  receive(chunk: string) {
    this.responseText += chunk;
    this.onprogress?.();
  }
  finish(status = 200) {
    this.status = status;
    this.onload?.();
  }
}
Object.defineProperty(global, "XMLHttpRequest", { value: FakeRequest });

const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const text = (piece: string) => event("text", { text: piece });
const source = { documentId: "d1", fileName: "report.pdf", page: 3 };

const ask = async (question: string) => {
  await act(async () => fireEvent.changeText(screen.getByLabelText("Question"), question));
  await act(async () => fireEvent.press(screen.getByLabelText("Send")));
};

beforeEach(() => {
  delete mockParams.id;
  mockFetch.mockReset();
  mockSetString.mockClear();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ conversation: { id: "c1" } }),
  });
});

describe("reading the stream", () => {
  it("returns the complete events and keeps half an event for the next chunk", () => {
    const first = parseEvents(`${text("Hel")}event: text\ndata: {"te`);
    expect(first.events).toEqual([{ event: "text", data: { text: "Hel" } }]);

    const second = parseEvents(`${first.rest}xt":"lo"}\n\n`);
    expect(second.events).toEqual([{ event: "text", data: { text: "lo" } }]);
    expect(second.rest).toBe("");
  });

  it("reads lines ending in \\r\\n and data split over several lines", () => {
    const { events } = parseEvents('event: done\r\ndata: {"sources":\r\ndata: []}\r\n\r\n');
    expect(events).toEqual([{ event: "done", data: { sources: [] } }]);
  });
});

describe("reading markdown", () => {
  it("reads a table with its header and rows", () => {
    const blocks = parseMarkdown(
      "Sales:\n\n| Quarter | Revenue |\n|---|---:|\n| Q1 | 5 |\n| Q2 | 7 |\n\nDone",
    );

    expect(blocks).toMatchObject([
      { type: "paragraph", text: "Sales:" },
      {
        type: "table",
        header: ["Quarter", "Revenue"],
        rows: [
          ["Q1", "5"],
          ["Q2", "7"],
        ],
      },
      { type: "paragraph", text: "Done" },
    ]);
  });

  it("keeps a table as plain text until its separator row arrives", () => {
    expect(parseMarkdown("| Quarter | Revenue |")).toMatchObject([{ type: "paragraph" }]);
  });

  it("reads headings and bullet and numbered lists", () => {
    expect(parseMarkdown("## Results\n- one\n- two\n1. first")).toMatchObject([
      { type: "heading", text: "Results" },
      {
        type: "list",
        items: [
          { marker: "•", text: "one" },
          { marker: "•", text: "two" },
          { marker: "1.", text: "first" },
        ],
      },
    ]);
  });

  it("splits bold and code out of a line", () => {
    expect(parseSpans("Revenue was **5M** in `Q1`")).toMatchObject([
      { text: "Revenue was " },
      { text: "5M", bold: true },
      { text: " in " },
      { text: "Q1", code: true },
    ]);
  });

  it("keeps bold text that contains a star", () => {
    expect(parseSpans("**5 * 2** units")).toMatchObject([
      { text: "5 * 2", bold: true },
      { text: " units" },
    ]);
  });

  it("waits for the text of a list item or heading still being written", () => {
    expect(parseMarkdown("Results:\n-")).toMatchObject([{ type: "paragraph", text: "Results:" }]);
    expect(parseMarkdown("Results:\n##")).toHaveLength(1);
  });
});

// ARB-72: ask a question and get the answer with its sources.
describe("chat screen", () => {
  it("starts empty", async () => {
    await render(<Chat />);

    expect(screen.getByText("Ask about your documents")).toBeOnTheScreen();
    expect(screen.getByText("What are these documents about?")).toBeOnTheScreen();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows the answer as it is written, then its sources", async () => {
    await render(<Chat />);
    await ask("What was Q1 revenue?");

    expect(screen.getByText("What was Q1 revenue?")).toBeOnTheScreen();
    expect(screen.getByText("Thinking…")).toBeOnTheScreen();
    // the conversation is started by the first question, and the question goes to it
    expect(mockFetch).toHaveBeenCalledWith("http://test-server/conversations", {
      method: "POST",
      headers: { "X-Device-Id": "test-device" },
    });
    expect(FakeRequest.last.url).toBe("http://test-server/conversations/c1/messages");
    expect(JSON.parse(FakeRequest.last.body)).toEqual({ question: "What was Q1 revenue?" });

    await act(async () => FakeRequest.last.receive(text("Q1 revenue ")));
    expect(screen.getByText("Q1 revenue")).toBeOnTheScreen();
    expect(screen.queryByText("Thinking…")).toBeNull();
    expect(screen.queryByText("report.pdf · p. 3")).toBeNull();

    await act(async () =>
      FakeRequest.last.receive(text("was 5M.") + event("done", { sources: [source] })),
    );
    await act(async () => FakeRequest.last.finish());

    expect(screen.getByText("Q1 revenue was 5M.")).toBeOnTheScreen();
    expect(screen.getByText("report.pdf · p. 3")).toBeOnTheScreen();
  });

  it("reads several events in one piece and an event split over two", async () => {
    await render(<Chat />);
    await ask("Letters?");

    await act(async () =>
      FakeRequest.last.receive(`${text("A ")}${text("B ")}event: text\ndata: {"te`),
    );
    await act(async () =>
      FakeRequest.last.receive(`xt":"C"}\n\n${event("done", { sources: [] })}`),
    );
    await act(async () => FakeRequest.last.finish());

    expect(screen.getByText("A B C")).toBeOnTheScreen();
  });

  it("shows a table in the answer as a table", async () => {
    await render(<Chat />);
    await ask("Revenue by quarter?");

    const table = "| Quarter | Revenue |\n|---|---|\n| Q1 | 5M |\n| Q2 | 7M |";
    await act(async () => FakeRequest.last.receive(text(table) + event("done", { sources: [] })));
    await act(async () => FakeRequest.last.finish());

    for (const cell of ["Quarter", "Revenue", "Q1", "5M", "Q2", "7M"]) {
      expect(screen.getByText(cell)).toBeOnTheScreen();
    }
    expect(screen.queryByText(/\|---\|/)).toBeNull();
  });

  it("keeps the same conversation for a follow-up question", async () => {
    await render(<Chat />);
    await ask("First?");
    await act(async () => FakeRequest.last.receive(text("One.") + event("done", { sources: [] })));
    await act(async () => FakeRequest.last.finish());

    await ask("And then?");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(FakeRequest.last.url).toBe("http://test-server/conversations/c1/messages");
  });

  it("shows an error when the server can't answer, and lets the user ask again", async () => {
    await render(<Chat />);
    await ask("Anything?");

    await act(async () =>
      FakeRequest.last.receive(event("error", { error: "Could not answer the question" })),
    );
    await act(async () => FakeRequest.last.finish());

    expect(screen.getByText("Could not answer the question")).toBeOnTheScreen();
    expect(screen.getByText("Anything?")).toBeOnTheScreen();
    expect(screen.queryByText("Thinking…")).toBeNull();
    expect(screen.getByLabelText("Send")).toBeOnTheScreen();
  });

  it.each([
    ["the server refuses", () => FakeRequest.last.finish(500), "Couldn't ask (500)"],
    [
      "the server can't be reached",
      () => FakeRequest.last.onerror?.(),
      "Couldn't reach the server",
    ],
    [
      "the answer ends without its sources",
      () => {
        FakeRequest.last.receive(text("Half"));
        FakeRequest.last.finish();
      },
      "The answer was cut off",
    ],
    [
      "an event can't be read",
      () => FakeRequest.last.receive("event: text\ndata: {oops\n\n"),
      "The answer couldn't be read",
    ],
  ])("shows an error when %s", async (_case, happen, message) => {
    await render(<Chat />);
    await ask("Anything?");

    await act(async () => happen());

    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(screen.getByLabelText("Send")).toBeOnTheScreen();
  });

  it("stops the answer when the screen is closed", async () => {
    await render(<Chat />);
    await ask("Long answer?");
    await act(async () => FakeRequest.last.receive(text("Once upon")));

    await act(async () => screen.unmount());

    expect(FakeRequest.last.aborted).toBe(true);
  });

  it("sends only one question when Send is pressed twice at once", async () => {
    await render(<Chat />);
    await act(async () => fireEvent.changeText(screen.getByLabelText("Question"), "Twice?"));

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Send"));
      fireEvent.press(screen.getByLabelText("Send"));
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("shows an error when the conversation can't be started", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await render(<Chat />);

    await ask("Hello?");

    expect(screen.getByText("Couldn't start the chat (500)")).toBeOnTheScreen();
  });

  it("does not send an empty question", async () => {
    await render(<Chat />);

    await act(async () => fireEvent.press(screen.getByLabelText("Send")));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("asks a suggested question when it is tapped", async () => {
    await render(<Chat />);

    await act(async () => fireEvent.press(screen.getByText("Summarize the key numbers")));

    expect(JSON.parse(FakeRequest.last.body)).toEqual({ question: "Summarize the key numbers" });
  });

  it("stops the answer and keeps what was written", async () => {
    await render(<Chat />);
    await ask("Long answer?");
    await act(async () => FakeRequest.last.receive(text("Once upon")));

    await act(async () => fireEvent.press(screen.getByLabelText("Stop")));

    expect(FakeRequest.last.aborted).toBe(true);
    expect(screen.getByText("Once upon")).toBeOnTheScreen();
    expect(screen.getByText("Stopped")).toBeOnTheScreen();
    expect(screen.getByLabelText("Send")).toBeOnTheScreen();
  });

  it("asks a failed question again", async () => {
    await render(<Chat />);
    await ask("Anything?");
    await act(async () => FakeRequest.last.finish(500));
    const failed = FakeRequest.last;

    await act(async () => fireEvent.press(screen.getByText("Try again")));

    expect(FakeRequest.last).not.toBe(failed);
    expect(JSON.parse(FakeRequest.last.body)).toEqual({ question: "Anything?" });
    expect(screen.getAllByText("Anything?")).toHaveLength(1);
    expect(screen.queryByText("Couldn't ask (500)")).toBeNull();
  });

  it("starts a new conversation on New chat", async () => {
    await render(<Chat />);
    await ask("First?");
    await act(async () => FakeRequest.last.receive(text("One.") + event("done", { sources: [] })));
    await act(async () => FakeRequest.last.finish());

    await act(async () => fireEvent.press(screen.getByText("New chat")));
    expect(screen.queryByText("First?")).toBeNull();
    expect(screen.getByText("Ask about your documents")).toBeOnTheScreen();

    await ask("Second?");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("copies a finished answer", async () => {
    await render(<Chat />);
    await ask("Q1?");
    await act(async () => FakeRequest.last.receive(text("5M.") + event("done", { sources: [] })));
    await act(async () => FakeRequest.last.finish());

    await act(async () => fireEvent.press(screen.getByLabelText("Copy answer")));

    expect(mockSetString).toHaveBeenCalledWith("5M.");
  });

  it("opens a saved chat and carries on in it", async () => {
    mockParams.id = "c9";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [
          { role: "user", content: "Q1 revenue?", sources: null },
          { role: "assistant", content: "It was 5M.", sources: [source] },
        ],
      }),
    });
    await render(<Chat />);

    expect(await screen.findByText("It was 5M.")).toBeOnTheScreen();
    expect(screen.getByText("Q1 revenue?")).toBeOnTheScreen();
    expect(screen.getByText("report.pdf · p. 3")).toBeOnTheScreen();

    await ask("And Q2?");
    // no new conversation: the question goes to the saved one
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(FakeRequest.last.url).toBe("http://test-server/conversations/c9/messages");
  });

  it("shows an error when a saved chat can't be opened", async () => {
    mockParams.id = "c9";
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await render(<Chat />);

    expect(await screen.findByText("Couldn't open the chat (404)")).toBeOnTheScreen();
    expect(screen.queryByText("Try again")).toBeNull();
  });
});
