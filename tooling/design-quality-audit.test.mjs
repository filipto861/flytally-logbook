import test from "node:test";
import assert from "node:assert/strict";
import { auditSource } from "./design-quality-audit.mjs";

test("reports broad transition and layout-property animation", () => {
  const got = auditSource("app/foo.css", ".x{transition: all 150ms}\n.y{transition: width 200ms}");
  assert.deepEqual(got.map((x) => [x.rule, x.line]), [["transition-all", 1], ["layout-transition", 2]]);
});
test("finds restricted zoom and nonsemantic React onClick", () => {
  const got = auditSource("app/page.tsx", '<meta name="viewport" content="maximum-scale=1" />\n<div onClick={open}>Open</div>');
  assert.deepEqual(got.map((x) => [x.rule, x.line]), [["zoom-restriction", 1], ["nonsemantic-click", 2]]);
});
test("allows accessible baseline: buttons, explicit properties and visible focus", () => {
  const got = auditSource("components/action.tsx", '<button type="button" onClick={open}>Open</button>\n.a{transition: opacity 100ms; outline: 2px solid teal}');
  assert.equal(got.length, 0);
});
test("suppressed outline is flagged for contextual review", () => {
  assert.equal(auditSource("app/ui.css", ".a{outline:none;}")[0]?.rule, "suppressed-outline");
});
test("block comments do not produce findings and line offsets remain stable", () => {
  const got = auditSource("app/x.css", "/* transition: all\noutline:none; */\n.a{transition:width 100ms}");
  assert.deepEqual(got.map((x) => [x.rule, x.line]), [["layout-transition", 3]]);
});
test("a clean source is never described as an audited rendered page", () => {
  assert.deepEqual(auditSource("app/x.css", ".a{transition:transform 120ms}"), []);
});
