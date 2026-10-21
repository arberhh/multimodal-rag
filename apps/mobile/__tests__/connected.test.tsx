import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Index from "~/app/index";

// config.ts reads import.meta.env, which Jest can't parse.
jest.mock("~/features/server/config", () => ({ serverUrl: "http://test-server" }));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const respond = (body: unknown, ok = true) => ({ ok, json: async () => body });

beforeEach(() => mockFetch.mockReset());

// ARB-64: open the app and it shows it's connected.
describe("home screen", () => {
  it("shows Checking while the health check is pending", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    await render(<Index />);

    expect(screen.getByText("Checking…")).toBeOnTheScreen();
  });

  it("shows Connected when the server health check is ok", async () => {
    mockFetch.mockResolvedValue(respond({ status: "ok" }));

    await render(<Index />);

    expect(await screen.findByText("Connected")).toBeOnTheScreen();
    expect(screen.getByText("http://test-server")).toBeOnTheScreen();
    expect(screen.queryByText("Retry")).not.toBeOnTheScreen();
    expect(mockFetch).toHaveBeenCalledWith("http://test-server/health", expect.anything());
  });

  it("shows Not connected with a Retry button when the server is down", async () => {
    mockFetch.mockRejectedValue(new Error("network"));

    await render(<Index />);

    expect(await screen.findByText("Not connected")).toBeOnTheScreen();
    expect(screen.getByText("Retry")).toBeOnTheScreen();
  });

  it("shows Not connected when the server answers with an error", async () => {
    mockFetch.mockResolvedValue(respond({ status: "ok" }, false));

    await render(<Index />);

    expect(await screen.findByText("Not connected")).toBeOnTheScreen();
  });

  it("recovers to Connected when Retry is pressed after the server comes back", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));
    mockFetch.mockResolvedValue(respond({ status: "ok" }));

    await render(<Index />);
    await screen.findByText("Not connected");

    await act(async () => fireEvent.press(screen.getByText("Retry")));

    expect(await screen.findByText("Connected")).toBeOnTheScreen();
  });
});
