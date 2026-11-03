import { One, Stack } from "one";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ServerStatusBadge, useServer } from "~/features/server/ServerStatus";
import { serverStatusMenu } from "~/features/server/serverStatusMenu";
import { colors } from "~/features/theme";

type Props = { canStartOver: boolean; startOver: () => void };

// A New chat button beside the server status in the header. The screen's toolbar replaces the
// layout's, so it carries the status too. Web has no native header: its button is on the page
export function ChatHeader(props: Props) {
  if (One.platform === "web") return null;
  return <NativeChatHeader {...props} />;
}

function NativeChatHeader({ canStartOver, startOver }: Props) {
  const { status, retry } = useServer();

  if (One.platform === "ios") {
    return (
      <Stack.Toolbar placement="right">
        {serverStatusMenu(status, retry)}
        <Stack.Toolbar.Button
          icon="square.and.pencil"
          onPress={startOver}
          disabled={!canStartOver}
          accessibilityLabel="New chat"
        />
      </Stack.Toolbar>
    );
  }

  return (
    <Stack.Toolbar placement="right" asChild>
      <View style={styles.row}>
        <Pressable
          onPress={startOver}
          disabled={!canStartOver}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={canStartOver ? styles.newChat : styles.newChatOff}>New chat</Text>
        </Pressable>
        <ServerStatusBadge />
      </View>
    </Stack.Toolbar>
  );
}

const newChat = { color: colors.accent, fontSize: 15, fontWeight: "600" } as const;

const styles = StyleSheet.create({
  newChat,
  newChatOff: { ...newChat, opacity: 0.4 },
  row: { alignItems: "center", flexDirection: "row", gap: 12 },
});
