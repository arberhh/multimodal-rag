import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pageBlocks, pageContent } from "./content.js";

const page = {
  text: "## Pre-orders\n\nPre-orders opened in February.\n\n## Risks\n\nThe coil may be late.\n- 60% confirmed",
  tables: ["| Week | Orders |\n|---|---|\n| 1 | 1,200 |"],
  figures: ["Type: bar chart.\n\n| Week | Orders |\n\nDescription: orders rise."],
};

describe("pageBlocks", () => {
  it("splits the text into paragraphs, each with its heading, then each table and figure", () => {
    assert.deepEqual(pageBlocks(page), [
      "## Pre-orders\n\nPre-orders opened in February.",
      "## Risks\n\nThe coil may be late.\n- 60% confirmed",
      page.tables[0],
      // a figure stays whole, though it has blank lines in it
      page.figures[0],
    ]);
  });

  it("keeps a heading with nothing under it, and skips empty parts", () => {
    assert.deepEqual(pageBlocks({ text: "Intro\n\n\n\n# End", tables: [""], figures: [] }), [
      "Intro",
      "# End",
    ]);
  });

  it("is what pageContent joins", () => {
    assert.equal(pageContent(page), pageBlocks(page).join("\n\n"));
  });
});
