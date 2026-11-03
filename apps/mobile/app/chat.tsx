import { ChatView } from "~/features/chat/ChatView";
import { useChat } from "~/features/chat/useChat";

export default function Chat() {
  return <ChatView {...useChat()} />;
}
