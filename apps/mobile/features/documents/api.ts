import { Platform } from "react-native";
import type {
  Document,
  DocumentResponse,
  DocumentsResponse,
  ErrorResponse,
  GoogleDocBody,
} from "@multimodal-rag/shared";
import { apiFetch } from "~/features/server/apiFetch";

export async function listDocuments(): Promise<Document[]> {
  const res = await apiFetch("/uploads");
  if (!res.ok) throw new Error(`Couldn't load documents (${res.status})`);
  const body: DocumentsResponse = await res.json();
  return body.docs;
}

// what the picker offers: PDFs and Word files, old (.doc) and new (.docx). The server turns Word
// files into PDFs
export const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// the part of a DocumentPicker result we need
export type PickedFile = { uri: string; name: string; mimeType?: string };

// the new document, or the server's reason for refusing it
async function added(res: Response): Promise<Document> {
  if (res.status === 413) throw new Error("That file is too big");
  if (!res.ok) {
    let reason = `Upload failed (${res.status})`;
    try {
      const body: ErrorResponse = await res.json();
      if (body.error) reason = body.error;
    } catch {
      // no JSON reason: keep the status
    }
    throw new Error(reason);
  }
  const body: DocumentResponse = await res.json();
  return body.doc;
}

export async function uploadFile(file: PickedFile): Promise<Document> {
  const form = new FormData();
  if (Platform.OS === "web") {
    // on web the picker gives a blob: URL, so read the file back into a Blob
    form.append("file", await (await fetch(file.uri)).blob(), file.name);
  } else {
    // React Native streams the file from its uri, so big files never sit in JS memory
    const type = file.mimeType ?? "application/pdf";
    form.append("file", { uri: file.uri, name: file.name, type } as never);
  }
  return await added(await apiFetch("/uploads", { method: "POST", body: form }));
}

// a Google Doc, from its share link. The server fetches it from Google as a PDF
export async function addGoogleDoc(url: string): Promise<Document> {
  const body: GoogleDocBody = { url };
  return await added(
    await apiFetch("/uploads/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await apiFetch(`/uploads/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Couldn't remove the document (${res.status})`);
}
