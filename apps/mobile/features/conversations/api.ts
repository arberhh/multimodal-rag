import { apiFetch } from "~/features/server/apiFetch";
import type { Source } from "~/features/chat/api";

export type Conversation = { id: string; title: string; updated_at: string };

export type Message = { role: "user" | "assistant"; content: string; sources: Source[] | null };

export async function listConversations(limit: number): Promise<Conversation[]> {
  const res = await apiFetch(`/conversations?limit=${limit}`);
  if (!res.ok) throw new Error(`Couldn't load your chats (${res.status})`);
  return (await res.json()).conversations;
}

export async function getMessages(id: string): Promise<Message[]> {
  const res = await apiFetch(`/conversations/${id}/messages`);
  if (!res.ok) throw new Error(`Couldn't open the chat (${res.status})`);
  return (await res.json()).messages;
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await apiFetch(`/conversations/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Couldn't remove the chat (${res.status})`);
}
