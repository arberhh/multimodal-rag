import { One } from "one";
import { formatSize, statusLabel } from "./labels";
import type { DocumentsViewProps } from "./useDocuments";

// SwiftUI: a native inset-grouped List
export function DocumentsIOS({ docs, uploading, error, addPdf, refresh }: DocumentsViewProps) {
  return (
    <One.iOS.List
      listStyle="insetGrouped"
      style={{ flex: 1 }}
      swiftStyle={{ refreshable: refresh }}
    >
      <One.iOS.Section footer={error ?? ""}>
        <One.iOS.Button
          label={uploading ? "Uploading…" : "Add PDF"}
          systemImage="doc.badge.plus"
          onPress={addPdf}
          swiftStyle={{ disabled: uploading }}
        />
      </One.iOS.Section>

      <One.iOS.Section title="Documents">
        {docs.length === 0 && <One.iOS.Text text="No documents yet." />}
        {docs.map((doc) => (
          // LabeledContent takes a value or children, not both, so the size goes in the children
          <One.iOS.LabeledContent key={doc.id} label={doc.file_name}>
            <One.iOS.HStack spacing={6}>
              {doc.status !== "ready" && <One.iOS.ProgressView />}
              <One.iOS.Text text={`${formatSize(doc.size_bytes)} · ${statusLabel[doc.status]}`} />
            </One.iOS.HStack>
          </One.iOS.LabeledContent>
        ))}
      </One.iOS.Section>
    </One.iOS.List>
  );
}
