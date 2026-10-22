import { One } from "one";
import { colors } from "~/features/theme";
import { formatSize, statusLabel } from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

// Jetpack Compose: Material 3 rows. `style` only goes on the root, nested nodes use composeStyle.
export function DocumentsAndroid({ docs, uploading, error, addPdf }: DocumentsViewProps) {
  const { Button, CircularProgressIndicator, LazyColumn, ListItem, Text } = One.Android;

  return (
    <LazyColumn style={{ flex: 1 }} contentPadding={{ top: 16, bottom: 16 }}>
      <Button
        label={uploading ? "Uploading…" : "Add PDF"}
        icon="add"
        disabled={uploading}
        onPress={addPdf}
        composeStyle={{ paddingLeft: 16, paddingRight: 16, fillMaxWidth: true }}
      />

      {error && (
        <Text text={error} composeStyle={{ padding: 16, foregroundColor: colors.unreachable }} />
      )}
      {docs.length === 0 && <Text text="No documents yet." composeStyle={{ padding: 16 }} />}

      {docs.map((doc) => (
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
              <CircularProgressIndicator composeStyle={{ width: 24, height: 24 }} />
            )}
          </ListItem.TrailingContent>
        </ListItem>
      ))}
    </LazyColumn>
  );
}
