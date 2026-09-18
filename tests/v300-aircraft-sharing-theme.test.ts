import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 aircraft sharing surfaces follow FlyTally light and dark themes",()=>{
  const css=read("app/v300-aircraft-sharing.css");
  assert.match(css,/aircraft-photo-section,.aircraft-share-section\{[^}]*background:var\(--panel\)/s);
  assert.match(css,/share-check,.share-fixed-row\{[^}]*background:var\(--surface-raised\)/s);
  assert.match(css,/share-profile-grid>div\{[^}]*background:var\(--surface-raised\)/s);
  assert.match(css,/html\[data-theme="light"\] \.aircraft-photo-section/);
  assert.match(css,/html\[data-theme="light"\] \.share-check/);
  assert.match(css,/html\[data-theme="light"\] \.aircraft-share-conflict/);
  assert.match(css,/html\[data-theme="dark"\] \.aircraft-share-conflict/);
  assert.doesNotMatch(css,/aircraft-photo-section,.aircraft-share-section\{[^}]*background:#071321/s);
  assert.doesNotMatch(css,/share-check,.share-fixed-row\{[^}]*background:#091827/s);
  assert.doesNotMatch(css,/share-profile-grid>div\{[^}]*background:#081522/s);
});
