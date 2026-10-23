import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("N1 V2-2 scopes the workspace masthead without changing app-shell behavior",()=>{
  const shell=read("components/app-shell.tsx");
  assert.match(shell,/className="app-grid" data-appearance=\{appearance\}/);
  assert.match(shell,/<div className="shell-workspace">\{children\}<\/div>/);
  assert.match(shell,/<Sidebar role=\{role\} attentionCount=\{attentionCount\} notificationCount=\{notificationCount\}\/>/);
  assert.match(shell,/<main id="main-content" tabIndex=\{-1\} className="content"/);
  assert.match(shell,/<LegalFooter compact\/>/);
  assert.match(shell,/<ThemeManager preference=\{appearance\}\/>/);
});

test("N1 V2-2 is limited to first protected workspace page headers",()=>{
  const css=read("app/ui-system.css");
  const start=css.indexOf("/* N1 V2-2 — protected-app masthead only;");
  assert.ok(start>=0,"N1 V2-2 CSS contract absent");
  const section=css.slice(start);
  assert.match(section,/\.app-grid \.shell-workspace > \.ui-page-stack > \.page-header/);
  assert.match(section,/\.app-grid \.shell-workspace > \.page-header/);
  assert.match(section,/background:var\(--surface\)/);
  assert.match(section,/color:var\(--text-soft\)/);
  assert.match(section,/border-radius:var\(--ui-radius-card\)/);
  assert.match(section,/@media\(max-width:820px\)/);
  assert.match(section,/@media\(max-width:600px\)/);
  assert.match(section,/@media print/);
  assert.doesNotMatch(section,/(?:^|\n)\s*\.flight-form\b|\.credentials-tabs\b|\.statistics-|\.dashboard-widget|\.panel\{/);
  assert.doesNotMatch(section,/animation:|backdrop-filter:|transition:all/);
});

test("N1 V2-2 preserves flight and statistics contextual header actions",()=>{
  const flight=read("app/(protected)/flights/page.tsx");
  const dashboard=read("app/(protected)/dashboard/page.tsx");
  const stats=read("app/(protected)/statistics/page.tsx");
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(flight,/<header className="page-header">[\s\S]*href="\/flights\/new"/);
  assert.match(dashboard,/<header className="page-header">[\s\S]*href="\/flights\/new"/);
  assert.match(stats,/<header className="page-header">[\s\S]*href="\/dashboard"/);
  assert.match(detail,/className="page-header flight-detail-header"/);
  const css=read("app/ui-system.css");
  assert.match(css,/\.app-grid \.shell-workspace > \.flight-detail-header\{/);
});
