// Everything a page holds, as one text: this is what gets embedded and what a search returns.
export function pageContent(page: { text: string; tables: string[]; figures: string[] }) {
  return [page.text, ...page.tables, ...page.figures].filter(Boolean).join("\n\n");
}
