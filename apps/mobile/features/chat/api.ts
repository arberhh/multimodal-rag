import { serverUrl } from "~/features/server/config";
import { parseEvents } from "./sse";

export type Source = { documentId: string; fileName: string; page: number };

export async function createConversation(): Promise<string> {
  const res = await fetch(`${serverUrl}/conversations`, { method: "POST" });
  if (!res.ok) throw new Error(`Couldn't start the chat (${res.status})`);
  return (await res.json()).conversation.id;
}

// Asks a question; each piece of the answer goes to onText as it arrives.
// Resolves with the pages the answer used, once the answer is complete.
//
// XMLHttpRequest instead of fetch: React Native's fetch can't read a response while it is still
// arriving, and XMLHttpRequest can on iOS, Android and web.
export function askQuestion(
  conversationId: string,
  question: string,
  onText: (text: string) => void,
): Promise<Source[]> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${serverUrl}/conversations/${conversationId}/messages`);
    request.setRequestHeader("Content-Type", "application/json");

    let sources: Source[] | undefined;
    let failure: string | undefined;
    let handled = 0; // how much of the response is already read
    let rest = ""; // the half event left over from the last read

    const readNewText = () => {
      const { events, rest: left } = parseEvents(rest + request.responseText.slice(handled));
      handled = request.responseText.length;
      rest = left;

      for (const { event, data } of events) {
        if (event === "text") onText(data.text ?? "");
        else if (event === "done") sources = data.sources ?? [];
        else if (event === "error") failure = data.error;
      }
    };

    request.onprogress = readNewText;
    request.onload = () => {
      if (request.status !== 200) return reject(new Error(`Couldn't ask (${request.status})`));
      readNewText();
      if (failure) return reject(new Error(failure));
      if (!sources) return reject(new Error("The answer was cut off"));
      resolve(sources);
    };
    request.onerror = () => reject(new Error("Couldn't reach the server"));

    request.send(JSON.stringify({ question }));
  });
}
