import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  gpsLandingDayNightSuggestion,
  gpsNightMinutesSuggestion,
} from "../lib/civil-twilight.ts";
import type { KmlPoint } from "../lib/track-processing.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const point=(lat:number,lon:number,time:string):KmlPoint=>({lat,lon,alt:null,time});

test("3.4.1 keeps dense exact day night and twilight-crossing suggestions",()=>{
  assert.deepEqual(gpsNightMinutesSuggestion([
    point(50.09,14.43,"2026-07-19T12:00:00Z"),
    point(50.10,14.44,"2026-07-19T12:10:00Z"),
  ]),{status:"AVAILABLE",minutes:0});

  assert.deepEqual(gpsNightMinutesSuggestion([
    point(50.09,14.43,"2026-07-19T22:00:00Z"),
    point(50.10,14.44,"2026-07-19T22:10:00Z"),
  ]),{status:"AVAILABLE",minutes:10});

  const crossing=gpsNightMinutesSuggestion([
    point(50.31,13.378,"2026-10-05T17:03:00Z"),
    point(50.13,14.134,"2026-10-05T17:09:00Z"),
    point(50.10,14.26,"2026-10-05T17:10:00Z"),
  ]);
  assert.deepEqual(crossing,{status:"AVAILABLE",minutes:3});
});

test("3.4.1 keeps sparse segments fail closed because endpoint quality does not prove the unobserved path",()=>{
  for(const [start,end,seconds] of [
    [point(52.31,4.76,"2026-10-05T16:00:00Z"),point(52.10,7.00,"2026-10-05T16:15:00Z"),900],
    [point(50.09,14.43,"2026-01-15T23:00:00Z"),point(50.10,14.44,"2026-01-15T23:20:00Z"),1200],
    [point(50.10,14.40,"2026-10-05T17:00:00Z"),point(50.10,14.40,"2026-10-05T17:15:00Z"),900],
  ] as const){
    const result=gpsNightMinutesSuggestion([start,end]);
    assert.equal(result.status,"UNAVAILABLE");
    if(result.status==="UNAVAILABLE"){
      assert.deepEqual(result.reasons,["SEGMENT_GAP_TOO_LARGE"]);
      assert.equal(result.affectedSegmentSeconds,seconds);
    }
  }
});

test("3.4.1 reason codes distinguish timestamp confidence continuity and zero-duration failures",()=>{
  const ambiguous=gpsNightMinutesSuggestion([
    point(50.09,14.43,"2026-07-19T22:00:00"),
    point(50.10,14.44,"2026-07-19T22:05:00"),
  ]);
  assert.equal(ambiguous.status,"UNAVAILABLE");
  if(ambiguous.status==="UNAVAILABLE")assert.deepEqual(ambiguous.reasons,["MISSING_OR_AMBIGUOUS_TIMESTAMP"]);

  const nonMonotonic=gpsNightMinutesSuggestion([
    point(50.09,14.43,"2026-07-19T22:05:00Z"),
    point(50.10,14.44,"2026-07-19T22:00:00Z"),
  ]);
  assert.equal(nonMonotonic.status,"UNAVAILABLE");
  if(nonMonotonic.status==="UNAVAILABLE")assert.deepEqual(nonMonotonic.reasons,["NON_MONOTONIC_TIMESTAMP"]);

  const guard=gpsNightMinutesSuggestion([
    point(50.25,13.63,"2026-10-05T17:05:00Z"),
    point(50.10,14.26,"2026-10-05T17:10:00Z"),
  ]);
  assert.equal(guard.status,"UNAVAILABLE");
  if(guard.status==="UNAVAILABLE")assert.deepEqual(guard.reasons,["TWILIGHT_CONFIDENCE_GUARD"]);

  const discontinuity=gpsNightMinutesSuggestion([
    point(50.10,14.40,"2026-07-19T12:00:00Z"),
    point(50.10,30.00,"2026-07-19T12:01:00Z"),
  ]);
  assert.equal(discontinuity.status,"UNAVAILABLE");
  if(discontinuity.status==="UNAVAILABLE")assert.deepEqual(discontinuity.reasons,["TRACK_DISCONTINUITY"]);

  const duplicateOk=gpsNightMinutesSuggestion([
    point(50.09,14.43,"2026-07-19T22:00:00Z"),
    point(50.09,14.43,"2026-07-19T22:00:00Z"),
    point(50.10,14.44,"2026-07-19T22:10:00Z"),
  ]);
  assert.deepEqual(duplicateOk,{status:"AVAILABLE",minutes:10});

  const duplicateConflict=gpsNightMinutesSuggestion([
    point(50.09,14.43,"2026-07-19T22:00:00Z"),
    point(50.50,15.00,"2026-07-19T22:00:00Z"),
  ]);
  assert.equal(duplicateConflict.status,"UNAVAILABLE");
  if(duplicateConflict.status==="UNAVAILABLE")assert.deepEqual(duplicateConflict.reasons,["ZERO_DURATION_CONFLICT"]);
});

