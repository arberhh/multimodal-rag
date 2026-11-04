import { One } from "one";
import { StyleSheet } from "react-native";
import type { Document } from "@multimodal-rag/shared";
import { addFileLabel, addGoogleDocLabel, emptyLabel, formatSize, statusLabel } from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

export function DocumentsIOS({
  docs,
  uploading,
  error,
  addFile,
  addGoogleDoc,
  removeDocument,
}: DocumentsViewProps) {
  return (
    <One.iOS.List listStyle="insetGrouped" style={styles.list}>
      <One.iOS.Section footer={error ?? ""}>
        <One.iOS.Button
          label={addFileLabel(uploading)}
          systemImage="doc.badge.plus"
          onPress={addFile}
          swiftStyle={uploading ? swiftStyles.disabled : swiftStyles.enabled}
        />
        {addGoogleDoc && (
          <One.iOS.Button
            label={addGoogleDocLabel}
            systemImage="link.badge.plus"
            onPress={addGoogleDoc}
            swiftStyle={uploading ? swiftStyles.disabled : swiftStyles.enabled}
          />
        )}
      </One.iOS.Section>

      <One.iOS.Section title="Documents">
        {docs.length === 0 && <One.iOS.Text text={emptyLabel} />}
        {docs.map((doc) => renderDocument(doc, removeDocument))}
      </One.iOS.Section>
    </One.iOS.List>
  );
}

// LabeledContent takes a value or children, not both, so the size goes in the children
function renderDocument(doc: Document, removeDocument: DocumentsViewProps["removeDocument"]) {
  return (
    <One.iOS.SwipeActions key={doc.id}>
      <One.iOS.LabeledContent label={doc.file_name}>
        <One.iOS.HStack spacing={6}>
          {doc.status === "processing" && <One.iOS.ProgressView />}
          <One.iOS.Text text={`${formatSize(doc.size_bytes)} · ${statusLabel[doc.status]}`} />
        </One.iOS.HStack>
      </One.iOS.LabeledContent>
      <One.iOS.SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
        <One.iOS.Button
          label="Remove"
          systemImage="trash"
          buttonRole="destructive"
          onPress={() => removeDocument(doc)}
        />
      </One.iOS.SwipeActions.Actions>
    </One.iOS.SwipeActions>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
});

const swiftStyles = {
  enabled: { disabled: false },
  disabled: { disabled: true },
};
