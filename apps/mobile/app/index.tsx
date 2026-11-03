import { Link } from "one";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, sharedStyles } from "~/features/theme";
import { serverUrl } from "~/features/server/config";
import { type ServerStatus, useServerStatus } from "~/features/server/useServerStatus";

const label: Record<ServerStatus, string> = {
  checking: "Checking…",
  connected: "Connected",
  unreachable: "Not connected",
};

const dotColor: Record<ServerStatus, string> = {
  checking: colors.pending,
  connected: colors.connected,
  unreachable: colors.unreachable,
};

export default function Index() {
  const { status, retry } = useServerStatus();

  return (
    <View style={styles.container}>
      <Text style={sharedStyles.title}>RAG Chat</Text>

      <View style={styles.statusRow} testID="server-status">
        <View style={[sharedStyles.dot, { backgroundColor: dotColor[status] }]} />
        <Text style={styles.statusText}>{label[status]}</Text>
      </View>
      <Text style={styles.url}>{serverUrl}</Text>

      {status === "connected" && (
        // asChild: on web a Link's own style loses its padding. The child's style must be
        // one object, because an array crashes on web
        <>
          <Link href="/chat" asChild>
            <Pressable style={sharedStyles.button}>
              <Text style={sharedStyles.buttonText}>Chat</Text>
            </Pressable>
          </Link>
          <Link href="/documents" asChild>
            <Pressable style={sharedStyles.button}>
              <Text style={sharedStyles.buttonText}>My Documents</Text>
            </Pressable>
          </Link>
        </>
      )}

      {status === "unreachable" && (
        <Pressable onPress={retry} style={sharedStyles.button}>
          <Text style={sharedStyles.buttonText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: "center",
    minHeight: "100%",
    padding: 24,
  },
  statusRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  statusText: { fontSize: 17 },
  url: { color: colors.muted, fontSize: 13 },
});
