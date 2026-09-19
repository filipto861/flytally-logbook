import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.3 U11 makes the route itself the primary flight-list open action",()=>{
  const page=read("app/(protected)/flights/page.tsx");
  assert.match(page,/className="flight-route-link"/);
  assert.match(page,/aria-label={`Open flight/);
  assert.doesNotMatch(page,/>View flight<|>Open →</);
  assert.match(page,/className="flight-identity"/);
  assert.match(page,/<th>Flight<\/th><th>Route<\/th><th>Times<\/th><th>Logged time<\/th><th>Role \/ status<\/th><th>Landings<\/th><th>GPS<\/th><th>Cost<\/th>/);
});

test("v3.3 U11 separates navigation from secondary flight-detail actions",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(page,/flight-detail-nav-main/);
  assert.match(page,/flight-detail-more/);
  assert.match(page,/>Audit history</);
  assert.doesNotMatch(page,/certified\?<Link className="secondary-link" href=\{`\/flights\/\$\{id\}\/share`\}>Share<\/Link>/);
});

test("v3.3 U11 keeps one primary next action in the record workflow",()=>{
  const workflow=read("components/flight-workflow-progress.tsx"),detail=read("components/flight-detail-workspace.tsx");
  assert.match(workflow,/href={state\.shareHref}>Share flight<\/Link>/);
  assert.match(workflow,/const stage=\(label:string,status:/);
  assert.doesNotMatch(workflow,/Available after certification/);
  assert.match(detail,/postSave\?"logbook":initialTab/);
  assert.doesNotMatch(detail,/flight-post-save/);
});

test("v3.3 U11 gives certification and public sharing explicit pending feedback",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx"),share=read("app/(protected)/flights/[id]/share/page.tsx");
  for(const label of ["Opening…","Unlocking…","Locking…","Certifying…"])assert.ok(page.includes(label),label);
  for(const label of ["Creating…","Rotating…","Revoking…"])assert.ok(share.includes(label),label);
  assert.match(page,/PendingActionButton/);
  assert.match(share,/PendingActionButton/);
});

test("v3.3 U11 ships responsive list, workflow and More-action styling",()=>{
  const css=read("app/ui-system.css");
  for(const token of [".flight-route-link",".flight-detail-more-menu",".flight-workflow-step"])assert.ok(css.includes(token),token);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*\.flight-detail-more-menu/);
  assert.match(css,/\.flight-workflow-steps\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});
