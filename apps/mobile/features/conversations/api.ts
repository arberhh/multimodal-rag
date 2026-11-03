import type {
  ConversationsResponse,
  ListedConversation,
  Message,
  MessagesResponse,
} from "@multimodal-rag/shared";
import { apiFetch } from "~/features/server/apiFetch";

export async function listConversations(limit: number): Promise<ListedConversation[]> {
  const res = await apiFetch(`/conversations?limit=${limit}`);
  if (!res.ok) throw new Error(`Couldn't load your chats (${res.status})`);
  const body: ConversationsResponse = await res.json();
  return body.conversations;
}

export async function getMessages(id: string): Promise<Message[]> {
  const res = await apiFetch(`/conversations/${id}/messages`);
  if (!res.ok) throw new Error(`Couldn't open the chat (${res.status})`);
  const body: MessagesResponse = await res.json();
  return body.messages;
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await apiFetch(`/conversations/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Couldn't remove the chat (${res.status})`);
}
