// The ids are for React's keys: a block never moves, and an answer only grows at the end
type BlockContent =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: { id: number; marker: string; text: string }[] }
  | { type: "table"; header: string[]; rows: string[][] };

export type Block = BlockContent & { id: number };

export type Span = { id: number; text: string; bold?: boolean; code?: boolean };

const SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;
const LIST_ITEM = /^\s*([-*]|\d+\.)\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

const isTableRow = (line: string) => line.trim().startsWith("|");

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

// The few markdown pieces an answer uses: headings, paragraphs, lists and tables.
// A table counts once its separator row (|---|---|) has arrived, so a table still being
// streamed shows as plain text until then instead of flickering.
export function parseMarkdown(source: string): Block[] {
  const lines = source.split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const add = (content: BlockContent) => blocks.push({ id: blocks.length, ...content });

  const endParagraph = () => {
    if (paragraph.length) add({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTableRow(line) && SEPARATOR.test(lines[i + 1]?.trim() ?? "")) {
      endParagraph();
      const rows: string[][] = [];
      let next = i + 2;
      while (next < lines.length && isTableRow(lines[next])) rows.push(cells(lines[next++]));
      add({ type: "table", header: cells(line), rows });
      i = next - 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      endParagraph();
      add({ type: "heading", text: heading[1] });
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      endParagraph();
      const last = blocks[blocks.length - 1];
      const marker = /\d/.test(item[1]) ? item[1] : "•";
      if (last?.type === "list") {
        last.items.push({ id: last.items.length, marker, text: item[2] });
      } else {
        add({ type: "list", items: [{ id: 0, marker, text: item[2] }] });
      }
      continue;
    }

    if (line.trim() === "") endParagraph();
    else paragraph.push(line.trim());
  }
  endParagraph();
  return blocks;
}

// Splits a line into plain, **bold** and `code` pieces.
export function parseSpans(text: string): Span[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter(Boolean)
    .map((part, id) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return { id, text: part.slice(2, -2), bold: true };
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return { id, text: part.slice(1, -1), code: true };
      }
      return { id, text: part };
    });
}
