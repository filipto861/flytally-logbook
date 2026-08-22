import test from "node:test";
import assert from "node:assert/strict";
import { parseRoutePair,routePairKey } from "../lib/route-filter.ts";

test("map route keys are direction independent",()=>{
  assert.equal(routePairKey("LKRO","LKSZ"),"LKRO↔LKSZ");
  assert.equal(routePairKey("lksz","lkro"),"LKRO↔LKSZ");
});

test("route pair filter accepts only two different airports",()=>{
  assert.deepEqual(parseRoutePair("LKRO↔LKSZ"),{from:"LKRO",to:"LKSZ"});
  assert.equal(parseRoutePair("LKRO"),null);
  assert.equal(parseRoutePair("LKRO↔LKRO"),null);
});
