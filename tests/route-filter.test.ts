import test from "node:test";
import assert from "node:assert/strict";
import { parseRoutePair,routePairHref,routePairKey } from "../lib/route-filter.ts";

test("map route keys are direction independent",()=>{
  assert.equal(routePairKey("LKRO","LKSZ"),"LKRO↔LKSZ");
  assert.equal(routePairKey("lksz","lkro"),"LKRO↔LKSZ");
});

test("map routes create a valid filtered flights URL",()=>{
  assert.equal(routePairHref("LKSZ","LKRO"),"/flights?routePair=LKRO%E2%86%94LKSZ");
});

test("route pair filter accepts only two different airports",()=>{
  assert.deepEqual(parseRoutePair("LKRO↔LKSZ"),{from:"LKRO",to:"LKSZ"});
  assert.equal(parseRoutePair("LKRO"),null);
  assert.equal(parseRoutePair("LKRO↔LKRO"),null);
});
