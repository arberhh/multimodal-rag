import { Link } from "one";
import {
  type ColorValue,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, sharedStyles } from "~/features/theme";
import type { Document, DocumentStatus } from "@multimodal-rag/shared";
import { addFileLabel, addGoogleDocLabel, emptyLabel, formatSize, statusLabel } from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

// web has no SwiftUI or Compose, so this one is plain React Native views
export function DocumentsWeb({
  docs,
  uploading,
  error,
  addFile,
  addGoogleDoc,
  removeDocument,
}: DocumentsViewProps) {
  const renderDocument = ({ item }: ListRenderItemInfo<Document>) => (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {item.file_name}
        </Text>
        <Text style={styles.muted}>{formatSize(item.size_bytes)}</Text>
      </View>
      <View style={styles.status}>
        <View style={[sharedStyles.dot, { backgroundColor: dotColor[item.status] }]} />
        <Text>{statusLabel[item.status]}</Text>
      </View>
      <Pressable
        onPress={() => removeDocument(item)}
        accessibilityLabel={`Remove ${item.file_name}`}
      >
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

        <View style={styles.header}>
          <Text style={sharedStyles.title}>My Documents</Text>
          <Pressable
            onPress={addFile}
            disabled={uploading}
            style={[sharedStyles.button, uploading && styles.buttonDisabled]}
          >
            <Text style={sharedStyles.buttonText}>{addFileLabel(uploading)}</Text>
          </Pressable>
        </View>
        {addGoogleDoc && (
          <Pressable onPress={addGoogleDoc} disabled={uploading} accessibilityRole="button">
            <Text style={styles.link}>{addGoogleDocLabel}</Text>
          </Pressable>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={docs}
          keyExtractor={keyExtractor}
          ListEmptyComponent={<Text style={styles.muted}>{emptyLabel}</Text>}
          renderItem={renderDocument}
        />
      </View>
    </View>
  );
}

function keyExtractor(doc: Document) {
  return doc.id;
}

const dotColor: Record<DocumentStatus, ColorValue> = {
  processing: colors.pending,
  ready: colors.connected,
  failed: colors.unreachable,
};

const styles = StyleSheet.create({
  back: { color: colors.muted, fontSize: 14 },
  buttonDisabled: { opacity: 0.5 },
  // a readable column, however wide the window is
  content: { gap: 16, maxWidth: 640, width: "100%" },
  error: { color: colors.unreachable },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  link: { color: colors.accent, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 13 },
  name: { fontSize: 16, fontWeight: "500" },
  page: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    minHeight: "100%",
    padding: 24,
  },
  remove: { color: colors.muted, fontSize: 13 },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  rowText: { flex: 1, gap: 2 },
  status: { alignItems: "center", flexDirection: "row", gap: 6 },
});
