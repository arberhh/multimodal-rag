import { One } from "one";
import { useEffect, useState } from "react";
import { type Document, listDocuments, uploadPdf } from "./api";

export function useDocuments() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDocuments().then(setDocs, (err: Error) => setError(err.message));
  }, []);

  const addPdf = async () => {
    const picked = await One.DocumentPicker.getDocument({ type: "application/pdf" });
    if (picked.canceled) return;

    setError(null);
    setUploading(true);
    try {
      const doc = await uploadPdf(picked.assets[0]);
      setDocs((current) => [doc, ...current]); // newest first, like the server's list
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return { docs, uploading, error, addPdf };
}

export type DocumentsViewProps = ReturnType<typeof useDocuments>;
