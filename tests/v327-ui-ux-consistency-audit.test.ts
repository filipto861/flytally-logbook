import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 U7 brings remaining core routes onto the canonical page stack",()=>{
  const routes=[
    "app/(protected)/statistics/page.tsx",
    "app/(protected)/map/page.tsx",
    "app/(protected)/fstd/page.tsx",
    "app/(protected)/actions/page.tsx",
    "app/(protected)/notifications/page.tsx",
    "app/(protected)/flights/new/page.tsx",
  ];
  for(const route of routes)assert.match(read(route),/ui-page-stack/,route);
  const css=read("app/ui-system.css");
  for(const selector of [".period-control",".metric-grid",".flight-summary",".saved-next-flight",".map-panel"])assert.ok(css.includes(selector),selector);
  assert.match(css,/page-header > \.connection-actions/);
});

test("v3.2 U7 gives FSTD mutations explicit pending feedback",()=>{
  const source=read("app/(protected)/fstd/page.tsx");
  assert.match(source,/PendingActionButton/);
  for(const label of ["Saving…","Opening…","Certifying…","Deleting…"])assert.ok(source.includes(`pendingLabel="${label}"`),label);
  assert.doesNotMatch(source,/<button className="primary-button">Save FSTD session<\/button>/);
});

test("v3.2 U7 gives action and notification mutations explicit pending feedback",()=>{
  const actions=read("app/(protected)/actions/page.tsx");
  const notifications=read("app/(protected)/notifications/page.tsx");
  for(const source of [actions,notifications])assert.match(source,/PendingActionButton/);
  for(const label of ["Accepting…","Declining…"])assert.ok(actions.includes(`pendingLabel="${label}"`),label);
  for(const label of ["Marking…","Clearing…","Declining…","Deleting…"])assert.ok(notifications.includes(`pendingLabel="${label}"`),label);
});
