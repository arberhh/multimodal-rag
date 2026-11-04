import { deviceId } from "~/features/server/deviceId";

const mockStore = new Map<string, string>();
jest.mock("one", () => ({
  One: {
    platform: "web",
    Storage: {
      getItem: (key: string) => mockStore.get(key) ?? null,
      setItem: (key: string, value: string) => mockStore.set(key, value),
    },
  },
}));

// the same check the server makes
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => mockStore.clear());

describe("device id", () => {
  it("is made once, then kept", () => {
    const id = deviceId();

    expect(id).toMatch(UUID);
    expect(deviceId()).toBe(id);
  });

  it("is made from random bytes where crypto.randomUUID is missing, as on http", () => {
    // hides the one crypto has, as a browser outside https and localhost does
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      expect(deviceId()).toMatch(UUID);
    } finally {
      Reflect.deleteProperty(crypto, "randomUUID");
    }
  });
});
