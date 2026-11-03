import { One, useRouter } from "one";
import { HomeAndroid } from "~/features/home/HomeAndroid";
import { HomeIOS } from "~/features/home/HomeIOS";
import { HomeWeb } from "~/features/home/HomeWeb";
import { useServer } from "~/features/server/ServerStatus";

// SwiftUI and Compose views throw on the wrong platform, so pick one per platform
const views = { ios: HomeIOS, android: HomeAndroid, web: HomeWeb };

export default function Index() {
  const HomeView = views[One.platform];
  const router = useRouter();
  return <HomeView {...useServer()} open={(destination) => router.push(destination)} />;
}
