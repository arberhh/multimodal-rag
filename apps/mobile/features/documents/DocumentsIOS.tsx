import { One } from "one";
import { StyleSheet } from "react-native";
import type { Document } from "./api";
import { addPdfLabel, emptyLabel, formatSize, statusLabel } from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

export function DocumentsIOS({ docs, uploading, error, addPdf, removePdf }: DocumentsViewProps) {
  return (
    <One.iOS.List listStyle="insetGrouped" style={styles.list}>
      <One.iOS.Section footer={error ?? ""}>
        <One.iOS.Button
          label={addPdfLabel(uploading)}
          systemImage="doc.badge.plus"
          onPress={addPdf}
          swiftStyle={uploading ? swiftStyles.disabled : swiftStyles.enabled}
        />
      </One.iOS.Section>

      <One.iOS.Section title="Documents">
        {docs.length === 0 && <One.iOS.Text text={emptyLabel} />}
        {docs.map((doc) => renderDocument(doc, removePdf))}
      </One.iOS.Section>
    </One.iOS.List>
  );
}

// LabeledContent takes a value or children, not both, so the size goes in the children
function renderDocument(doc: Document, removePdf: DocumentsViewProps["removePdf"]) {
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
          onPress={() => removePdf(doc)}
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
