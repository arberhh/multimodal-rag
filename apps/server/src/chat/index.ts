import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { idParams } from "../schemas.js";
import { type Embed, embedTexts } from "../search/embed.js";
import { findPages } from "../search/index.js";
import { userOf } from "../users/index.js";
import { answerQuestion } from "./answer.js";

// how long a conversation's title may be: its first question, cut short
const TITLE_LENGTH = 80;

// one server-sent event: the client reads `event` to know what `data` holds
function send(reply: FastifyReply, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const chat: FastifyPluginAsync<{ embed?: Embed; client?: Anthropic }> = async (
  app,
  { embed = embedTexts, client },
) => {
  // a conversation the user owns, or null. Someone else's is "not found" too, so its id gives
  // nothing away
  const ownConversation = async (id: string, user: string) => {
    const { rowCount } = await app.pg.query(
      "SELECT 1 FROM conversations WHERE id = $1 AND user_id = $2",
      [id, user],
    );
    return rowCount !== 0;
  };

  app.post("/conversations", async (req, reply) => {
    const { rows } = await app.pg.query(
      `INSERT INTO conversations (user_id) VALUES ($1)
       RETURNING id, title, created_at, updated_at`,
      [userOf(req).id],
    );
    return reply.code(201).send({ conversation: rows[0] });
  });

  // the user's conversations, latest question first. One with no question yet has no title, and
  // isn't listed
  app.get<{ Querystring: { limit: number } }>(
    "/conversations",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
        },
      },
    },
    async (req) => {
      const { rows } = await app.pg.query(
        `SELECT id, title, created_at, updated_at FROM conversations
         WHERE user_id = $1 AND title IS NOT NULL
         ORDER BY updated_at DESC LIMIT $2`,
        [userOf(req).id, req.query.limit],
      );
      return { conversations: rows };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/conversations/:id",
    { schema: { params: idParams } },
    async (req, reply) => {
      // its messages go with it (ON DELETE CASCADE)
      const { rowCount } = await app.pg.query(
        "DELETE FROM conversations WHERE id = $1 AND user_id = $2",
        [req.params.id, userOf(req).id],
      );
      if (rowCount === 0) return reply.code(404).send({ error: "Conversation not found" });
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { id: string } }>(
    "/conversations/:id/messages",
    { schema: { params: idParams } },
    async (req, reply) => {
      if (!(await ownConversation(req.params.id, userOf(req).id))) {
        return reply.code(404).send({ error: "Conversation not found" });
      }
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
      const user = userOf(req).id;

      if (!(await ownConversation(id, user))) {
        return reply.code(404).send({ error: "Conversation not found" });
      }

      const { rows: history } = await app.pg.query<{ role: "user" | "assistant"; content: string }>(
        "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at, id",
        [id],
      );
      await app.pg.query(
        "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)",
        [id, question],
      );
      // the first question names the conversation in the list; each one moves it to the top
      await app.pg.query(
        `UPDATE conversations SET title = COALESCE(title, left($2, ${TITLE_LENGTH})), updated_at = now()
         WHERE id = $1`,
        [id, question],
      );

      // a follow-up like "and in Q3?" has no topic of its own, so search with the previous question too
      const previous = history.findLast((m) => m.role === "user")?.content;
      const pages = await findPages(
        app,
        previous ? `${previous}\n${question}` : question,
        { user, document },
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

      // the app closed the request before the answer ended: stop the model instead of paying for
      // an answer nobody will read
      const left = new AbortController();
      reply.raw.on("close", () => {
        if (!reply.raw.writableEnded) left.abort();
      });

      try {
        const { text, sources } = await answerQuestion(
          question,
          history,
          pages,
          (piece) => send(reply, "text", { text: piece }),
          client,
          left.signal,
        );
        await app.pg.query(
          `INSERT INTO messages (conversation_id, role, content, sources)
           VALUES ($1, 'assistant', $2, $3)`,
          [id, text, JSON.stringify(sources)],
        );
        send(reply, "done", { sources });
      } catch (err) {
        if (left.signal.aborted) {
          req.log.info("The app left before the answer ended");
          return;
        }
        req.log.error({ err }, "Answering failed");
        send(reply, "error", { error: "Could not answer the question" });
      }
      reply.raw.end();
    },
  );
};
