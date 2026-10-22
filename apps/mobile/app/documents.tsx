import { One } from "one";
import { DocumentsAndroid } from "~/features/documents/DocumentsAndroid";
import { DocumentsIOS } from "~/features/documents/DocumentsIOS";
import { DocumentsWeb } from "~/features/documents/DocumentsWeb";
import { useDocuments } from "~/features/documents/useDocuments";

// SwiftUI and Compose views throw on the wrong platform, so pick one per platform
const views = { ios: DocumentsIOS, android: DocumentsAndroid, web: DocumentsWeb };

export default function Documents() {
  const DocumentsView = views[One.platform];
  return <DocumentsView {...useDocuments()} />;
}
