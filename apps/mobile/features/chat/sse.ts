import type { Source } from "./api";

// what the server's text, done and error events carry
type EventData = { text?: string; sources?: Source[]; error?: string };

export type ServerEvent = { event: string; data: EventData };

// the value of a `name: value` line, or undefined when the line is another field
const field = (line: string, name: string) =>
  line.startsWith(`${name}:`) ? line.slice(name.length + 1).replace(/^ /, "") : undefined;

// Reads the complete events from the text received so far. An event ends with a blank line, so
// whatever follows the last one is half an event: it comes back as `rest` to be read with the next chunk.
// Lines may end in \r\n, and data may be split over several data lines, as the format allows.
export function parseEvents(received: string): { events: ServerEvent[]; rest: string } {
  const parts = received.replace(/\r\n/g, "\n").split("\n\n");
  const rest = parts.pop() ?? "";

  const events = parts.map((part) => {
    const lines = part.split("\n");
    const event = lines.map((line) => field(line, "event")).find((value) => value !== undefined);
    const data = lines.map((line) => field(line, "data")).filter((value) => value !== undefined);
    return { event: event ?? "message", data: data.length ? JSON.parse(data.join("\n")) : {} };
  });
  return { events, rest };
}
