import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { actionableIntelligentAttention } from "../lib/actionable-intelligent-attention.ts";
import type { IntelligentAttentionFlight } from "../lib/intelligent-logbook.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const warningOnly:IntelligentAttentionFlight={flightId:1,date:"2026-09-01",registration:"OK-AAA",route:"LKPR → LKPR",insights:[{code:"duration_outlier",tone:"warning",title:"Long flight",message:"Correct but unusual"}]};
const actionable:IntelligentAttentionFlight={flightId:2,date:"2026-09-02",registration:"OK-BBB",route:"LKPR → LKBE",insights:[{code:"incomplete_block_pair",tone:"attention",title:"Incomplete BLOCK",message:"On-block is missing"},{code:"movement_history_outlier",tone:"warning",title:"Many movements",message:"Correct but unusual"}]};

test("v1.70.1 needs-attention queue contains only actionable findings",()=>{
  const result=actionableIntelligentAttention([warningOnly,actionable]);
  assert.equal(result.length,1);
  assert.equal(result[0].flightId,2);
  assert.deepEqual(result[0].insights.map(item=>item.code),["incomplete_block_pair"]);
  assert.ok(result[0].insights.every(item=>item.tone==="attention"));
});

test("v1.70.1 hides needs-attention navigation and dashboard action when the actionable count is zero",()=>{
  const sidebar=read("components/sidebar.tsx"),dashboard=read("app/(protected)/dashboard/page.tsx"),layout=read("app/(protected)/layout.tsx"),service=read("lib/intelligent-logbook-service.ts");
  assert.match(sidebar,/attentionCount>0/);
  assert.match(sidebar,/flights need attention/);
  assert.match(dashboard,/attentionItems[.]length[?]/);
  assert.match(layout,/attentionCount={attentionItems[.]length}/);
  assert.match(service,/actionableIntelligentAttention/);
  assert.match(service,/cache[(]/);
});

test("v1.70.1 direct needs-attention page explains that unusual valid history is not a problem",()=>{
  const page=read("app/(protected)/flights/needs-attention/page.tsx");
  assert.match(page,/Only stored flights with a concrete contradiction/);
  assert.match(page,/Longer flights, higher movement counts/);
  assert.doesNotMatch(page,/History or plausibility warnings/);
});
