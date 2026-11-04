import type { ConversationsState } from "./useConversations";

export type ConversationsViewProps = ConversationsState & { openChat: (id: string) => void };
