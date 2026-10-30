import { One } from "one";
import { StyleSheet } from "react-native";
import { colors } from "~/features/theme";
import type { Document } from "./api";
import { formatSize, statusLabel } from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

// `style` only works on the root view; nested Compose views take composeStyle
export function DocumentsAndroid({ docs, uploading, error, addPdf }: DocumentsViewProps) {
  const { Button, LazyColumn, Text } = One.Android;

  return (
    <LazyColumn style={styles.list} contentPadding={listPadding}>
      <Button
        label={uploading ? "Uploading…" : "Add PDF"}
        icon="add"
        disabled={uploading}
        onPress={addPdf}
        composeStyle={composeStyles.button}
      />

      {error && <Text text={error} composeStyle={composeStyles.error} />}
      {docs.length === 0 && <Text text="No documents yet." composeStyle={composeStyles.message} />}

      {docs.map(renderDocument)}
    </LazyColumn>
  );
}

function renderDocument(doc: Document) {
  const { CircularProgressIndicator, ListItem, Text } = One.Android;

  return (
    <ListItem key={doc.id}>
      <ListItem.HeadlineContent>
        <Text text={doc.file_name} maxLines={1} />
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Text text={formatSize(doc.size_bytes)} />
      </ListItem.SupportingContent>
      <ListItem.TrailingContent>
        {doc.status === "ready" ? (
          <Text text={statusLabel.ready} />
        ) : (
          <CircularProgressIndicator composeStyle={composeStyles.spinner} />
        )}
      </ListItem.TrailingContent>
    </ListItem>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
});

const listPadding = { top: 16, bottom: 16 };

const composeStyles = {
  button: { paddingLeft: 16, paddingRight: 16, fillMaxWidth: true },
  error: { padding: 16, foregroundColor: colors.unreachable },
  message: { padding: 16 },
  spinner: { width: 24, height: 24 },
};
