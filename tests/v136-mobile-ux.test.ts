import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.36.0 synchronizes iOS chrome with the selected FlyTally appearance",()=>{
  assert.equal(JSON.parse(read("package.json")).version,"1.36.0");
  const layout=read("app/layout.tsx"),manager=read("components/theme-manager.tsx"),shell=read("components/app-shell.tsx"),css=read("app/v136-mobile.css");
  assert.match(layout,/statusBarStyle:"default"/);assert.match(layout,/v136-mobile[.]css/);
  assert.match(manager,/querySelectorAll<HTMLMetaElement>/);assert.match(manager,/removeAttribute\("media"\)/);assert.match(manager,/apple-mobile-web-app-status-bar-style/);
  assert.match(shell,/themeBootstrapScript/);assert.match(shell,/dataset[.]theme/);assert.match(shell,/theme-color/);
  assert.match(css,/safe-area-inset-top/);assert.match(css,/safe-area-inset-left/);assert.match(css,/safe-area-inset-right/);
});

test("v1.36.0 keeps mobile recency readable without changing the engine",()=>{
  const css=read("app/v136-mobile.css"),roadmap=read("ROADMAP.md"),service=read("lib/recency-service.ts");
  assert.match(css,/recency-card-v135 li[.]met>span:first-child>small\{display:none\}/);
  assert.match(css,/min-width:44px/);assert.match(css,/recency-overview-panel/);
  assert.match(roadmap,/Recency Engine logic remains the v1[.]35[.]5 landing-based planning model/);
  assert.match(service,/evaluatePassengerLandingIndicator/);
});
