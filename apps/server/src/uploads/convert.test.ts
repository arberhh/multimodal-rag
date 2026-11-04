import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exportFileName, googleDocId } from "./convert.js";

describe("google docs links", () => {
  it("finds the doc id in a share or edit link", () => {
    const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
    for (const link of [
      `https://docs.google.com/document/d/${id}/edit?usp=sharing`,
      `https://docs.google.com/document/d/${id}`,
      `  https://docs.google.com/document/d/${id}/view  `,
    ]) {
      assert.equal(googleDocId(link), id, link);
    }
  });

  it("finds no id in other links, so nothing else is ever fetched", () => {
    for (const link of [
      "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit",
      "https://docs.google.com.evil.example/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz",
      "http://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz",
      "https://docs.google.com/document/d/short",
    ]) {
      assert.equal(googleDocId(link), null, link);
    }
  });
});

describe("the file name of a google docs export", () => {
  it("prefers the encoded name, which keeps any character", () => {
    assert.equal(
      exportFileName(`attachment; filename="Plan.pdf"; filename*=UTF-8''Pl%C3%A4n%20Q3.pdf`),
      "Plän Q3.pdf",
    );
  });

  it("falls back to the plain name, then to a default", () => {
    assert.equal(exportFileName(`attachment; filename="Plan.pdf"`), "Plan.pdf");
    assert.equal(exportFileName(null), "Google Doc.pdf");
  });
});
