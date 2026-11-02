import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { idParams } from "../schemas.js";
import { type Embed, embedTexts } from "../search/embed.js";
import { findPages } from "../search/index.js";
import { answerQuestion } from "./answer.js";

// one server-sent event: the client reads `event` to know what `data` holds
function send(reply: FastifyReply, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const chat: FastifyPluginAsync<{ embed?: Embed; client?: Anthropic }> = async (
  app,
  { embed = embedTexts, client },
) => {
  app.post("/conversations", async (_req, reply) => {
    const { rows } = await app.pg.query(
      "INSERT INTO conversations DEFAULT VALUES RETURNING id, title, created_at",
    );
    return reply.code(201).send({ conversation: rows[0] });
  });

  app.get<{ Params: { id: string } }>(
    "/conversations/:id/messages",
    { schema: { params: idParams } },
    async (req) => {
      const { rows } = await app.pg.query(
        `SELECT id, role, content, sources, created_at FROM messages
         WHERE conversation_id = $1 ORDER BY created_at, id`,
        [req.params.id],
      );
      return { messages: rows };
    },
  );

  app.post<{ Params: { id: string }; Body: { question: string; document?: string } }>(
    "/conversations/:id/messages",
    {
      schema: {
        params: idParams,
        body: {
          type: "object",
          required: ["question"],
          properties: {
            question: { type: "string", minLength: 1, maxLength: 2000 },
            document: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { question, document } = req.body;

      const found = await app.pg.query("SELECT 1 FROM conversations WHERE id = $1", [id]);
      if (found.rowCount === 0) return reply.code(404).send({ error: "Conversation not found" });

      const { rows: history } = await app.pg.query<{ role: "user" | "assistant"; content: string }>(
        "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at, id",
        [id],
      );
      await app.pg.query(
        "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)",
        [id, question],
      );

      // a follow-up like "and in Q3?" has no topic of its own, so search with the previous question too
      const previous = history.findLast((m) => m.role === "user")?.content;
      const pages = await findPages(
        app,
        previous ? `${previous}\n${question}` : question,
        { document },
        embed,
      );

      // from here the answer is streamed, so Fastify no longer sends the reply
      reply.hijack();
      // keep the headers already set on the reply, like CORS
      for (const [name, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) reply.raw.setHeader(name, value);
      }
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      try {
        const { text, sources } = await answerQuestion(
          question,
          history,
          pages,
          (piece) => send(reply, "text", { text: piece }),
          client,
        );
        await app.pg.query(
          `INSERT INTO messages (conversation_id, role, content, sources)
           VALUES ($1, 'assistant', $2, $3)`,
          [id, text, JSON.stringify(sources)],
        );
        send(reply, "done", { sources });
      } catch (err) {
        req.log.error({ err }, "Answering failed");
        send(reply, "error", { error: "Could not answer the question" });
      }
      reply.raw.end();
    },
  );
};
