import { One } from "one";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { colors } from "~/features/theme";
import type { Document } from "@multimodal-rag/shared";
import {
  addFileLabel,
  addGoogleDocLabel,
  emptyLabel,
  formatSize,
  googleDocLinkLabel,
  googleDocMessage,
  pasteLabel,
  statusLabel,
} from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

// `style` only works on the root view; nested Compose views take composeStyle
export function DocumentsAndroid({
  docs,
  uploading,
  error,
  addFile,
  addGoogleDocLink,
  removeDocument,
}: DocumentsViewProps) {
  const { Button, LazyColumn, Row, Text, TextField } = One.Android;
  // Android has no text prompt, so the Google Docs link is typed or pasted into a field here
  const [link, setLink] = useState("");

  const paste = async () => {
    try {
      setLink(await One.Clipboard.getString());
    } catch {
      // nothing to paste, and the field stays as it was
    }
  };

  const addLink = async () => {
    if (await addGoogleDocLink(link)) setLink("");
  };

  return (
    <LazyColumn style={styles.list} contentPadding={listPadding}>
      <Button
        label={addFileLabel(uploading)}
        icon="add"
        disabled={uploading}
        onPress={addFile}
        composeStyle={composeStyles.button}
      />

      <TextField
        text={link}
        onTextChange={setLink}
        label={googleDocLinkLabel}
        placeholder="https://docs.google.com/document/d/…"
        variant="outlined"
        keyboardType="url"
        imeAction="done"
        onSubmit={addLink}
        disabled={uploading}
        composeStyle={composeStyles.field}
      />
      <Text text={googleDocMessage} composeStyle={composeStyles.hint} />
      <Row spacing={8} composeStyle={composeStyles.linkButtons}>
        <Button label={pasteLabel} icon="content_paste" variant="outlined" onPress={paste} />
        <Button
          label={addGoogleDocLabel}
          icon="add_link"
          disabled={uploading || link.trim() === ""}
          onPress={addLink}
        />
      </Row>

      {error && <Text text={error} composeStyle={composeStyles.error} />}
      {docs.length === 0 && <Text text={emptyLabel} composeStyle={composeStyles.message} />}

      {docs.map((doc) => renderDocument(doc, removeDocument))}
    </LazyColumn>
  );
}

function renderDocument(doc: Document, removeDocument: DocumentsViewProps["removeDocument"]) {
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
          <IconButton onClick={() => removeDocument(doc)}>
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
  field: { paddingLeft: 16, paddingRight: 16, paddingTop: 16, fillMaxWidth: true },
  hint: { paddingLeft: 16, paddingRight: 16, paddingTop: 4, foregroundColor: colors.muted },
  linkButtons: { paddingLeft: 16, paddingRight: 16, paddingTop: 8 },
  failed: { foregroundColor: colors.unreachable },
  message: { padding: 16 },
  spinner: { width: 24, height: 24 },
};
