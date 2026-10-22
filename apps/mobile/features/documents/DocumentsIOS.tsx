import { One } from "one";
import { StyleSheet } from "react-native";
import type { Document } from "./api";
import { formatSize, statusLabel } from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

// SwiftUI: a native inset-grouped List
export function DocumentsIOS({ docs, uploading, error, addPdf }: DocumentsViewProps) {
  return (
    <One.iOS.List listStyle="insetGrouped" style={styles.list}>
      <One.iOS.Section footer={error ?? ""}>
        <One.iOS.Button
          label={uploading ? "Uploading…" : "Add PDF"}
          systemImage="doc.badge.plus"
          onPress={addPdf}
          swiftStyle={uploading ? swiftStyles.disabled : swiftStyles.enabled}
        />
      </One.iOS.Section>

      <One.iOS.Section title="Documents">
        {docs.length === 0 && <One.iOS.Text text="No documents yet." />}
        {docs.map(renderDocument)}
      </One.iOS.Section>
    </One.iOS.List>
  );
}

// LabeledContent takes a value or children, not both, so the size goes in the children
function renderDocument(doc: Document) {
  return (
    <One.iOS.LabeledContent key={doc.id} label={doc.file_name}>
      <One.iOS.HStack spacing={6}>
        {doc.status !== "ready" && <One.iOS.ProgressView />}
        <One.iOS.Text text={`${formatSize(doc.size_bytes)} · ${statusLabel[doc.status]}`} />
      </One.iOS.HStack>
    </One.iOS.LabeledContent>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
});

const swiftStyles = {
  enabled: { disabled: false },
  disabled: { disabled: true },
};
