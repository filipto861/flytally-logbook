import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("3.5.5 keeps the iPad collapse control clear of the brand content",()=>{
  const css=read("app/ui-system.css");

  assert.match(css,/@media screen and \(min-width:821px\) and \(pointer:coarse\)\{[\s\S]*?\.sidebar-toggle\{[\s\S]*?right:-44px;[\s\S]*?top:50%;[\s\S]*?transform:translateY\(-50%\)/);
});

test("3.5.5 preserves the canonical coarse-pointer touch target",()=>{
  const acceptance=read("app/v300-u6-acceptance.css");

  assert.match(acceptance,/@media \(max-width:820px\),\(pointer:coarse\)\{[\s\S]*?\.sidebar-toggle[\s\S]*?min-inline-size:44px/);
  assert.match(acceptance,/:where\(button,[\s\S]*?summary\)\{[\s\S]*?min-height:44px/);
});

test("3.5.5 does not replace sidebar state or mobile navigation semantics",()=>{
  const sidebar=read("components/sidebar.tsx");
  const globals=read("app/globals.css");

  assert.match(sidebar,/localStorage\.setItem\("logbook-sidebar",next\?"collapsed":"open"\)/);
  assert.match(sidebar,/className="sidebar-toggle"/);
  assert.match(sidebar,/className="mobile-toggle"/);
  assert.match(globals,/@media screen and \(max-width:820px\)[\s\S]*?\.sidebar-toggle\{display:none!important\}/);
});
