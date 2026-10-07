import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("3.5.4 keeps wider flight-detail navigation on one row",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  const css=read("app/ui-system.css");

  assert.match(page,/className="page-header flight-detail-header"/);
  assert.match(css,/\.flight-detail-navigation\{[\s\S]*?flex-wrap:nowrap;[\s\S]*?flex:0 0 auto;/);
  assert.match(css,/\.flight-detail-more\{position:relative;flex:0 0 auto\}/);
});

test("3.5.4 moves the whole navigation group below identity on narrower tablets",()=>{
  const css=read("app/ui-system.css");

  assert.match(css,/@media\(max-width:1180px\)\{[\s\S]*?\.flight-detail-header\{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/@media\(max-width:1180px\)\{[\s\S]*?\.flight-detail-navigation\{[\s\S]*?width:100%;[\s\S]*?justify-content:flex-start/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.flight-detail-navigation\{[\s\S]*?display:grid/);
  assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.flight-detail-step-group\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("3.5.4 fully hides the skip link until keyboard focus",()=>{
  const css=read("app/ui-system.css");
  const layout=read("app/layout.tsx");

  assert.ok(layout.indexOf('import "./ui-system.css"')>layout.indexOf('import "./v300-u6-acceptance.css"'));
  assert.match(css,/\.skip-link:not\(:focus\):not\(:focus-visible\)\{[\s\S]*?width:1px;[\s\S]*?height:1px;[\s\S]*?clip-path:inset\(50%\);[\s\S]*?border:0;[\s\S]*?transform:none/);
  assert.match(css,/\.skip-link:focus,[\s\S]*?\.skip-link:focus-visible\{[\s\S]*?width:auto;[\s\S]*?height:auto;[\s\S]*?clip-path:none;[\s\S]*?border:2px solid var\(--accent2\);[\s\S]*?transform:none/);
});
