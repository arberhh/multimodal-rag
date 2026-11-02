import { Slot, Stack, useServerHeadInsertion } from "one";
import { AppRegistry, Platform } from "react-native";

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

        <Slot />
      </html>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="documents" options={{ title: "My Documents" }} />
    </Stack>
  );
}
