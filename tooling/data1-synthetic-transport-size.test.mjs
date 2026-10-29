import assert from "node:assert/strict";
import {test} from "node:test";
import {
  createSyntheticPayload,measureSyntheticTransport,syntheticPresetNames,
} from "./data1-synthetic-transport-size.mjs";

test("DATA-1D offline tool has bounded synthetic-only presets",()=>{
  assert.deepEqual(syntheticPresetNames(),["small","medium","large"]);
  assert.throws(()=>createSyntheticPayload("production"),/Unknown synthetic preset/);
  const data=createSyntheticPayload("small");
  assert.equal(data.version,13);
  assert.equal(data.flights.length,40);
  assert.equal(data.flight_tracks.length,40);
  assert.equal(data.flight_tracks[0].flight_id,1);
  assert.equal(data.profile.email,"synthetic@example.invalid");
});

test("DATA-1D size results contain aggregates only, never claimed HTTP limits",()=>{
  const a=measureSyntheticTransport("small"),b=measureSyntheticTransport("small");
  assert.deepEqual(a,b);
  assert.equal(a.verifiedNeonRequestLimitBytes,null);
  assert.equal(a.verifiedNeonResponseLimitBytes,null);
  assert.ok(a.syntheticSnapshotJsonBytes>0);
  assert.ok(a.gzipLevel9Bytes<a.prettyArchiveJsonBytes);
  assert.equal(a.base64FieldBytes,4*Math.ceil(a.gzipLevel9Bytes/3));
  assert.ok(!JSON.stringify(a).includes("coordinates_json"));
  assert.ok(!JSON.stringify(a).includes("flight_id"));
});
