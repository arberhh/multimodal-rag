import { FlatList, type ListRenderItemInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "~/features/theme";
import type { Document, DocumentStatus } from "./api";
import { formatSize, statusLabel } from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

// web has no SwiftUI or Compose, so this one is plain React Native views
export function DocumentsWeb({ docs, uploading, error, addPdf, removePdf }: DocumentsViewProps) {
  const renderDocument = ({ item }: ListRenderItemInfo<Document>) => (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {item.file_name}
        </Text>
        <Text style={styles.muted}>{formatSize(item.size_bytes)}</Text>
      </View>
      <View style={styles.status}>
        <View style={[styles.dot, { backgroundColor: dotColor[item.status] }]} />
        <Text>{statusLabel[item.status]}</Text>
      </View>
      <Pressable onPress={() => removePdf(item)} accessibilityLabel={`Remove ${item.file_name}`}>
        <Text style={styles.remove}>Remove</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <Pressable
        onPress={addPdf}
        disabled={uploading}
        style={[styles.button, uploading && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{uploading ? "Uploading…" : "Add PDF"}</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={docs}
        keyExtractor={keyExtractor}
        ListEmptyComponent={<Text style={styles.muted}>No documents yet.</Text>}
        renderItem={renderDocument}
      />
    </View>
  );
}

function keyExtractor(doc: Document) {
  return doc.id;
}

const dotColor: Record<DocumentStatus, string> = {
  processing: colors.pending,
  ready: colors.connected,
  failed: colors.unreachable,
};

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.buttonBackground,
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.buttonText, fontWeight: "600" },
  container: {
    backgroundColor: colors.background,
    flex: 1,
    gap: 16,
    minHeight: "100%",
    padding: 24,
  },
  dot: { borderRadius: 5, height: 10, width: 10 },
  error: { color: colors.unreachable },
  muted: { color: colors.muted, fontSize: 13 },
  name: { fontSize: 16, fontWeight: "500" },
  remove: { color: colors.unreachable },
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
