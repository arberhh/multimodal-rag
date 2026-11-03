import { Slot, Stack, useServerHeadInsertion } from "one";
import { AppRegistry, Platform } from "react-native";
import { ServerStatusBadge, ServerStatusProvider, useServer } from "~/features/server/ServerStatus";
import { serverStatusMenu } from "~/features/server/serverStatusMenu";

export default function Layout() {
  useServerHeadInsertion(() => {
    if (Platform.OS !== "web") {
      return <></>;
    }
    AppRegistry.registerComponent("styles", () => () => null);
    // @ts-expect-error web-only api
    return AppRegistry.getApplication("styles", {}).getStyleElement();
  });

  if (Platform.OS === "web") {
    return (
      <html lang="en-US">
        <head>
          <meta charSet="utf-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
          <title>RAG Chat</title>
          <meta name="description" content="Chat with your PDFs." />
          <link rel="icon" href="/favicon.svg" />
          {/* screens use minHeight: "100%", which needs a parent with a height */}
          <style>{"html, body { height: 100%; }"}</style>
        </head>

        <ServerStatusProvider>
          <Slot />
        </ServerStatusProvider>
      </html>
    );
  }

  return (
    <ServerStatusProvider>
      <AppStack />
    </ServerStatusProvider>
  );
}

// the back button is the arrow alone, without the previous screen's name
const screenOptions = { headerBackButtonDisplayMode: "minimal" } as const;

// The server status sits in the header of every screen. On iOS it's a native bar button with a
// menu; Android headers have no native menu items, so there it's a view that checks again.
function AppStack() {
  const { status, retry } = useServer();

  return (
    <Stack screenOptions={screenOptions}>
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="right">{serverStatusMenu(status, retry)}</Stack.Toolbar>
      ) : (
        <Stack.Toolbar placement="right" asChild>
          <ServerStatusBadge />
        </Stack.Toolbar>
      )}
      {/* not a large title: the header can't see the SwiftUI list scroll, so it would cover it */}
      <Stack.Screen name="index" options={{ title: "RAG Chat" }} />
      <Stack.Screen name="documents" options={{ title: "My Documents" }} />
      <Stack.Screen name="chat" options={{ title: "Chat" }} />
    </Stack>
  );
}
