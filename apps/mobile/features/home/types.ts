import type { ListedConversation } from "@multimodal-rag/shared";
import type { ServerStatus } from "~/features/server/useServerStatus";

type Screen = "/chat" | "/documents" | "/conversations";

export type HomeViewProps = {
  status: ServerStatus;
  retry: () => void;
  open: (screen: Screen) => void;
  recent: ListedConversation[]; // the latest chats, at most RECENT_CHATS
  openChat: (id: string) => void;
  name: string | null;
  rename?: () => void; // undefined where the platform can't ask for text (Android)
};
