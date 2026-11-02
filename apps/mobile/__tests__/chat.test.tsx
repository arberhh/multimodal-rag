import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Chat from "~/app/chat";
import { parseEvents } from "~/features/chat/sse";
import { parseMarkdown, parseSpans } from "~/features/chat/parseMarkdown";

jest.mock("~/features/server/config", () => ({ serverUrl: "http://test-server" }));
jest.mock("one", () => ({ Link: () => null, useSafeAreaInsets: () => ({ bottom: 0 }) }));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// A request the test feeds by hand, so it can check the screen between two pieces of the answer.
class FakeRequest {
  static last: FakeRequest;
  status = 200;
  responseText = "";
  body = "";
  url = "";
  onprogress?: () => void;
  onload?: () => void;
  onerror?: () => void;

  open(_method: string, url: string) {
    this.url = url;
    FakeRequest.last = this;
  }
  setRequestHeader() {}
  send(body: string) {
    this.body = body;
  }

  receive(chunk: string) {
    this.responseText += chunk;
    this.onprogress?.();
  }
  finish() {
    this.onload?.();
  }
}
global.XMLHttpRequest = FakeRequest as never;

const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const text = (piece: string) => event("text", { text: piece });
const source = { documentId: "d1", fileName: "report.pdf", page: 3 };

const ask = async (question: string) => {
  await act(async () => fireEvent.changeText(screen.getByLabelText("Question"), question));
  await act(async () => fireEvent.press(screen.getByLabelText("Send")));
};

beforeEach(() => {
  mockFetch.mockReset();
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
});

// ARB-72: ask a question and get the answer with its sources.
describe("chat screen", () => {
  it("starts empty", async () => {
    await render(<Chat />);

    expect(screen.getByText("Ask a question about your documents.")).toBeOnTheScreen();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows the answer as it is written, then its sources", async () => {
    await render(<Chat />);
    await ask("What was Q1 revenue?");

    expect(screen.getByText("What was Q1 revenue?")).toBeOnTheScreen();
    expect(screen.getByText("Thinking…")).toBeOnTheScreen();
    // the conversation is started by the first question, and the question goes to it
    expect(mockFetch).toHaveBeenCalledWith("http://test-server/conversations", { method: "POST" });
    expect(FakeRequest.last.url).toBe("http://test-server/conversations/c1/messages");
    expect(JSON.parse(FakeRequest.last.body)).toEqual({ question: "What was Q1 revenue?" });

    await act(async () => FakeRequest.last.receive(text("Q1 revenue ")));
    expect(screen.getByText("Q1 revenue")).toBeOnTheScreen();
    expect(screen.queryByText("Thinking…")).toBeNull();
    expect(screen.queryByText("Sources")).toBeNull();

    await act(async () =>
      FakeRequest.last.receive(text("was 5M.") + event("done", { sources: [source] })),
    );
    await act(async () => FakeRequest.last.finish());

    expect(screen.getByText("Q1 revenue was 5M.")).toBeOnTheScreen();
    expect(screen.getByText("Sources")).toBeOnTheScreen();
    expect(screen.getByText("report.pdf · p. 3")).toBeOnTheScreen();
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
    expect(screen.getByText("Send")).toBeOnTheScreen();
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
});
