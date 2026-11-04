import { serverUrl } from "./config";
import { deviceId } from "./deviceId";

// fetch for the server's routes: every request says which install it comes from, so the server
// shows each user only their own documents and chats
export function apiFetch(
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
) {
  return fetch(`${serverUrl}${path}`, {
    ...init,
    headers: { ...init.headers, "X-Device-Id": deviceId() },
  });
}
