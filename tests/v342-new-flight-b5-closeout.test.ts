import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const luminance=(hex:string)=>{
  const values=[hex.slice(1,3),hex.slice(3,5),hex.slice(5,7)].map(part=>parseInt(part,16)/255).map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));
  return .2126*values[0]+.7152*values[1]+.0722*values[2];
};
const contrast=(a:string,b:string)=>{
  const [high,low]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (high+.05)/(low+.05);
};

test("B5 measured helper and action colors meet normal-text AA on New Flight surfaces",()=>{
  const tokens=read("app/v150-ui-system.css");
  const ui=read("app/ui-system.css");
  for(const token of ["--muted:#8ea3bb","--panel:#0e1b2d","--link:#67d5fb","--muted:#66788d","--panel:#ffffff","--link:#066f9f"])assert.ok(tokens.includes(token),token);
  for(const [fg,bg] of [["#8ea3bb","#0e1b2d"],["#67d5fb","#0e1b2d"],["#66788d","#ffffff"],["#066f9f","#ffffff"]])assert.ok(contrast(fg,bg)>=4.5,`${fg} on ${bg} must meet 4.5:1`);
  assert.match(ui,/\.entry-summary-action\{color:var\(--link\)\}/);
});

test("B5 remains presentation-only around canonical parser certification and optional billing",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const parser=read("lib/flight-input.ts");
  assert.match(actions,/parseFlightInput\(form\)/);
  assert.match(parser,/serializeOptionalBilling/);
  assert.match(read("lib/fcl050-compliance.ts"),/blockingComplianceIssues/);
});
