import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 defines one canonical spacing and async-interaction layer",()=>{
  const css=read("app/ui-system.css");
  for(const token of ["--ui-space-2","--ui-space-3","--ui-space-4","--ui-space-6","--ui-card-gap","--ui-section-gap"])assert.match(css,new RegExp(token));
  assert.match(css,/data-loading="true"/);
  assert.match(css,/form\[aria-busy="true"\]/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test("v3.2 pending action button prevents duplicate server-action submissions",()=>{
  const source=read("components/pending-action-button.tsx");
  assert.match(source,/useFormStatus/);
  assert.match(source,/disabled=\{blocked\}/);
  assert.match(source,/aria-busy=\{pending\|\|undefined\}/);
  assert.match(source,/data-loading=\{pending\?"true":undefined\}/);
  assert.match(source,/pendingLabel/);
});

test("v3.2 loads the canonical UI system after legacy product layers",()=>{
  const layout=read("app/layout.tsx");
  assert.ok(layout.indexOf('import "./ui-system.css"')>layout.indexOf('import "./v300-u6-acceptance.css"'));
});

test("v3.2 uses pending feedback across high-risk user mutations",()=>{
  const cases=[
    ["components/delete-flight-button.tsx","Deleting…"],
    ["components/aircraft-share-inbox.tsx","Cancelling…"],
    ["components/aircraft-manager.tsx","Updating…"],
    ["components/aircraft-photo-editor.tsx","Removing…"],
    ["components/track-manager.tsx","Deleting…"],
    ["components/in-person-signature-pad.tsx","Signing…"],
    ["components/training-flight-candidates.tsx","Creating…"],
    ["components/advanced-qualifications-panel.tsx","Saving…"],
  ] as const;
  for(const[file,label] of cases){
    const source=read(file);
    assert.match(source,/PendingActionButton/,file);
    assert.ok(source.includes(`pendingLabel="${label}"`),`${file} missing ${label}`);
  }
});

test("v3.2 maps common workspace layouts onto the shared rhythm",()=>{
  const css=read("app/ui-system.css");
  assert.match(css,/\.page-header,.workspace-heading/);
  assert.match(css,/\.metric-grid,.dashboard-primary/);
  assert.match(css,/\.flight-form,.data-hub/);
  assert.match(css,/\.form-grid,.stack-form/);
});
