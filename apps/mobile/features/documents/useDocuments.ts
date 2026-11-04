import { One } from "one";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { confirmRemove } from "~/features/confirmRemove";
import type { Document } from "@multimodal-rag/shared";
import { addGoogleDoc, DOCUMENT_TYPES, deleteDocument, listDocuments, uploadFile } from "./api";
import { googleDocMessage, googleDocTitle } from "./labels";

const POLL_MS = 3000;

export function useDocuments() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setDocs(await listDocuments());
      } catch (err) {
        setError((err as Error).message);
      }
    };
    load();
  }, []);

  const preparing = docs.some((doc) => doc.status === "processing");

  // The server reads a PDF in the background and can't tell the app when it's done, so ask again
  // while anything is preparing. Only update documents already on screen: a response sent before
  // an upload or removal must not undo it.
  // Left for later: each poll fetches every document, not just one user's (172 KB at 1,000
  // documents). When that hurts, ask only for the preparing ones, e.g. ?status=processing.
  useEffect(() => {
    if (!preparing) return;
    const poll = async () => {
      try {
        const latest = await listDocuments();
        const byId = new Map(latest.map((doc) => [doc.id, doc]));
        setDocs((current) => current.map((doc) => byId.get(doc.id) ?? doc));
      } catch {
        // the next poll tries again
      }
    };
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [preparing]);

  // adds the document the server makes, newest first like the server's list
  const add = async (upload: () => Promise<Document>) => {
    setError(null);
    setUploading(true);
    try {
      const doc = await upload();
      setDocs((current) => [doc, ...current]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const addFile = async () => {
    const picked = await One.DocumentPicker.getDocument({ type: DOCUMENT_TYPES });
    if (picked.canceled) return;
    await add(() => uploadFile(picked.assets[0]));
  };

  // asks for a share link: a native prompt on iOS and the browser's on web. Android has no text
  // prompt, so there it's undefined
  const askForGoogleDoc = () => {
    const addLink = (url: string | null | undefined) => {
      const link = url?.trim();
      if (link) add(() => addGoogleDoc(link));
    };
    if (One.platform === "web")
      return addLink(window.prompt(`${googleDocTitle}\n\n${googleDocMessage}`));
    Alert.prompt(googleDocTitle, googleDocMessage, [
      { text: "Cancel", style: "cancel" },
      { text: "Add", onPress: (value?: string) => addLink(value) },
    ]);
  };

  const removeDocument = (doc: Document) => {
    confirmRemove(doc.file_name, async () => {
      setError(null);
      try {
        await deleteDocument(doc.id);
        setDocs((current) => current.filter((d) => d.id !== doc.id));
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return {
    docs,
    uploading,
    error,
    addFile,
    addGoogleDoc: One.platform === "android" ? undefined : askForGoogleDoc,
    removeDocument,
  };
}

export type DocumentsViewProps = ReturnType<typeof useDocuments>;
