import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

export type FileKind = "pdf" | "doc" | "docx";

// What a file is, from its first bytes, so the client's name and type can't decide it. A .docx is
// a zip file, and .doc is an older Office file
export async function kindOf(path: string): Promise<FileKind | null> {
  const file = await open(path);
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(8), 0, 8, 0);
    const head = buffer.subarray(0, bytesRead);
    if (head.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
    if (head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "docx";
    if (head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "doc";
    return null;
  } finally {
    await file.close();
  }
}

// Writes <outDir>/<the input's name>.pdf. Rejects when the file can't be converted
export type ToPdf = (input: string, outDir: string) => Promise<void>;

// LibreOffice's command line: soffice on Linux, inside the app on macOS. SOFFICE_PATH overrides it
const soffice =
  process.env.SOFFICE_PATH ??
  (process.platform === "darwin"
    ? "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    : "soffice");

export const toPdfWithLibreOffice: ToPdf = async (input, outDir) => {
  // each conversion gets its own LibreOffice profile: two at once on the same one fail
  const profile = join(tmpdir(), `soffice-${randomUUID()}`);
  try {
    await run(
      soffice,
      [
        `-env:UserInstallation=${pathToFileURL(profile).href}`,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        outDir,
        input,
      ],
      { timeout: 120_000 },
    );
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
};

// The id in a Google Docs link, e.g. https://docs.google.com/document/d/<id>/edit
const GOOGLE_DOC = /^https:\/\/docs\.google\.com\/document\/d\/([\w-]{20,})/;

export function googleDocId(url: string): string | null {
  return GOOGLE_DOC.exec(url.trim())?.[1] ?? null;
}

// Google's PDF export of a doc. Only the id comes from the user, so the request can't go anywhere
// but Google
export function googleExportUrl(id: string) {
  return `https://docs.google.com/document/d/${id}/export?format=pdf`;
}

// The file name Google sends with the export, which is the doc's title
export function exportFileName(disposition: string | null): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // not valid percent-encoding: fall back to the plain name
    }
  }
  return disposition?.match(/filename="([^"]+)"/i)?.[1] ?? "Google Doc.pdf";
}
