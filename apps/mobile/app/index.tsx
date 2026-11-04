import { One, useRouter } from "one";
import { useConversations } from "~/features/conversations/useConversations";
import { RECENT_CHATS } from "~/features/home/content";
import { HomeAndroid } from "~/features/home/HomeAndroid";
import { HomeIOS } from "~/features/home/HomeIOS";
import { HomeWeb } from "~/features/home/HomeWeb";
import { useServer } from "~/features/server/ServerStatus";
import { useMe } from "~/features/user/useMe";

// SwiftUI and Compose views throw on the wrong platform, so pick one per platform
const views = { ios: HomeIOS, android: HomeAndroid, web: HomeWeb };

export default function Index() {
  const HomeView = views[One.platform];
  const router = useRouter();
  const server = useServer();
  const connected = server.status === "connected";
  const { conversations } = useConversations(RECENT_CHATS, connected);
  const { name, rename } = useMe(connected);

  return (
    <HomeView
      {...server}
      open={(screen) => router.push(screen)}
      recent={conversations}
      openChat={(id) => router.push({ pathname: "/chat", params: { id } })}
      name={name}
      rename={rename}
    />
  );
}
