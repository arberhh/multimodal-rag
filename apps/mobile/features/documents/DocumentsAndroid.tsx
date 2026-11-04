import { One } from "one";
import { StyleSheet } from "react-native";
import { colors } from "~/features/theme";
import type { Document } from "@multimodal-rag/shared";
import { addPdfLabel, emptyLabel, formatSize, statusLabel } from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

// `style` only works on the root view; nested Compose views take composeStyle
export function DocumentsAndroid({
  docs,
  uploading,
  error,
  addPdf,
  removePdf,
}: DocumentsViewProps) {
  const { Button, LazyColumn, Text } = One.Android;

  return (
    <LazyColumn style={styles.list} contentPadding={listPadding}>
      <Button
        label={addPdfLabel(uploading)}
        icon="add"
        disabled={uploading}
        onPress={addPdf}
        composeStyle={composeStyles.button}
      />

      {error && <Text text={error} composeStyle={composeStyles.error} />}
      {docs.length === 0 && <Text text={emptyLabel} composeStyle={composeStyles.message} />}

      {docs.map((doc) => renderDocument(doc, removePdf))}
    </LazyColumn>
  );
}

function renderDocument(doc: Document, removePdf: DocumentsViewProps["removePdf"]) {
  const { CircularProgressIndicator, Icon, IconButton, ListItem, Row, Text } = One.Android;

  return (
    <ListItem key={doc.id}>
      <ListItem.HeadlineContent>
        <Text text={doc.file_name} maxLines={1} />
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Text text={formatSize(doc.size_bytes)} />
      </ListItem.SupportingContent>
      <ListItem.TrailingContent>
        <Row verticalAlignment="centerVertically" spacing={4}>
          {doc.status === "processing" ? (
            <CircularProgressIndicator composeStyle={composeStyles.spinner} />
          ) : (
            <Text
              text={statusLabel[doc.status]}
              composeStyle={doc.status === "failed" ? composeStyles.failed : undefined}
            />
          )}
          <IconButton onClick={() => removePdf(doc)}>
            <Icon name="delete" />
          </IconButton>
        </Row>
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
  failed: { foregroundColor: colors.unreachable },
  message: { padding: 16 },
  spinner: { width: 24, height: 24 },
};
