import { Link } from "one";
import { FlatList, type ListRenderItemInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, sharedStyles } from "~/features/theme";
import type { Conversation } from "./api";
import { noChatsLabel, whenLabel } from "./labels";
import type { ConversationsViewProps } from "./types";

// web has no SwiftUI or Compose, so this one is plain React Native views
export function ConversationsWeb({
  conversations,
  loaded,
  error,
  remove,
  openChat,
}: ConversationsViewProps) {
  const renderConversation = ({ item }: ListRenderItemInfo<Conversation>) => (
    <View style={styles.row}>
      <Pressable onPress={() => openChat(item.id)} accessibilityRole="button" style={styles.open}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.muted}>{whenLabel(item.updated_at)}</Text>
      </Pressable>
      <Pressable onPress={() => remove(item)} accessibilityLabel={`Remove ${item.title}`}>
        <Text style={styles.remove}>Remove</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.page}>
      <View style={styles.content}>
        <Link href="/" asChild>
          <Pressable>
            <Text style={styles.back}>← Home</Text>
          </Pressable>
        </Link>
        <Text style={sharedStyles.title}>Chats</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <FlatList
          data={conversations}
          keyExtractor={keyExtractor}
          renderItem={renderConversation}
          ListEmptyComponent={loaded ? <Text style={styles.muted}>{noChatsLabel}</Text> : undefined}
        />
      </View>
    </View>
  );
}

function keyExtractor(conversation: Conversation) {
  return conversation.id;
}

// a Pressable's style must be one object, because an array crashes on web
const styles = StyleSheet.create({
  back: { color: colors.muted, fontSize: 14 },
  content: { alignSelf: "center", gap: 16, maxWidth: 640, padding: 24, width: "100%" },
  error: { color: colors.unreachable },
  muted: { color: colors.muted, fontSize: 14 },
  open: { flex: 1, gap: 2 },
  page: { backgroundColor: colors.background, flex: 1, minHeight: "100%" },
  remove: { color: colors.unreachable, fontSize: 14 },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  title: { color: colors.text, fontSize: 16 },
});
