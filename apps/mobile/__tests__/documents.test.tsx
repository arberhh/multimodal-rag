import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import Documents from "~/app/documents";

jest.mock("~/features/server/config", () => ({ serverUrl: "http://test-server" }));

// SwiftUI and Compose views only render in native builds, so these tests use the web view.
const mockGetDocument = jest.fn();
jest.mock("one", () => ({
  Link: () => null,
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

  it("shows when a document couldn't be read", async () => {
    mockFetch.mockResolvedValue(respond({ docs: [doc("failed")] }));

    await render(<Documents />);

    expect(await screen.findByText("Couldn't read")).toBeOnTheScreen();
  });
});

// ARB-71: a document becomes ready without reopening the screen.
describe("while a document is being prepared", () => {
  const tick = () =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("asks again until it's ready, then stops", async () => {
    mockFetch.mockResolvedValueOnce(respond({ docs: [doc("processing")] }));
    await render(<Documents />);
    await screen.findByText("Preparing…");

    mockFetch.mockResolvedValueOnce(respond({ docs: [doc("processing")] }));
    await tick();
    expect(screen.getByText("Preparing…")).toBeOnTheScreen();

    mockFetch.mockResolvedValueOnce(respond({ docs: [doc("ready")] }));
    await tick();
    expect(screen.getByText("Ready")).toBeOnTheScreen();

    await tick();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("doesn't ask when nothing is being prepared", async () => {
    mockFetch.mockResolvedValue(respond({ docs: [doc("ready")] }));
    await render(<Documents />);
    await screen.findByText("Ready");

    await tick();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps a document uploaded while the answer was on its way", async () => {
    mockFetch.mockResolvedValueOnce(respond({ docs: [doc("processing")] }));
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///new.pdf", name: "new.pdf" }],
    });
    mockFetch.mockResolvedValueOnce(
      respond({ doc: { ...doc("processing"), id: "2", file_name: "new.pdf" } }),
    );
    await render(<Documents />);
    await screen.findByText("report.pdf");
    await act(async () => fireEvent.press(screen.getByText("Add PDF")));
    await screen.findByText("new.pdf");

    // this list was read before the upload, so it doesn't have new.pdf
    mockFetch.mockResolvedValueOnce(respond({ docs: [doc("ready")] }));
    await tick();

    expect(screen.getByText("new.pdf")).toBeOnTheScreen();
    expect(screen.getByText("Ready")).toBeOnTheScreen();
  });
});

// ARB-71: remove a document you don't need.
describe("removing a document", () => {
  // presses the Remove button of the confirmation
  const confirm = () => {
    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    return act(async () => buttons.find((b) => b.text === "Remove").onPress());
  };

  const pressRemove = async () => {
    await render(<Documents />);
    await screen.findByText("report.pdf");
    await act(async () => fireEvent.press(screen.getByLabelText("Remove report.pdf")));
  };

  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce(respond({ docs: [doc("ready")] }));
  });
  afterEach(() => jest.restoreAllMocks());

  it("does nothing until it's confirmed", async () => {
    await pressRemove();

    expect(Alert.alert).toHaveBeenCalledWith(
      "Remove report.pdf?",
      expect.any(String),
      expect.any(Array),
    );
    expect(screen.getByText("report.pdf")).toBeOnTheScreen();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("removes it from the server and the list", async () => {
    await pressRemove();
    mockFetch.mockResolvedValueOnce(respond({}, true, 204));

    await confirm();

    expect(mockFetch).toHaveBeenCalledWith("http://test-server/uploads/1", { method: "DELETE" });
    expect(await screen.findByText("No documents yet.")).toBeOnTheScreen();
  });

  it("keeps it in the list and shows an error when the server fails", async () => {
    await pressRemove();
    mockFetch.mockResolvedValueOnce(respond({}, false, 500));

    await confirm();

    expect(await screen.findByText("Couldn't remove the document (500)")).toBeOnTheScreen();
    expect(screen.getByText("report.pdf")).toBeOnTheScreen();
  });
});
