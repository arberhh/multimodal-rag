import type { Source } from "./api";

// what the server's text, done and error events carry
type EventData = { text?: string; sources?: Source[]; error?: string };

export type ServerEvent = { event: string; data: EventData };

// Reads the complete events from the text received so far. An event ends with a blank line, so
// whatever follows the last one is half an event: it comes back as `rest` to be read with the next chunk.
export function parseEvents(received: string): { events: ServerEvent[]; rest: string } {
  const parts = received.split("\n\n");
  const rest = parts.pop() ?? "";

  const events = parts.map((part) => {
    const lines = part.split("\n");
    const event = lines.find((line) => line.startsWith("event: "))?.slice("event: ".length);
    const data = lines.find((line) => line.startsWith("data: "))?.slice("data: ".length);
    return { event: event ?? "message", data: data === undefined ? {} : JSON.parse(data) };
  });
  return { events, rest };
}
