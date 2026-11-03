import { createContext, type ReactNode, use } from "react";
import { type ColorValue, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, sharedStyles } from "~/features/theme";
import { type ServerStatus, useServerStatus } from "./useServerStatus";

export const statusLabel: Record<ServerStatus, string> = {
  checking: "Checking…",
  connected: "Connected",
  unreachable: "Not connected",
};

export const statusColor: Record<ServerStatus, ColorValue> = {
  checking: colors.pending,
  connected: colors.connected,
  unreachable: colors.unreachable,
};

// a shape as well as a color, so the status reads without telling red from green
export const statusSymbol: Record<ServerStatus, string> = {
  checking: "ellipsis",
  connected: "antenna.radiowaves.left.and.right",
  unreachable: "antenna.radiowaves.left.and.right.slash",
};

type Server = ReturnType<typeof useServerStatus>;

const ServerContext = createContext<Server | null>(null);

// one health check for the whole app: the header and the home screen show the same status
export function ServerStatusProvider({ children }: { children: ReactNode }) {
  const server = useServerStatus();
  return <ServerContext value={server}>{children}</ServerContext>;
}

export function useServer(): Server {
  const server = use(ServerContext);
  if (!server) throw new Error("useServer needs a ServerStatusProvider above it");
  return server;
}

// The status as a dot and a word. Pressing it checks again.
export function ServerStatusBadge() {
  const { status, retry } = useServer();
  return (
    <Pressable
      onPress={retry}
      style={styles.badge}
      accessibilityRole="button"
      accessibilityLabel={`Server ${statusLabel[status]}`}
      accessibilityHint="Checks the connection again"
      testID="server-status"
    >
      <View style={[sharedStyles.dot, { backgroundColor: statusColor[status] }]} />
      <Text style={styles.label}>{statusLabel[status]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", flexDirection: "row", gap: 6, padding: 4 },
  label: { fontSize: 15 },
});
