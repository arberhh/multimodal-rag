import { useFocusEffect } from "one";
import { useCallback, useState } from "react";
import { confirmRemove } from "~/features/confirmRemove";
import { type Conversation, deleteConversation, listConversations } from "./api";

// The user's latest chats. Loaded again each time the screen comes into view, so a chat just
// asked in moves to the top on the way back, and when the server can be reached again (enabled)
export function useConversations(limit: number, enabled = true) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let current = true;
      const load = async () => {
        try {
          const latest = await listConversations(limit);
          if (!current) return;
          setConversations(latest);
          setError(null);
        } catch (err) {
          if (current) setError(err instanceof Error ? err.message : "Couldn't load your chats");
        } finally {
          if (current) setLoaded(true);
        }
      };
      load();
      return () => {
        current = false;
      };
    }, [limit, enabled]),
  );

  const remove = (conversation: Conversation) => {
    confirmRemove(`"${conversation.title}"`, async () => {
      setError(null);
      try {
        await deleteConversation(conversation.id);
        setConversations((list) => list.filter((c) => c.id !== conversation.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove the chat");
      }
    });
  };

  return { conversations, loaded, error, remove };
}

export type ConversationsState = ReturnType<typeof useConversations>;
