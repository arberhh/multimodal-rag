import type { DocumentStatus } from "@multimodal-rag/shared";

export const statusLabel: Record<DocumentStatus, string> = {
  processing: "Preparing…",
  ready: "Ready",
  failed: "Couldn't read",
};

export const addFileLabel = (uploading: boolean) =>
  uploading ? "Uploading…" : "Add PDF or Word file";

export const addGoogleDocLabel = "Add Google Doc";
export const googleDocTitle = "Add a Google Doc";
export const googleDocLinkLabel = "Google Docs link";
export const pasteLabel = "Paste";
export const googleDocMessage =
  'Paste its share link. The doc must be shared as "Anyone with the link".';

export const emptyLabel = "No documents yet.";

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
