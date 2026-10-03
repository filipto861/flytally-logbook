import assert from "node:assert/strict";
import test from "node:test";
import {
  CIVIL_TWILIGHT_CONFIDENCE_GUARD_DEG,
  aggregateCivilTwilightLandingEvents,
  classifyCivilTwilightEvent,
  geometricSolarAltitudeDegrees,
} from "../lib/civil-twilight.ts";

const classify=(timestamp:string,lat:number,lon:number)=>classifyCivilTwilightEvent({timestamp,lat,lon});

test("E1.3 civil twilight matches ordinary-latitude USNO reference sides outside the confidence guard",()=>{
  assert.equal(classify("2026-07-19T02:27:00Z",50.09,14.43),"NIGHT");
  assert.equal(classify("2026-07-19T02:37:00Z",50.09,14.43),"DAY");
  assert.equal(classify("2026-07-19T19:39:00Z",50.09,14.43),"DAY");
  assert.equal(classify("2026-07-19T19:49:00Z",50.09,14.43),"NIGHT");
});

test("E1.3 civil twilight matches equatorial reference sides",()=>{
  assert.equal(classify("2026-09-26T05:24:00Z",0,0),"NIGHT");
  assert.equal(classify("2026-09-26T05:30:00Z",0,0),"DAY");
  assert.equal(classify("2026-09-26T18:12:00Z",0,0),"DAY");
  assert.equal(classify("2026-09-26T18:18:00Z",0,0),"NIGHT");
});

test("E1.3 continuous summer twilight can classify DAY at supported high latitude",()=>{
  assert.equal(classify("2026-06-28T08:00:00Z",61.2,-149.9),"DAY");
});

test("E1.3 fails closed outside the supported calculation envelope",()=>{
  assert.equal(classify("2026-06-28T08:00:00Z",72.01,-149.9),"UNAVAILABLE");
  assert.equal(classify("1799-07-19T12:00:00Z",50.09,14.43),"UNAVAILABLE");
  assert.equal(classify("2101-07-19T12:00:00Z",50.09,14.43),"UNAVAILABLE");
  assert.equal(classify("2026-07-19T12:00:00",50.09,14.43),"UNAVAILABLE");
  assert.equal(classify("2026-07-19T12:00:00Z",91,14.43),"UNAVAILABLE");
  assert.equal(classify("2026-07-19T12:00:00Z",50.09,181),"UNAVAILABLE");
});

test("E1.3 fails closed inside the calculation-confidence guard around the unchanged -6 degree boundary",()=>{
  const altitude=geometricSolarAltitudeDegrees("2026-07-19T02:32:00Z",50.09,14.43);
  assert.notEqual(altitude,null);
  assert.ok(Math.abs((altitude??0)+6)<=CIVIL_TWILIGHT_CONFIDENCE_GUARD_DEG);
  assert.equal(classify("2026-07-19T02:32:00Z",50.09,14.43),"UNAVAILABLE");
});

test("E1.3 aggregate requires every detected landing event to classify",()=>{
  const day={time:"2026-07-19T12:00:00Z",lat:50.09,lon:14.43};
  const night={time:"2026-07-19T22:00:00Z",lat:50.09,lon:14.43};
  const ambiguous={time:"2026-07-19T22:00:00",lat:50.09,lon:14.43};
  assert.deepEqual(aggregateCivilTwilightLandingEvents([day,night],2),{status:"AVAILABLE",day:1,night:1,total:2});
  assert.deepEqual(aggregateCivilTwilightLandingEvents([day,ambiguous],2),{status:"UNAVAILABLE",total:2});
  assert.deepEqual(aggregateCivilTwilightLandingEvents([day,night],3),{status:"UNAVAILABLE",total:3});
});
