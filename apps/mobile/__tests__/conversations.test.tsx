import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";
import Conversations from "~/app/conversations";
import { toTurns } from "~/features/chat/useChat";
import { whenLabel } from "~/features/conversations/labels";

jest.mock("~/features/server/config", () => ({ serverUrl: "http://test-server" }));

// SwiftUI and Compose views only render in native builds, so these tests use the web view.
const mockPush = jest.fn();
jest.mock("one", () => ({
  Link: () => null,
  One: { platform: "web", Storage: { getItem: () => "test-device", setItem() {} } },
  useRouter: () => ({ push: mockPush }),
  // a test has one screen, always in view
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const respond = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const chat = { id: "c1", title: "What was Q1 revenue?", updated_at: "2026-11-01T10:00:00Z" };

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
});

describe("chats list", () => {
  it("lists the user's chats and opens one", async () => {
    mockFetch.mockResolvedValue(respond({ conversations: [chat] }));
    await render(<Conversations />);

    expect(await screen.findByText("What was Q1 revenue?")).toBeOnTheScreen();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-server/conversations?limit=100",
      expect.objectContaining({ headers: { "X-Device-Id": "test-device" } }),
    );

    await act(async () => fireEvent.press(screen.getByText("What was Q1 revenue?")));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/chat", params: { id: "c1" } });
  });

  it("says so when there are no chats yet", async () => {
    mockFetch.mockResolvedValue(respond({ conversations: [] }));
    await render(<Conversations />);

    expect(await screen.findByText(/No chats yet/)).toBeOnTheScreen();
  });

  it("removes a chat once it's confirmed", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce(respond({ conversations: [chat] }));
    await render(<Conversations />);
    await screen.findByText("What was Q1 revenue?");

    await act(async () => fireEvent.press(screen.getByLabelText("Remove What was Q1 revenue?")));
    mockFetch.mockResolvedValueOnce(respond({}, true, 204));
    const buttons: AlertButton[] = alert.mock.calls[0][2] ?? [];
    await act(async () => buttons.find((b) => b.text === "Remove")?.onPress?.());

    expect(mockFetch).toHaveBeenLastCalledWith("http://test-server/conversations/c1", {
      method: "DELETE",
      headers: { "X-Device-Id": "test-device" },
    });
    expect(screen.queryByText("What was Q1 revenue?")).toBeNull();
    alert.mockRestore();
  });

  it("shows an error when the chats can't be loaded", async () => {
    mockFetch.mockResolvedValue(respond({}, false, 500));
    await render(<Conversations />);

    expect(await screen.findByText("Couldn't load your chats (500)")).toBeOnTheScreen();
  });
});

describe("saved chats", () => {
  it("pairs each question with the answer after it", () => {
    const sources = [{ documentId: "d1", fileName: "report.pdf", page: 3 }];
    expect(
      toTurns([
        { role: "user", content: "Q1?", sources: null },
        { role: "assistant", content: "5M.", sources },
        { role: "user", content: "Q2?", sources: null },
      ]),
    ).toEqual([
      { question: "Q1?", answer: "5M.", sources },
      { question: "Q2?", answer: "" },
    ]);
  });

  it("shows the time for today and the date before that", () => {
    const now = new Date("2026-11-03T15:00:00");
    expect(whenLabel("2026-11-03T09:30:00", now)).toMatch(/09:30|9:30/);
    expect(whenLabel("2026-10-30T09:30:00", now)).toMatch(/30/);
  });
});
