import test from "node:test";
import assert from "node:assert/strict";
import {trackTimestampBasis,trackTimeBasis,utcParts} from "../lib/track-time.ts";

test("track timestamps with an explicit zone are normalized to UTC",()=>{
  assert.equal(trackTimestampBasis("2026-08-23T15:24:00+02:00"),"offset");
  assert.deepEqual(utcParts("2026-08-23T15:24:00+02:00"),{date:"2026-08-23",time:"13:24"});
  assert.deepEqual(utcParts("2026-08-23T13:24:00Z"),{date:"2026-08-23",time:"13:24"});
});

test("timezone-less track timestamps are never guessed from the device clock",()=>{
  assert.equal(trackTimestampBasis("2026-08-23T15:24:00"),"ambiguous");
  assert.equal(utcParts("2026-08-23T15:24:00"),null);
  assert.equal(trackTimeBasis([{time:"2026-08-23T13:24:00Z"},{time:"2026-08-23T15:24:00+02:00"}]),"offset");
  assert.equal(trackTimeBasis([{time:"2026-08-23T15:24:00"}]),"ambiguous");
});
