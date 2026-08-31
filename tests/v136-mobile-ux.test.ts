import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.36.2 iOS status-area safeguards remain supported by later releases",()=>{
  const layout=read("app/layout.tsx"),protectedLayout=read("app/(protected)/layout.tsx"),manager=read("components/theme-manager.tsx"),shell=read("components/app-shell.tsx"),css=read("app/v136-mobile.css"),sidebar=read("components/sidebar.tsx");
  assert.match(layout,/statusBarStyle:"default"/);assert.match(layout,/v136-mobile[.]css/);
  assert.match(protectedLayout,/generateViewport/);assert.match(protectedLayout,/themeColor/);assert.match(protectedLayout,/appearance==="light"\?"#f4f7fb":"#071018"/);assert.match(protectedLayout,/cache\(async/);
  assert.match(shell,/data-appearance=\{appearance\}/);assert.doesNotMatch(shell,/themeBootstrapScript|<script|dangerouslySetInnerHTML/);
  assert.doesNotMatch(manager,/querySelectorAll<HTMLMetaElement>|apple-mobile-web-app-status-bar-style|removeAttribute\("media"\)/);
  assert.match(css,/html:has\(\.app-grid\[data-appearance="light"\]\)/);assert.match(css,/safe-area-inset-top/);assert.match(css,/pointer-events:none/);
  assert.doesNotMatch(css,/mobile-nav-backdrop|sidebar nav|mobile-toggle|safe-area-inset-left|safe-area-inset-right/);
  assert.match(sidebar,/onClick=\{\(\)=>setMobile\(false\)\}/);assert.match(sidebar,/setMobile\(false\)\},\[pathname\]\)/);
});

test("v1.36 compact mobile recency remains supported without changing the engine",()=>{
  const css=read("app/v136-mobile.css"),service=read("lib/recency-service.ts");
  assert.match(css,/recency-card-v135 li[.]met>span:first-child>small\{display:none\}/);
  assert.match(css,/recency-overview-panel/);
  assert.match(service,/evaluatePassengerCurrencyMode/);
});
