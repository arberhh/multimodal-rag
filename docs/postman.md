# Postman

`postman/multimodal-rag.postman_collection.json` holds every route the app uses, in the order you'd call them.

## Set up

1. In Postman, choose **Import** and pick `postman/multimodal-rag.postman_collection.json`.
2. Start the database and the server (`docker compose up -d`, then `pnpm dev:server`).
3. The collection variable `baseUrl` is `http://localhost:3000`. Change it to test a server on another machine.
4. Every request sends `X-Device-Id: {{deviceId}}`, set once on the collection. The first request makes a random `deviceId` if it's empty, so the collection is one user. Clear it to start over as a new user, or paste the app's id to see the app's documents and chats.

## Requests

| Folder  | Request                  | Route                                                        | Notes                                                                   |
| ------- | ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Server  | Health                   | `GET {{baseUrl}}/health`                                     | 200 `{ status: "ok" }`, or 503 while the database is down               |
| Uploads | Upload PDF               | `POST {{baseUrl}}/uploads`                                   | Pick a file for the form field `file`. Saves the new id as `documentId` |
| Uploads | Add Google Doc           | `POST {{baseUrl}}/uploads/google`                            | Put a shared doc's link in `url`. Saves the new id as `documentId`      |
| Uploads | List documents           | `GET {{baseUrl}}/uploads`                                    | Call it again until the status changes from `processing` to `ready`     |
| Uploads | Remove document          | `DELETE {{baseUrl}}/uploads/{{documentId}}`                  | 204                                                                     |
| Chat    | Start conversation       | `POST {{baseUrl}}/conversations`                             | Saves the new id as `conversationId`                                    |
| Chat    | Ask a question (streams) | `POST {{baseUrl}}/conversations/{{conversationId}}/messages` | Body `{ "question": "…" }`. The events arrive as the answer is written  |
| Chat    | Conversation history     | `GET {{baseUrl}}/conversations/{{conversationId}}/messages`  | Every question and answer, with each answer's sources                   |

Two of the requests save an id for the requests after them:

- **Upload PDF** sets `documentId`.
- **Start conversation** sets `conversationId`.

## A full run

1. **Health** should answer `ok`.
2. **Upload PDF** with `samples/quarterly-report.pdf`.
3. **List documents** until it's `ready`. Reading takes from a few seconds to a minute, depending on the length.
4. **Start conversation**.
5. **Ask a question**. The sample asks "How much revenue did Europe make in Q2?". The response is a list of `text` events, then `done` with the pages it used.
6. **Conversation history** shows the question and the answer with its `sources`.
7. **Remove document** to clean up.

## Not in the collection

These two routes are for debugging, and the app doesn't call them:

- `GET /search?q=<question>&limit=5&document=<id>` returns the closest pages and their scores.
- `GET /extract/:id` returns what Claude read from each page.

[server.md](server.md) has the full route list and the stream format.