test("3.4.1 remains fail closed outside the supported solar envelope",()=>{
  const latitude=gpsNightMinutesSuggestion([
    point(73,14.4,"2026-07-19T22:00:00Z"),
    point(73,14.5,"2026-07-19T22:05:00Z"),
  ]);
  assert.equal(latitude.status,"UNAVAILABLE");
  if(latitude.status==="UNAVAILABLE")assert.deepEqual(latitude.reasons,["UNSUPPORTED_SOLAR_ENVELOPE"]);

  const year=gpsNightMinutesSuggestion([
    point(50.1,14.4,"2201-07-19T22:00:00Z"),
    point(50.1,14.5,"2201-07-19T22:05:00Z"),
  ]);
  assert.equal(year.status,"UNAVAILABLE");
  if(year.status==="UNAVAILABLE")assert.deepEqual(year.reasons,["UNSUPPORTED_SOLAR_ENVELOPE"]);
});

test("3.4.1 real-like EHAM to LKPR sparse route can prove NIGHT landing while exact Night time remains unavailable",()=>{
  const route:KmlPoint[]=[
    point(52.31,4.76,"2026-10-05T16:00:00Z"),
    point(52.10,7.00,"2026-10-05T16:15:00Z"),
    point(51.80,8.50,"2026-10-05T16:25:00Z"),
    point(51.40,10.00,"2026-10-05T16:35:00Z"),
    point(51.00,11.50,"2026-10-05T16:45:00Z"),
    point(50.60,12.50,"2026-10-05T16:55:00Z"),
    point(50.31,13.378,"2026-10-05T17:03:00Z"),
    point(50.13,14.134,"2026-10-05T17:09:00Z"),
    point(50.10,14.26,"2026-10-05T17:10:00Z"),
  ];

  assert.deepEqual(gpsLandingDayNightSuggestion(route),{status:"AVAILABLE",day:0,night:1,total:1});
  const night=gpsNightMinutesSuggestion(route);
  assert.equal(night.status,"UNAVAILABLE");
  if(night.status==="UNAVAILABLE"){
    assert.deepEqual(night.reasons,["SEGMENT_GAP_TOO_LARGE"]);
    assert.equal(night.firstAffectedSegment,0);
    assert.equal(night.affectedSegmentSeconds,900);
  }
});

test("3.4.1 GPS UI explains unavailable Night time and keeps manual edits sticky",()=>{
  const gps=read("components/kml-import-form.tsx");
  assert.match(gps,/GPS Night-time unavailable —/);
  assert.match(gps,/SEGMENT_GAP_TOO_LARGE/);
  assert.match(gps,/TWILIGHT_CONFIDENCE_GUARD/);
  assert.match(gps,/if\(review\.nightTimeSource==="MANUAL"\)return review/);
  assert.match(gps,/review\.nightTimeSource==="SUGGESTED"\?\{\.\.\.review,nightTime:"",nightTimeSource:"UNSET"\}:review/);
  assert.match(gps,/GPS does not prove IFR/);
  assert.match(gps,/Night \{singleReview\.nightTime\|\|"—"\} · IFR \{singleReview\.ifrTime\|\|"—"\}/);
  assert.doesNotMatch(gps,/Night \{singleReview\.nightTime\|\|"0:00"\}/);
});
