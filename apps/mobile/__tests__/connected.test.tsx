import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Index from "~/app/index";
import { ServerStatusProvider } from "~/features/server/ServerStatus";

// config.ts reads import.meta.env, which Jest can't parse.
jest.mock("~/features/server/config", () => ({ serverUrl: "http://test-server" }));
// one ships ESM that Jest can't load. SwiftUI and Compose views only render in native builds,
// so these tests use the web view.
const mockPush = jest.fn();
jest.mock("one", () => ({
  One: { platform: "web", Storage: { getItem: () => "test-device", setItem() {} } },
  useRouter: () => ({ push: mockPush }),
  // a test has one screen, always in view
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const respond = (body: unknown, ok = true) => ({ ok, json: async () => body });

const recent = [
  { id: "c1", title: "What was Q1 revenue?", updated_at: "2026-11-01T10:00:00Z" },
  { id: "c2", title: "Who signed the contract?", updated_at: "2026-10-30T10:00:00Z" },
];

// a server that is up: each route answers with what it would
const serverUp = (conversations = recent) =>
  mockFetch.mockImplementation(async (url: string) => {
    if (url.endsWith("/health")) return respond({ status: "ok" });
    if (url.includes("/conversations")) return respond({ conversations });
    return respond({ user: { id: "u1", name: "Ada" } });
  });

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
});

const renderHome = () =>
  render(
    <ServerStatusProvider>
      <Index />
    </ServerStatusProvider>,
  );

// ARB-64: open the app and it shows it's connected.
describe("home screen", () => {
  it("shows Checking while the health check is pending", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    await renderHome();

    expect(screen.getByText("Checking…")).toBeOnTheScreen();
  });

  it("shows Connected when the server health check is ok", async () => {
    serverUp();

    await renderHome();

    expect(await screen.findByText("Connected")).toBeOnTheScreen();
    expect(screen.getByText("http://test-server")).toBeOnTheScreen();
    expect(screen.queryByText("Retry")).not.toBeOnTheScreen();
    expect(mockFetch).toHaveBeenCalledWith("http://test-server/health", expect.anything());
  });

  it("shows Not connected with a Retry button when the server is down", async () => {
    mockFetch.mockRejectedValue(new Error("network"));

    await renderHome();

    expect(await screen.findByText("Not connected")).toBeOnTheScreen();
    expect(screen.getByText("Retry")).toBeOnTheScreen();
  });

  it("shows Not connected when the server answers with an error", async () => {
    mockFetch.mockResolvedValue(respond({ status: "ok" }, false));

    await renderHome();

    expect(await screen.findByText("Not connected")).toBeOnTheScreen();
  });

  it("recovers to Connected when Retry is pressed after the server comes back", async () => {
    serverUp();
    mockFetch.mockRejectedValueOnce(new Error("network"));

    await renderHome();
    await screen.findByText("Not connected");

    await act(async () => fireEvent.press(screen.getByText("Retry")));

    expect(await screen.findByText("Connected")).toBeOnTheScreen();
  });

  it("opens Chat and My Documents once connected", async () => {
    serverUp();
    await renderHome();
    await screen.findByText("Connected");

    await act(async () => fireEvent.press(screen.getByText("Chat")));
    await act(async () => fireEvent.press(screen.getByText("My Documents")));

    expect(mockPush.mock.calls).toEqual([["/chat"], ["/documents"]]);
  });

  it("keeps Chat and My Documents shut while the server is down", async () => {
    mockFetch.mockRejectedValue(new Error("network"));
    await renderHome();
    await screen.findByText("Not connected");

    await act(async () => fireEvent.press(screen.getByText("Chat")));

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText(/Can't reach the server/)).toBeOnTheScreen();
  });

  it("says what the app is for", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    await renderHome();

    expect(screen.getByText("Chat with your documents")).toBeOnTheScreen();
    expect(screen.getByText("How it works")).toBeOnTheScreen();
  });

  it("shows the latest chats once connected, and opens one", async () => {
    serverUp();
    await renderHome();

    expect(await screen.findByText("What was Q1 revenue?")).toBeOnTheScreen();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-server/conversations?limit=5",
      expect.objectContaining({ headers: { "X-Device-Id": "test-device" } }),
    );

    await act(async () => fireEvent.press(screen.getByText("What was Q1 revenue?")));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/chat", params: { id: "c1" } });

    await act(async () => fireEvent.press(screen.getByText("All chats")));
    expect(mockPush).toHaveBeenCalledWith("/conversations");
  });

  it("shows no recent chats section before the first chat", async () => {
    serverUp([]);
    await renderHome();
    await screen.findByText("Connected");

    expect(screen.queryByText("Recent chats")).toBeNull();
    // the full list is still one tap away
    expect(screen.getByText("All chats")).toBeOnTheScreen();
  });

  it("shows the user's name", async () => {
    serverUp();
    await renderHome();

    expect(await screen.findByText("Ada")).toBeOnTheScreen();
  });
});
