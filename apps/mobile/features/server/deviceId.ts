import { One } from "one";

const KEY = "device-id";

// A random v4 UUID. Browsers only have crypto.randomUUID on https and localhost, so a web build
// opened by its LAN address makes one from random bytes instead
function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // the RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// This install's id: made once, then kept. The server knows the user by it. On iOS and Android it
// sits in the keychain or keystore, since it works like a password; web has no secure store, so
// it goes in localStorage
export function deviceId(): string {
  const store =
    One.platform === "web"
      ? { get: One.Storage.getItem, set: One.Storage.setItem }
      : { get: One.SecureStore.getItemSync, set: One.SecureStore.setItemSync };

  let id = store.get(KEY);
  if (!id) {
    id = randomId();
    store.set(KEY, id);
  }
  return id;
}
