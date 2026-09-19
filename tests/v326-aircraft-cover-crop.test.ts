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

test("cover rendering applies the selected zoom and offset before upload",()=>{
  assert.match(editor,/renderCover\(source,zoom,offset\.x,offset\.y\)/);
  assert.match(editor,/const sw=baseWidth\/zoom,sh=baseHeight\/zoom/);
  assert.match(editor,/ctx\.drawImage\(image,sx,sy,sw,sh,0,0,OUTPUT_WIDTH,OUTPUT_HEIGHT\)/);
});
