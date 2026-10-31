import { Link } from "one";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "~/features/theme";
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
      <Text style={styles.title}>RAG Chat</Text>

      <View style={styles.statusRow} testID="server-status">
        <View style={[styles.dot, { backgroundColor: dotColor[status] }]} />
        <Text style={styles.statusText}>{label[status]}</Text>
      </View>
      <Text style={styles.url}>{serverUrl}</Text>

      {status === "connected" && (
        <Link href="/documents" style={styles.button}>
          <Text style={styles.buttonText}>My Documents</Text>
        </Link>
      )}

      {status === "unreachable" && (
        <Pressable onPress={retry} style={styles.button}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonText: { color: colors.buttonText, fontWeight: "600" },
  container: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: "center",
    minHeight: "100%",
    padding: 24,
  },
  dot: { borderRadius: 5, height: 10, width: 10 },
  statusRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  statusText: { fontSize: 17 },
  title: { fontSize: 28, fontWeight: "700" },
  url: { color: colors.muted, fontSize: 13 },
});
