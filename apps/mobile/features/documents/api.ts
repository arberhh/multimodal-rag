import { Platform } from "react-native";
import { serverUrl } from "~/features/server/config";

export type DocumentStatus = "processing" | "ready" | "failed";

export type Document = {
  id: string;
  file_name: string;
  size_bytes: number;
  status: DocumentStatus;
  created_at: string;
};

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${serverUrl}/uploads`);
  if (!res.ok) throw new Error(`Couldn't load documents (${res.status})`);
  return (await res.json()).docs;
}

// the part of a DocumentPicker result we need
export type PickedFile = { uri: string; name: string };

export async function uploadPdf(pdf: PickedFile): Promise<Document> {
  const form = new FormData();
  if (Platform.OS === "web") {
    // on web the picker gives a blob: URL, so read the file back into a Blob
    form.append("file", await (await fetch(pdf.uri)).blob(), pdf.name);
  } else {
    // React Native streams the file from its uri, so big PDFs never sit in JS memory
    form.append("file", { uri: pdf.uri, name: pdf.name, type: "application/pdf" } as never);
  }

  const res = await fetch(`${serverUrl}/uploads`, { method: "POST", body: form });
  if (res.status === 413) throw new Error("That PDF is too big");
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return (await res.json()).doc;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${serverUrl}/uploads/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Couldn't remove the document (${res.status})`);
}
