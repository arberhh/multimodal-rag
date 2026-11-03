import { One } from "one";

const KEY = "device-id";
let cached: string | null = null;

// This install's id: made once, then kept. The server knows the user by it. On iOS and Android it
// sits in the keychain or keystore, since it works like a password; web has no secure store, so
// it goes in localStorage. crypto.randomUUID is the browser's on web, and One's on native
export function deviceId(): string {
  if (cached) return cached;
  const store =
    One.platform === "web"
      ? { get: One.Storage.getItem, set: One.Storage.setItem }
      : { get: One.SecureStore.getItemSync, set: One.SecureStore.setItemSync };

  let id = store.get(KEY);
  if (!id) {
    id = crypto.randomUUID();
    store.set(KEY, id);
  }
  cached = id;
  return id;
}
