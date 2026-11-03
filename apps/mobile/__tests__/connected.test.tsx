import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Index from "~/app/index";
import { ServerStatusProvider } from "~/features/server/ServerStatus";

// config.ts reads import.meta.env, which Jest can't parse.
jest.mock("~/features/server/config", () => ({ serverUrl: "http://test-server" }));
// one ships ESM that Jest can't load. SwiftUI and Compose views only render in native builds,
// so these tests use the web view.
const mockPush = jest.fn();
jest.mock("one", () => ({ One: { platform: "web" }, useRouter: () => ({ push: mockPush }) }));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const respond = (body: unknown, ok = true) => ({ ok, json: async () => body });

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
    mockFetch.mockResolvedValue(respond({ status: "ok" }));

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
    mockFetch.mockRejectedValueOnce(new Error("network"));
    mockFetch.mockResolvedValue(respond({ status: "ok" }));

    await renderHome();
    await screen.findByText("Not connected");

    await act(async () => fireEvent.press(screen.getByText("Retry")));

    expect(await screen.findByText("Connected")).toBeOnTheScreen();
  });

  it("opens Chat and My Documents once connected", async () => {
    mockFetch.mockResolvedValue(respond({ status: "ok" }));
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

    expect(screen.getByText("Chat with your PDFs")).toBeOnTheScreen();
    expect(screen.getByText("How it works")).toBeOnTheScreen();
  });
});
