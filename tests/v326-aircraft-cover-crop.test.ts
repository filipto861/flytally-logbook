import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const editor=fs.readFileSync("components/aircraft-photo-editor.tsx","utf8");
const css=fs.readFileSync("app/globals.css","utf8");

test("aircraft cover uses an interactive 16:9 crop editor",()=>{
  assert.match(editor,/Crop your aircraft cover/);
  assert.match(editor,/type="range"/);
  assert.match(editor,/onPointerMove/);
  assert.match(editor,/Use this crop/);
  assert.match(css,/\.aircraft-crop-stage/);
  assert.match(css,/aspect-ratio:16\/9/);
});

test("crop preview and saved cover use the same crop geometry",()=>{
  assert.match(editor,/function getCropRect/);
  assert.match(editor,/function drawCrop/);
  assert.match(editor,/drawCrop\(cropCanvas\.current,source,zoom,offset,PREVIEW_WIDTH,PREVIEW_HEIGHT\)/);
  assert.match(editor,/drawCrop\(canvas,source,zoom,offset,OUTPUT_WIDTH,OUTPUT_HEIGHT\)/);
  assert.match(editor,/ctx\.drawImage\(source\.image,sx,sy,sw,sh,0,0,width,height\)/);
});

test("crop panning can reach the full source bounds",()=>{
  assert.match(editor,/travelX\/2-clamp\(offsetX\)\*travelX\/2/);
  assert.match(editor,/travelY\/2-clamp\(offsetY\)\*travelY\/2/);
  assert.doesNotMatch(editor,/offset\.x\*25|offset\.y\*25/);
});
