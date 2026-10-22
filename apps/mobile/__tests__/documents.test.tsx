import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Documents from "~/app/documents";

jest.mock("~/features/server/config", () => ({ serverUrl: "http://test-server" }));

// SwiftUI and Compose views only render in native builds, so these tests use the web view.
const mockGetDocument = jest.fn();
jest.mock("one", () => ({
  One: {
    platform: "web",
    DocumentPicker: { getDocument: (...args) => mockGetDocument(...args) },
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const respond = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const doc = (status: string) => ({
  id: "1",
  file_name: "report.pdf",
  size_bytes: 2 * 1024 * 1024,
  status,
  created_at: "2026-10-22T00:00:00Z",
});

beforeEach(() => {
  mockFetch.mockReset();
  mockGetDocument.mockReset();
});

// ARB-66: add a PDF and see whether it's preparing or ready.
describe("documents screen", () => {
  it("shows an empty list", async () => {
    mockFetch.mockResolvedValue(respond({ docs: [] }));

    await render(<Documents />);

    expect(await screen.findByText("No documents yet.")).toBeOnTheScreen();
  });

  it("shows each document's status", async () => {
    mockFetch.mockResolvedValue(respond({ docs: [doc("processing")] }));

    await render(<Documents />);

    expect(await screen.findByText("report.pdf")).toBeOnTheScreen();
    expect(screen.getByText("2.0 MB")).toBeOnTheScreen();
    expect(screen.getByText("Preparing…")).toBeOnTheScreen();
  });

  it("uploads the picked PDF and shows it in the list", async () => {
    mockFetch.mockResolvedValueOnce(respond({ docs: [] }));
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///report.pdf", name: "report.pdf" }],
    });
    mockFetch.mockResolvedValueOnce(respond({ doc: doc("processing") }));

    await render(<Documents />);
    await screen.findByText("No documents yet.");
    await act(async () => fireEvent.press(screen.getByText("Add PDF")));

    expect(await screen.findByText("report.pdf")).toBeOnTheScreen();
    expect(screen.getByText("Preparing…")).toBeOnTheScreen();
    // the list isn't fetched again: one load on open, one upload
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockGetDocument).toHaveBeenCalledWith({ type: "application/pdf" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-server/uploads",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does nothing when the picker is canceled", async () => {
    mockFetch.mockResolvedValue(respond({ docs: [] }));
    mockGetDocument.mockResolvedValue({ canceled: true, assets: null });

    await render(<Documents />);
    await screen.findByText("No documents yet.");
    await act(async () => fireEvent.press(screen.getByText("Add PDF")));

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("shows an error when the PDF is too big", async () => {
    mockFetch.mockResolvedValueOnce(respond({ docs: [] }));
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///big.pdf", name: "big.pdf" }],
    });
    mockFetch.mockResolvedValueOnce(respond({}, false, 413));

    await render(<Documents />);
    await screen.findByText("No documents yet.");
    await act(async () => fireEvent.press(screen.getByText("Add PDF")));

    expect(await screen.findByText("That PDF is too big")).toBeOnTheScreen();
  });
});
