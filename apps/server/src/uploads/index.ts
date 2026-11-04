import multipart from "@fastify/multipart";
import type {
  Document,
  DocumentResponse,
  DocumentsResponse,
  ErrorResponse,
  GoogleDocBody,
} from "@multimodal-rag/shared";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { userOf } from "../users/index.js";
import {
  exportFileName,
  googleDocId,
  googleExportUrl,
  kindOf,
  type ToPdf,
  toPdfWithLibreOffice,
} from "./convert.js";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const GOOGLE_TIMEOUT_MS = 60_000;

async function removeFile(path: string) {
  try {
    await unlink(path);
  } catch {
    // already gone, which is what we wanted
  }
}

async function saveToDatabase(
  app: FastifyInstance,
  { id, user, fileName, size }: { id: string; user: string; fileName: string; size: number },
) {
  const { rows } = await app.pg.query<Document>(
    `INSERT INTO documents (id, file_name, size_bytes, user_id) VALUES ($1, $2, $3, $4)
     RETURNING id, file_name, size_bytes, status, created_at`,
    [id, fileName, size, user],
  );
  return rows[0];
}

async function getDocuments(app: FastifyInstance, user: string) {
  return await app.pg.query<Document>(
    `SELECT id, file_name, size_bytes, status, created_at FROM documents
     WHERE user_id = $1 ORDER BY created_at DESC`,
    [user],
  );
}

type Options = {
  onUploaded?: (id: string) => void;
  toPdf?: ToPdf; // turns a Word file into a PDF
  fetchGoogle?: typeof fetch; // fetches a Google Doc's PDF export
};

// Every document is stored as uploads/<id>.pdf: a Word file is turned into a PDF on the way in,
// so reading, searching and removing it work the same as for a PDF
export const uploads: FastifyPluginAsync<Options> = async (
  app,
  { onUploaded, toPdf = toPdfWithLibreOffice, fetchGoogle = fetch },
) => {
  // without a limit, files are capped at Fastify's 1 MB body limit, too small for real PDFs
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES } });
  await mkdir("uploads", { recursive: true });

  // the row for a PDF already at uploads/<id>.pdf, and the start of reading it
  const addDocument = async (
    req: FastifyRequest,
    { id, fileName, size }: { id: string; fileName: string; size: number },
  ) => {
    const doc = await saveToDatabase(app, { id, user: userOf(req).id, fileName, size });
    onUploaded?.(id); // e.g. start reading the PDF; the upload does not wait for it
    return { doc };
  };

  app.post<{ Reply: DocumentResponse | ErrorResponse }>("/uploads", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    // random name: the client's filename must never decide where we write
    const id = randomUUID();
    const received = `uploads/${id}.upload`;
    const pdf = `uploads/${id}.pdf`;
    try {
      await pipeline(data.file, createWriteStream(received));
      const size = (await stat(received)).size;
      const kind = await kindOf(received);
      if (!kind) {
        await removeFile(received);
        return reply.code(415).send({ error: "Only PDF and Word files can be added" });
      }

      if (kind === "pdf") {
        await rename(received, pdf);
      } else {
        // LibreOffice names the PDF after the file it was given, so this writes uploads/<id>.pdf
        const word = `uploads/${id}.${kind}`;
        await rename(received, word);
        try {
          await toPdf(word, "uploads");
        } catch (err) {
          req.log.warn({ err }, "Turning a Word file into a PDF failed");
          await removeFile(pdf);
          return reply.code(422).send({ error: "Couldn't read this Word file" });
        } finally {
          await removeFile(word);
        }
      }

      return await addDocument(req, { id, fileName: data.filename, size });
    } catch (err) {
      // too big or no row: don't keep a half file
      await removeFile(received);
      await removeFile(pdf);
      throw err;
    }
  });

  // A Google Doc, from its share link. Google turns it into a PDF, which only works when the doc
  // is shared as "anyone with the link": otherwise Google answers with its sign-in page
  app.post<{ Body: GoogleDocBody; Reply: DocumentResponse | ErrorResponse }>(
    "/uploads/google",
    {
      schema: {
        body: {
          type: "object",
          required: ["url"],
          properties: { url: { type: "string", maxLength: 500 } },
        },
      },
    },
    async (req, reply) => {
      const docId = googleDocId(req.body.url);
      if (!docId) return reply.code(400).send({ error: "That isn't a Google Docs link" });

      let res: Response;
      try {
        res = await fetchGoogle(googleExportUrl(docId), {
          signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
        });
      } catch (err) {
        req.log.warn({ err }, "Fetching a Google Doc failed");
        return reply.code(502).send({ error: "Couldn't reach Google Docs" });
      }
      const notShared = 'Couldn\'t open that doc. Share it as "Anyone with the link" and try again';
      if (!res.ok || !res.headers.get("content-type")?.includes("application/pdf")) {
        return reply.code(422).send({ error: notShared });
      }
      if (Number(res.headers.get("content-length") ?? 0) > MAX_FILE_BYTES) {
        return reply.code(413).send({ error: "That doc is too big" });
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_FILE_BYTES)
        return reply.code(413).send({ error: "That doc is too big" });
      if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
        return reply.code(422).send({ error: notShared });
      }

      const id = randomUUID();
      const pdf = `uploads/${id}.pdf`;
      try {
        await writeFile(pdf, bytes);
        const fileName = exportFileName(res.headers.get("content-disposition"));
        return await addDocument(req, { id, fileName, size: bytes.length });
      } catch (err) {
        await removeFile(pdf);
        throw err;
      }
    },
  );

  app.get<{ Reply: DocumentsResponse }>("/uploads", async (req) => ({
    docs: (await getDocuments(app, userOf(req).id)).rows,
  }));

  app.delete<{ Params: { id: string }; Reply: { 204: void; 404: ErrorResponse } }>(
    "/uploads/:id",
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } } },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      // the document's pages go with it (ON DELETE CASCADE). Someone else's document is "not
      // found" too, so its id gives nothing away
      const { rowCount } = await app.pg.query(
        "DELETE FROM documents WHERE id = $1 AND user_id = $2",
        [id, userOf(req).id],
      );
      if (rowCount === 0) return reply.code(404).send({ error: "Document not found" });

      await removeFile(`uploads/${id}.pdf`); // the row is gone, so a missing file is fine
      return reply.code(204).send();
    },
  );
};
