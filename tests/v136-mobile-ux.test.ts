import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.36.2 paints the iOS status area from saved appearance without touching navigation",()=>{
  assert.equal(JSON.parse(read("package.json")).version,"1.36.2");
  const layout=read("app/layout.tsx"),protectedLayout=read("app/(protected)/layout.tsx"),manager=read("components/theme-manager.tsx"),shell=read("components/app-shell.tsx"),css=read("app/v136-mobile.css"),sidebar=read("components/sidebar.tsx");
  assert.match(layout,/statusBarStyle:"default"/);assert.match(layout,/v136-mobile[.]css/);
  assert.match(protectedLayout,/generateViewport/);assert.match(protectedLayout,/themeColor/);assert.match(protectedLayout,/appearance==="light"\?"#f4f7fb":"#071018"/);assert.match(protectedLayout,/cache\(async/);
  assert.match(shell,/data-appearance=\{appearance\}/);assert.doesNotMatch(shell,/themeBootstrapScript|<script|dangerouslySetInnerHTML/);
  assert.doesNotMatch(manager,/querySelectorAll<HTMLMetaElement>|apple-mobile-web-app-status-bar-style|removeAttribute\("media"\)/);
  assert.match(css,/html:has\(\.app-grid\[data-appearance="light"\]\)/);assert.match(css,/safe-area-inset-top/);assert.match(css,/pointer-events:none/);
  assert.doesNotMatch(css,/mobile-nav-backdrop|sidebar nav|mobile-toggle|safe-area-inset-left|safe-area-inset-right/);
  assert.match(sidebar,/onClick=\{\(\)=>setMobile\(false\)\}/);assert.match(sidebar,/setMobile\(false\)\},\[pathname\]\)/);
});

test("v1.36.2 keeps compact mobile recency without changing the engine",()=>{
  const css=read("app/v136-mobile.css"),roadmap=read("ROADMAP.md"),service=read("lib/recency-service.ts");
  assert.match(css,/recency-card-v135 li[.]met>span:first-child>small\{display:none\}/);
  assert.match(css,/recency-overview-panel/);
  assert.match(roadmap,/Recency Engine logic remains the v1[.]35[.]5 landing-based planning model/);
  assert.match(service,/evaluatePassengerLandingIndicator/);
});
