import { apiFetch } from "~/features/server/apiFetch";

export type Me = { id: string; name: string | null };

export async function getMe(): Promise<Me> {
  const res = await apiFetch("/me");
  if (!res.ok) throw new Error(`Couldn't load you (${res.status})`);
  return (await res.json()).user;
}

export async function saveName(name: string): Promise<Me> {
  const res = await apiFetch("/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Couldn't save your name (${res.status})`);
  return (await res.json()).user;
}
