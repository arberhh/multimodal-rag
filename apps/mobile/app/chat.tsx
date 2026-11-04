import { useLocalSearchParams } from "one";
import { ChatView } from "~/features/chat/ChatView";
import { useChat } from "~/features/chat/useChat";

// /chat starts a new chat; /chat?id=… carries on a saved one
export default function Chat() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ChatView {...useChat(id)} />;
}
