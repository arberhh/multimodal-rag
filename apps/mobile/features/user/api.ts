import type { MeResponse, NameBody, User } from "@multimodal-rag/shared";
import { apiFetch } from "~/features/server/apiFetch";

export async function getMe(): Promise<User> {
  const res = await apiFetch("/me");
  if (!res.ok) throw new Error(`Couldn't load you (${res.status})`);
  const body: MeResponse = await res.json();
  return body.user;
}

export async function saveName(name: string): Promise<User> {
  const res = await apiFetch("/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name } satisfies NameBody),
  });
  if (!res.ok) throw new Error(`Couldn't save your name (${res.status})`);
  const body: MeResponse = await res.json();
  return body.user;
}
