type PageParts = { text: string; tables: string[]; figures: string[] };

// A page in parts Claude can cite one at a time: each paragraph of its text, each table and each
// figure. A heading stays with the paragraph under it, so a quoted paragraph keeps its heading.
export function pageBlocks(page: PageParts) {
  const paragraphs: string[] = [];
  let heading = "";
  for (const paragraph of page.text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (/^#+ [^\n]*$/.test(trimmed)) {
      heading = heading ? `${heading}\n\n${trimmed}` : trimmed;
      continue;
    }
    paragraphs.push(heading ? `${heading}\n\n${trimmed}` : trimmed);
    heading = "";
  }
  if (heading) paragraphs.push(heading);
  return [...paragraphs, ...page.tables, ...page.figures].filter(Boolean);
}

// Everything a page holds, as one text: this is what gets embedded and what a search returns.
export function pageContent(page: PageParts) {
  return pageBlocks(page).join("\n\n");
}
