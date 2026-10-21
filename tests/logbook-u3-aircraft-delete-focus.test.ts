import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const manager=fs.readFileSync(path.join(root,"components/aircraft-manager.tsx"),"utf8");

test("U3 returns keyboard focus to surviving confirmation after successful aircraft deletion",()=>{
  assert.match(manager,/libraryStatusRef=useRef<HTMLParagraphElement\|null>\(null\)/);
  assert.match(manager,/if\(!libraryStatus\?\.ok\|\|selectedId\)return;/);
  assert.match(manager,/requestAnimationFrame\(\(\)=>libraryStatusRef\.current\?\.focus\(\)\)/);
  assert.match(manager,/return\(\)=>cancelAnimationFrame\(frame\)/);
  assert.match(manager,/\[libraryStatus,selectedId\]/);

  const statusStart=manager.indexOf("{libraryStatus?<p");
  assert.ok(statusStart>=0);
  const status=manager.slice(statusStart,manager.indexOf("</p>",statusStart));
  assert.match(status,/ref=\{libraryStatusRef\}/);
  assert.match(status,/tabIndex=\{-1\}/);
  assert.match(status,/role="status"/);
  assert.match(status,/\{libraryStatus\.message\}/);
});

test("U3 preserves aircraft deletion eligibility, async feedback and cancellation focus",()=>{
  const start=manager.indexOf("const deleteSelected=async");
  const end=manager.indexOf("return <div className=\"aircraft-manager\">",start);
  assert.ok(start>=0&&end>start);
  const deletion=manager.slice(start,end);
  assert.match(deletion,/setDeleting\(true\)/);
  assert.match(deletion,/if\(result\.ok\)\{setLibraryStatus\(result\);setSelectedId\(null\)\}else setDeleteStatus\(result\)/);
  assert.match(deletion,/finally\{setDeleting\(false\)\}/);
  assert.match(manager,/disabled=\{selectedFlightCount>0\|\|deleting\}/);
  assert.match(manager,/role=\{deleteStatus\.ok\?"status":"alert"\}/);
  assert.match(manager,/const closeModal=\(\)=>\{setSelectedId\(null\);requestAnimationFrame\(\(\)=>openerRef\.current\?\.focus\(\)\)\}/);
  assert.match(manager,/if\(event\.key==="Escape"\)\{event\.preventDefault\(\);closeModal\(\);return\}/);
});
