import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U6 provides keyboard skip navigation to the protected Logbook content",()=>{
  const shell=read("components/app-shell.tsx");
  assert.match(shell,/className="skip-link" href="#main-content"/);
  assert.match(shell,/id="main-content"/);
  assert.match(shell,/tabIndex=\{-1\}/);
});

test("v3.0 U6 focus-manages the mobile sidebar",()=>{
  const sidebar=read("components/sidebar.tsx");
  assert.match(sidebar,/menuRef=useRef/);
  assert.match(sidebar,/toggleRef=useRef/);
  assert.match(sidebar,/event\.key==="Escape"/);
  assert.match(sidebar,/event\.key!=="Tab"/);
  assert.match(sidebar,/requestAnimationFrame\(\(\)=>focusables\(\)\[0\]\?\.focus\(\)\)/);
  assert.match(sidebar,/aria-expanded=\{mobile\}/);
});

test("v3.0 U6 traps aircraft modal focus and restores the opener",()=>{
  const manager=read("components/aircraft-manager.tsx");
  assert.match(manager,/modalRef=useRef/);
  assert.match(manager,/closeRef=useRef/);
  assert.match(manager,/openerRef=useRef/);
  assert.match(manager,/role="dialog" aria-modal="true"/);
  assert.match(manager,/requestAnimationFrame\(\(\)=>closeRef\.current\?\.focus\(\)\)/);
  assert.match(manager,/requestAnimationFrame\(\(\)=>openerRef\.current\?\.focus\(\)\)/);
  assert.match(manager,/event\.key!=="Tab"/);
});

test("v3.0 U6 final CSS covers safe areas, touch sizing, overflow and accessibility fallbacks",()=>{
  const css=read("app/v300-u6-acceptance.css");
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/pointer:coarse/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/font-size:16px/);
  assert.match(css,/overflow-x:clip/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/forced-colors:active/);
});

test("v3.0 U6 is loaded last and closes the cross-product UX consolidation track",()=>{
  const layout=read("app/layout.tsx");
  const roadmap=read("ROADMAP.md");
  const audit=read("docs/product/V3_0_UX_CONSOLIDATION.md");
  assert.ok(layout.indexOf('import "./v300-u6-acceptance.css"')>layout.indexOf('import "./v300-u4-flight-workflow.css"'));
  assert.match(roadmap,/v3\.0 — UX & Product Consolidation ✅/);
  assert.match(roadmap,/U5 ✅ Training learner polish/);
  assert.match(roadmap,/U6 ✅ mobile, accessibility and final UX acceptance/);
  assert.match(audit,/Status: \*\*v3\.0 complete\*\*/);
  assert.match(audit,/U6 ✅ Mobile, accessibility and final UX acceptance/);
});
