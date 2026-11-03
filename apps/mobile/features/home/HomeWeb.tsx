import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { serverUrl } from "~/features/server/config";
import { ServerStatusBadge } from "~/features/server/ServerStatus";
import { colors, sharedStyles } from "~/features/theme";
import { whenLabel } from "~/features/conversations/labels";
import {
  destinations,
  howItWorks,
  intro,
  nameLabel,
  noNameLabel,
  reachLabel,
  recentTitle,
  steps,
} from "./content";
import type { HomeViewProps } from "./types";

// web has no native header, so the server status sits on the page
export function HomeWeb({ status, retry, open, recent, openChat, name, rename }: HomeViewProps) {
  const ready = status === "connected";

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={sharedStyles.title}>RAG Chat</Text>
        <ServerStatusBadge />
      </View>
      <Text style={styles.url}>{serverUrl}</Text>

      <Text style={styles.introTitle}>{intro.title}</Text>
      <Text style={styles.muted}>{intro.detail}</Text>

      <View style={styles.card}>
        {destinations.map((destination) => (
          <Pressable
            key={destination.href}
            onPress={() => open(destination.href)}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            style={ready ? styles.row : styles.rowDisabled}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{destination.title}</Text>
              <Text style={styles.muted}>{destination.detail}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      {!ready && <Text style={styles.muted}>{reachLabel[status]}</Text>}
      {status === "unreachable" && (
        <Pressable onPress={retry} style={sharedStyles.button}>
          <Text style={sharedStyles.buttonText}>Retry</Text>
        </Pressable>
      )}

      {ready && recent.length > 0 && (
        <>
          <Text style={styles.heading}>{recentTitle}</Text>
          <View style={styles.card}>
            {recent.map((conversation) => (
              <Pressable
                key={conversation.id}
                onPress={() => openChat(conversation.id)}
                accessibilityRole="button"
                style={styles.row}
              >
                <Text style={styles.chatTitle} numberOfLines={1}>
                  {conversation.title}
                </Text>
                <Text style={styles.muted}>{whenLabel(conversation.updated_at)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {ready && rename && (
        <Pressable onPress={rename} accessibilityRole="button" style={styles.nameRow}>
          <Text style={styles.rowTitle}>{nameLabel}</Text>
          <Text style={styles.muted}>{name ?? noNameLabel}</Text>
        </Pressable>
      )}

      <Text style={styles.heading}>{howItWorks}</Text>
      {steps.map((step) => (
        <View key={step.title} style={styles.step}>
          <Text style={styles.rowTitle}>{step.title}</Text>
          <Text style={styles.muted}>{step.detail}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const row = {
  alignItems: "center",
  flexDirection: "row",
  gap: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
} as const;

// a Pressable's style must be one object, because an array crashes on web
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
  chatTitle: { color: colors.text, flex: 1, fontSize: 17 },
  chevron: { color: colors.muted, fontSize: 24 },
  content: { alignSelf: "center", gap: 12, maxWidth: 560, padding: 24, width: "100%" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  heading: { fontSize: 17, fontWeight: "600", marginTop: 12 },
  introTitle: { fontSize: 20, fontWeight: "600", marginTop: 12 },
  muted: { color: colors.muted, fontSize: 15 },
  nameRow: { ...row, backgroundColor: colors.surface, borderRadius: 12 },
  page: { backgroundColor: colors.background, minHeight: "100%" },
  row,
  rowDisabled: { ...row, opacity: 0.5 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17 },
  step: { gap: 2 },
  url: { color: colors.muted, fontSize: 13 },
});
