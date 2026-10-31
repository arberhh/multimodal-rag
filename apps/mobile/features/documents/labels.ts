import type { DocumentStatus } from "./api";

export const statusLabel: Record<DocumentStatus, string> = {
  processing: "Preparing…",
  ready: "Ready",
  failed: "Couldn't read",
};

export const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
