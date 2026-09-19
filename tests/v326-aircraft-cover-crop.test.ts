import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const editor=fs.readFileSync("components/aircraft-photo-editor.tsx","utf8");
const manager=fs.readFileSync("components/aircraft-manager.tsx","utf8");
const globals=fs.readFileSync("app/globals.css","utf8");
const sharingCss=fs.readFileSync("app/v300-aircraft-sharing.css","utf8");

test("aircraft cover defaults to fitting the entire photo without cropping",()=>{
  assert.match(editor,/type CoverMode="fit"\|"crop"/);
  assert.match(editor,/useState<CoverMode>\("fit"\)/);
  assert.match(editor,/Fit whole photo/);
  assert.match(editor,/The complete photo is kept visible\. Nothing is cropped\./);
  assert.match(editor,/Math\.min\(width\/source\.width,height\/source\.height\)/);
});

test("crop-to-fill remains available as an explicit optional mode",()=>{
  assert.match(editor,/Crop to fill/);
  assert.match(editor,/mode==="crop"/);
  assert.match(editor,/type="range"/);
  assert.match(editor,/onPointerMove/);
  assert.match(globals,/\.aircraft-cover-mode/);
});

test("preview and saved cover share the same drawCover renderer",()=>{
  assert.match(editor,/drawCover\(cropCanvas\.current,source,mode,zoom,offset,PREVIEW_WIDTH,PREVIEW_HEIGHT\)/);
  assert.match(editor,/drawCover\(canvas,source,mode,zoom,offset,OUTPUT_WIDTH,OUTPUT_HEIGHT\)/);
});

test("aircraft card renders the saved cover without disturbing the desktop grid",()=>{
  assert.match(manager,/className="aircraft-card-cover"/);
  assert.match(manager,/<img src=\{photoUrl\} alt=""\/>/);
  assert.doesNotMatch(manager,/backgroundImage:.*photoUrl/);
  assert.match(sharingCss,/\.aircraft-card\.with-photo\{[^}]*grid-template-columns:116px minmax\(0,1fr\)/);
  assert.match(sharingCss,/grid-template-areas:"cover header" "summary summary" "action action"/);
  assert.match(sharingCss,/\.aircraft-card-cover img\{[^}]*object-fit:contain/);
  assert.match(sharingCss,/@media\(max-width:760px\)\{[\s\S]*grid-template-areas:"cover" "header" "summary" "action"/);
  assert.match(sharingCss,/@media\(max-width:760px\)\{[\s\S]*aspect-ratio:16\/9/);
});
