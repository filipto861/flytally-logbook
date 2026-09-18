import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U1.2 keeps Actions visible without a redundant Activity section",()=>{
  const sidebar=read("components/sidebar.tsx");
  assert.match(sidebar,/actionCount>0\?<Link/);
  assert.match(sidebar,/href="\/actions"/);
  assert.doesNotMatch(sidebar,/>Activity<\/span>/);
});

test("v3.0 U1.2 removes tree-style record navigation",()=>{
  const sidebar=read("components/sidebar.tsx");
  const css=read("components/sidebar.module.css");
  assert.match(sidebar,/styles\.recordLink/);
  assert.doesNotMatch(sidebar,/sidebar-sub-link/);
  assert.doesNotMatch(css,/recordLink[^}]*border-left/);
});

test("v3.0 U1.2 uses theme-aware section labels and mobile record sizing",()=>{
  const css=read("components/sidebar.module.css");
  assert.match(css,/groupTitle\{[^}]*color:color-mix\(in srgb,var\(--text\)/s);
  assert.doesNotMatch(css,/#d7e5f4/i);
  assert.match(css,/@media\(max-width:820px\)[\s\S]*\.recordLink\{height:44px/s);
});

test("v3.0 U1.2 gives collapsed desktop chrome a non-overlapping vertical stack",()=>{
  const css=read("components/sidebar.module.css");
  assert.match(css,/@media\(min-width:821px\)[\s\S]*sidebar\.collapsed[\s\S]*sidebar-brand[\s\S]*flex-direction:column/s);
  assert.match(css,/min-height:94px/);
  assert.match(css,/sidebar\.collapsed[\s\S]*notificationBell\{margin:0 auto\}/s);
});

test("v3.0 U1.2 constrains the desktop notification inbox without shrinking mobile",()=>{
  const page=read("app/(protected)/notifications/page.tsx");
  const css=read("app/(protected)/notifications/notifications.module.css");
  assert.match(page,/className=\{styles\.inbox\}/);
  assert.match(css,/width:min\(100%,1180px\)/);
  assert.match(css,/@media\(max-width:820px\)\{\.inbox\{width:100%\}\}/);
});


test("v3.0 U1.3 keeps Administration visually separate from Pilot & records",()=>{
  const sidebar=read("components/sidebar.tsx");
  const css=read("components/sidebar.module.css");
  assert.match(sidebar,/styles\.adminLink/);
  assert.match(css,/\.adminLink\{[^}]*border-top:1px solid var\(--line\)/s);
  assert.match(css,/sidebar\.collapsed[\s\S]*\.adminLink[\s\S]*border-top:0/s);
});
