# Multimodal RAG — Chat with your documents

Add your PDFs, Word files or Google Docs, ask questions in your own words, and get answers that name the pages they came from.

The app reads every page, including tables, charts and pictures, so it can answer questions about a chart as well as about the text. Each answer lists the pages it used, so you can check it.

It's a pnpm monorepo:

| Part          | What it is                                                                             | Docs                               |
| ------------- | -------------------------------------------------------------------------------------- | ---------------------------------- |
| `apps/mobile` | The app: iOS, Android and web, built with [One](https://onestack.dev) and React Native | [docs/app.md](docs/app.md)         |
| `apps/server` | The API: Fastify, Postgres with pgvector, Claude and Voyage                            | [docs/server.md](docs/server.md)   |
| `postman`     | A Postman collection for every route the app uses                                      | [docs/postman.md](docs/postman.md) |

## How it works

Two flows do all the work:

1. **Adding a document.** The server saves the file and returns at once. Word files (`.doc`, `.docx`) are turned into a PDF first, with LibreOffice, and a Google Doc is fetched from Google as a PDF, so from here on every document is a PDF. In the background, Claude Haiku reads the whole PDF and writes out each page: its text, its tables, and its charts and pictures, with the values a chart plots. Voyage turns each page into a vector (a list of numbers that captures its meaning), and the pages are stored in Postgres.
2. **Asking a question.** Voyage turns the question into a vector as well. Postgres finds the 5 pages closest in meaning, and Claude Sonnet answers using only those pages and cites the ones it used. The answer streams to the app as it's written.

Each install of the app is its own user. It makes a random id once, keeps it in the keychain (or localStorage on web), and sends it as `X-Device-Id` with every request. The server only ever shows a user their own documents and chats. This isn't sign-in: anyone with the id is that user.

## System design

Left to right: each screen, the requests it sends, the server code that handles them, and the models and data behind them.

```mermaid
flowchart LR
  subgraph Screens["App screens"]
    direction TB
    Home["Home"]
    Docs["My Documents"]
    Chat["Chat"]
    Chats["Chats"]
  end

  subgraph Requests["Requests"]
    direction TB
    R1["GET /health<br/>every 30 s"]
    R2["POST /uploads<br/>POST /uploads/google<br/>GET /uploads<br/>DELETE /uploads/:id"]
    R3["POST /conversations"]
    R4["POST /conversations/:id/messages<br/>streams text, then done"]
    R5["GET /conversations<br/>DELETE /conversations/:id"]
    R6["GET /me<br/>PUT /me"]
  end

  subgraph Server["Server (Fastify)"]
    direction TB
    Health["health check"]
    Uploads["uploads"]
    Process["processDocument<br/>in the background"]
    Answer["chat: findPages,<br/>then answerQuestion"]
    Users["users: X-Device-Id<br/>to a user, on every request"]
  end

  subgraph Back["Models and data"]
    direction TB
    Haiku["Claude Haiku<br/>reads each page"]
    Voyage["Voyage voyage-3.5<br/>vectors"]
    Sonnet["Claude Sonnet<br/>writes the answer"]
    DB[("Postgres + pgvector<br/>users, documents, document_pages,<br/>conversations, messages")]
    Files[/"uploads/&lt;id&gt;.pdf"/]
  end

  Home --> R1 --> Health
  Docs --> R2 --> Uploads
  Chat --> R3 --> Answer
  Chat --> R4 --> Answer
  Home --> R5
  Chats --> R5 --> Answer
  Home --> R6 --> Users

  Health --> DB
  Users --> DB
  Uploads --> Files
  Uploads --> DB
  Uploads -. "starts" .-> Process
  Process --> Haiku
  Process --> Voyage
  Process --> DB
  Answer --> Voyage
  Answer --> DB
  Answer --> Sonnet
```

The header on every screen shows the server status from `GET /health`. That check also queries the database, so the app shows Not connected when either the server or the database is down.

### Adding a document

```mermaid
%%{init: {"sequence": {"mirrorActors": false}}}%%
sequenceDiagram
  autonumber
  participant App as My Documents
  participant API as Server
  participant Disk as uploads/
  participant DB as Postgres
  participant Haiku as Claude Haiku
  participant Voyage

  App->>API: POST /uploads (multipart: a PDF or Word file)
  Note over API: a Word file goes through LibreOffice first.<br/>POST /uploads/google fetches Google's PDF instead
  API->>Disk: save as <random id>.pdf
  API->>DB: INSERT documents (status processing)
  API-->>App: { doc }
  Note over API: from here it runs in the background
  API->>Haiku: the PDF and the transcription prompt
  Haiku-->>API: each page: text, tables, figures
  API->>Voyage: each page's content (input_type document)
  Voyage-->>API: a 1024-number vector per page
  API->>DB: INSERT document_pages and set status ready, in one statement
  loop every 3 s while anything is processing
    App->>API: GET /uploads
    API-->>App: { docs } with their status
  end
```

If any step fails, the document is marked `failed` and the screen shows "Couldn't read".

### Asking a question

```mermaid
%%{init: {"sequence": {"mirrorActors": false}}}%%
sequenceDiagram
  autonumber
  participant App as Chat
  participant API as Server
  participant DB as Postgres
  participant Voyage
  participant Sonnet as Claude Sonnet

  App->>API: POST /conversations (first question only)
  API->>DB: INSERT conversations
  API-->>App: { conversation }
  App->>API: POST /conversations/:id/messages { question }
  API->>DB: read the history, save the question
  API->>Voyage: the question (and the previous one, for follow-ups)
  Voyage-->>API: the question's vector
  API->>DB: the 5 closest pages (cosine distance)
  API->>Sonnet: history, pages as search results, question (streamed)
  loop while Claude writes
    Sonnet-->>API: a piece of text
    API-->>App: event text
  end
  API->>DB: save the answer and its cited pages
  API-->>App: event done { sources }
```

If the app leaves or the user taps Stop, the connection closes. The server notices and aborts Claude's stream, so nobody pays for an answer no one will read.

## Run it

You need Node 22.11+, pnpm 10, Docker, an [Anthropic API key](https://console.anthropic.com) and a [Voyage API key](https://www.voyageai.com).

```sh
pnpm install
cp .env.example .env     # then fill in the database settings and both API keys
docker compose up -d     # Postgres on POSTGRES_PORT, pgweb on http://localhost:8082
pnpm --filter @multimodal-rag/server migrate
pnpm dev:server          # http://localhost:3000/health
pnpm run:web             # starts the app's dev server and opens http://localhost:8081
```

`.env` is read by both `docker-compose.yml` and the server, so the database settings can't drift apart.

For iOS or Android, and for running on a phone, see [docs/app.md](docs/app.md).

To check a change in the running app (the API with curl, web with Playwright, iOS on the simulator), follow the `run-app` skill in [.claude/skills/run-app](.claude/skills/run-app/SKILL.md).

## Checks

The pre-commit hook only formats the staged files. Run these before a commit:

```sh
pnpm typecheck && pnpm lint && pnpm deadcode && pnpm format:check
pnpm --filter @multimodal-rag/server test
pnpm --filter @multimodal-rag/mobile test
```
