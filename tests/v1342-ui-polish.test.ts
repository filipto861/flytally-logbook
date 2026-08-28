import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const releaseAtLeast=(actual:string,minimum:string)=>{const a=actual.split(".").map(Number),b=minimum.split(".").map(Number);for(let i=0;i<3;i++){if((a[i]??0)>(b[i]??0))return true;if((a[i]??0)<(b[i]??0))return false}return true};

test("v1.34.2 ships a final UI consistency layer after theme interaction overrides",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,"1.34.2"));
  const layout=read("app/layout.tsx"),css=read("app/v1342-ui-polish.css");
  assert.match(layout,/light-interactions[.]css[\s\S]*v1342-ui-polish[.]css/);
  assert.match(css,/--ui-touch-min:44px/);
  assert.match(css,/@media\(hover:hover\) and \(pointer:fine\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.page-header\{align-items:stretch;flex-direction:column\}/);
});

test("Connections navigation uses a recognizable multi-pilot group icon",()=>{
  const icon=read("components/nav-icon.tsx");
  assert.match(icon,/connections:<><path d="M16 21v-2a4 4 0 0 0-4-4H6/);
  assert.match(icon,/<circle cx="9" cy="7" r="4"\/>/);
  assert.match(icon,/M22 21v-2a4 4 0 0 0-3-3\.87/);
});
