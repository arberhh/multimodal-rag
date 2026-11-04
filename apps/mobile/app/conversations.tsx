import { One, useRouter } from "one";
import { ConversationsAndroid } from "~/features/conversations/ConversationsAndroid";
import { ConversationsIOS } from "~/features/conversations/ConversationsIOS";
import { ConversationsWeb } from "~/features/conversations/ConversationsWeb";
import { useConversations } from "~/features/conversations/useConversations";

// SwiftUI and Compose views throw on the wrong platform, so pick one per platform
const views = { ios: ConversationsIOS, android: ConversationsAndroid, web: ConversationsWeb };

// the server lists at most 100; enough for now, with no paging
const ALL_CHATS = 100;

export default function Conversations() {
  const ConversationsView = views[One.platform];
  const router = useRouter();
  return (
    <ConversationsView
      {...useConversations(ALL_CHATS)}
      openChat={(id) => router.push({ pathname: "/chat", params: { id } })}
    />
  );
}
