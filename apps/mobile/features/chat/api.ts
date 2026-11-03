import type { AskBody, ConversationResponse, Source } from "@multimodal-rag/shared";
import { apiFetch } from "~/features/server/apiFetch";
import { serverUrl } from "~/features/server/config";
import { deviceId } from "~/features/server/deviceId";
import { parseEvents } from "./sse";

export async function createConversation(): Promise<string> {
  const res = await apiFetch("/conversations", { method: "POST" });
  if (!res.ok) throw new Error(`Couldn't start the chat (${res.status})`);
  const body: ConversationResponse = await res.json();
  return body.conversation.id;
}

// Asks a question; each piece of the answer goes to onText as it arrives.
// Resolves with the pages the answer used, once the answer is complete. Aborting the signal stops
// the request, so the server stops writing an answer nobody will read.
//
// XMLHttpRequest instead of fetch: React Native's fetch can't read a response while it is still
// arriving, and XMLHttpRequest can on iOS, Android and web.
export function askQuestion(
  conversationId: string,
  question: string,
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<Source[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("Stopped"));
    const request = new XMLHttpRequest();
    request.open("POST", `${serverUrl}/conversations/${conversationId}/messages`);
    request.setRequestHeader("Content-Type", "application/json");
    request.setRequestHeader("X-Device-Id", deviceId());

    let sources: Source[] | undefined;
    let failure: string | undefined;
    let handled = 0; // how much of the response is already read
    let rest = ""; // the half event left over from the last read

    const readNewText = () => {
      const { events, rest: left } = parseEvents(rest + request.responseText.slice(handled));
      handled = request.responseText.length;
      rest = left;

      for (const answer of events) {
        if (answer.event === "text") onText(answer.data.text);
        else if (answer.event === "done") sources = answer.data.sources;
        else if (answer.event === "error") failure = answer.data.error;
      }
    };

    // an event that can't be read stops the request, otherwise the answer would never end
    request.onprogress = () => {
      try {
        readNewText();
      } catch {
        failure = "The answer couldn't be read";
        request.abort();
      }
    };
    request.onload = () => {
      if (request.status !== 200) return reject(new Error(`Couldn't ask (${request.status})`));
      try {
        readNewText();
      } catch {
        return reject(new Error("The answer couldn't be read"));
      }
      if (failure) return reject(new Error(failure));
      if (!sources) return reject(new Error("The answer was cut off"));
      resolve(sources);
    };
    request.onerror = () => reject(new Error("Couldn't reach the server"));
    request.onabort = () => reject(new Error(failure ?? "Stopped"));
    signal.addEventListener("abort", () => request.abort());

    const body: AskBody = { question };
    request.send(JSON.stringify(body));
  });
}
