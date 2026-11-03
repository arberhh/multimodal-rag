// What the server sends and the app reads: one definition for both, so a change to a route's
// shape is a type error on the other side. Types only, so it never ships any code: import it with
// `import type`. Dates arrive as ISO strings, since they cross the wire as JSON.

export type User = { id: string; name: string | null };

export type DocumentStatus = "processing" | "ready" | "failed";

export type Document = {
  id: string;
  file_name: string;
  size_bytes: number;
  status: DocumentStatus;
  created_at: string;
};

// a page an answer came from
export type Source = { documentId: string; fileName: string; page: number };

export type Conversation = {
  id: string;
  title: string | null; // its first question; null until it has one
  created_at: string;
  updated_at: string; // its latest question
};

// the list only has conversations with a question, so each has a title
export type ListedConversation = Conversation & { title: string };

export type Message = {
  id: string; // a BIGINT, which Postgres sends as a string
  role: "user" | "assistant";
  content: string;
  sources: Source[] | null; // the pages an answer used; null for a question
  created_at: string;
};

// a page that matches a search, best first
export type SearchResult = Source & { score: number; content: string };

// ---- request bodies

export type AskBody = { question: string; document?: string };
export type NameBody = { name: string };

// ---- responses, one per route

export type HealthResponse = { status: "ok" | "database unreachable" };
export type ErrorResponse = { error: string };
export type MeResponse = { user: User };
export type DocumentResponse = { doc: Document };
export type DocumentsResponse = { docs: Document[] };
export type ConversationResponse = { conversation: Conversation };
export type ConversationsResponse = { conversations: ListedConversation[] };
export type MessagesResponse = { messages: Message[] };
export type SearchResponse = { results: SearchResult[] };

// ---- the answer stream: POST /conversations/:id/messages, as server-sent events

export type AnswerEvent =
  | { event: "text"; data: { text: string } } // the next piece of the answer
  | { event: "done"; data: { sources: Source[] } } // the answer is complete
  | { event: "error"; data: ErrorResponse }; // answering failed; nothing more follows
