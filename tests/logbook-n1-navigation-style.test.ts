import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(filename:string)=>fs.readFileSync(path.join(root,filename),"utf8");

test("N1-A keeps one task-oriented sidebar and original routes",()=>{
  const sidebar=read("components/sidebar.tsx");
  const main=sidebar.slice(sidebar.indexOf("const mainLinks=["),sidebar.indexOf("] as const;",sidebar.indexOf("const mainLinks=[")));
  const records=sidebar.slice(sidebar.indexOf("const recordLinks=["),sidebar.indexOf("] as const;",sidebar.indexOf("const recordLinks=[")));
  for(const url of ["/dashboard","/flights","/map","/statistics"])assert.ok(main.includes(`href:"${url}"`),url);
  for(const url of ["/credentials","/database","/connections","/data","/profile"])assert.ok(records.includes(`href:"${url}"`),url);
  assert.match(sidebar,/href="\/flights\/new"/);
  assert.match(sidebar,/Pilot & records/);
  assert.match(sidebar,/aria-current=\{active\?"page":undefined\}/);
  assert.match(sidebar,/pathname\.startsWith\("\/flights\/"\)/);
});

test("N1-A reuses existing accent and theme contrast tokens instead of rebranding",()=>{
  const css=read("components/sidebar.module.css");
  assert.match(css,/\.primaryAction\{[^}]*background:var\(--accent-strong\)!important/);
  assert.match(css,/\.primaryAction\{[^}]*color:var\(--accent-contrast\)!important/);
  assert.match(css,/\.primaryAction:focus-visible\{outline:2px solid var\(--focus-color\)/);
  assert.match(css,/\.recordLink\{height:48px!important/);
  assert.match(css,/\.groupTitle\{[^}]*color:var\(--text-soft\)/);
});

test("N1-A scopes modern active/hover styles to the global sidebar only",()=>{
  const css=read("app/ui-system.css");
  const start=css.indexOf("/* N1-A — menu-only visual hierarchy.");
  assert.ok(start>=0,"N1-A scoped stylesheet rules missing");
  const n1=css.slice(start);
  assert.match(n1,/\.app-grid \.sidebar nav a\.active \{/);
  assert.match(n1,/box-shadow:inset 3px 0 0 var\(--accent\)/);
  assert.match(n1,/\.app-grid \.sidebar nav a:focus-visible \{/);
  assert.match(n1,/@media screen and \(min-width:821px\)/);
  assert.match(n1,/@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(n1,/\.page-header|\.flight-form|\.credentials-tabs|\.statistics-/);
});

test("N1-A preserves mobile close, Escape, keyboard trap and iPad edge handle",()=>{
  const sidebar=read("components/sidebar.tsx");
  const ui=read("app/ui-system.css");
  assert.match(sidebar,/localStorage\.setItem\("logbook-sidebar"/);
  assert.match(sidebar,/event\.key==="Escape"/);
  assert.match(sidebar,/event\.key!=="Tab"/);
  assert.match(sidebar,/document\.body\.style\.overflow="hidden"/);
  assert.match(sidebar,/aria-expanded=\{mobile\}/);
  assert.match(sidebar,/className="mobile-nav-backdrop"/);
  assert.match(ui,/@media screen and \(min-width:821px\) and \(pointer:coarse\)/);
});

test("N1 V2 makes the menu structurally legible without changing navigation destinations",()=>{
  const sidebar=read("components/sidebar.tsx");
  const css=read("components/sidebar.module.css");
  const ui=read("app/ui-system.css");
  assert.match(sidebar,/className=\{styles\.brandCopy\}/);
  assert.match(sidebar,/className=\{styles\.primaryNavLabel\}>Workspace/);
  assert.match(css,/\.primaryNavLabel\{[^}]*color:var\(--text-soft\)/);
  assert.match(css,/\.recordLink\{height:48px!important/);
  assert.match(ui,/\/\* N1 V2-1 — substantial theme-adaptive navigation redesign/);
  assert.match(ui,/\.app-grid \.sidebar nav a\{[\s\S]*?min-height:48px/);
  assert.match(ui,/\.app-grid \.sidebar nav a\.active\{[\s\S]*?box-shadow:inset 3px 0 0 var\(--accent-strong\)/);
});

test("N1 V2 sidebar and drawer adapt to resolved light and dark themes",()=>{
  const ui=read("app/ui-system.css");
  const v2=ui.slice(ui.indexOf("/* N1 V2-1 — substantial theme-adaptive navigation redesign."));
  assert.match(v2,/html\[data-theme="light"\] \.app-grid \.sidebar\{/);
  assert.match(v2,/html\[data-theme="dark"\] \.app-grid \.sidebar\{/);
  assert.match(v2,/html\[data-theme="dark"\] \.app-grid \.sidebar nav/);
  assert.match(v2,/@media screen and \(max-width:820px\)/);
  assert.match(v2,/--mobile-shell-height:64px/);
  assert.match(v2,/@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(v2,/\.flight-form|\.statistics-|\.credentials-tabs|\.dashboard-widget/);
});
