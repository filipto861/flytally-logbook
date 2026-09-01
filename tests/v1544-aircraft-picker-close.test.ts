import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.54.4 confirmed aircraft catalogue selection stays closed",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,54,4));
  const picker=read("components/aircraft-type-picker.tsx");
  assert.match(picker,/confirmedQuery=useRef\(""\)/);
  assert.match(picker,/if\(value===confirmedQuery[.]current\)\{setResults\(\[\]\);setLoading\(false\);setOpen\(false\);return\}/);
  assert.match(picker,/confirmedQuery[.]current=entry[.]label;requestId[.]current\+=1/);
  assert.match(picker,/setResults\(\[\]\);setLoading\(false\);setOpen\(false\)/);
  assert.match(picker,/onChange=\{event=>\{confirmedQuery[.]current="";setQuery\(event[.]target[.]value\);setOpen\(true\)\}\}/);
});
