import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("GPS review uses deterministic aligned columns at every breakpoint", () => {
  assert.match(css, /\.review-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
  assert.match(css, /@media\(max-width:1100px\)[\s\S]*?\.review-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.review-grid\{grid-template-columns:minmax\(0,1fr\)!important;width:100%\}/);
  assert.match(css, /\.review-grid \.wide\{grid-column:1\/-1!important\}/);
});

test("mobile time controls stay inside the card and actions do not cover fields", () => {
  assert.match(css, /input\[type="time"\][^}]*inline-size:100%;min-inline-size:0;max-inline-size:100%/);
  assert.match(css, /\.form-actions\.field-actions\{position:static;/);
});
