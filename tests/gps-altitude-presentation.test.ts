import test from "node:test";
import assert from "node:assert/strict";
import {finiteGpsAltitude,gpsAltitudeProfileGeometry,interpolatedGpsAltitude} from "../lib/gps-altitude-presentation.ts";

test("D2-C.1 missing, malformed and measured zero GPS altitudes remain distinct in UI model",()=>{
  assert.equal(finiteGpsAltitude(null),null);
  assert.equal(finiteGpsAltitude(undefined),null);
  assert.equal(finiteGpsAltitude(NaN),null);
  assert.equal(finiteGpsAltitude(Infinity),null);
  assert.equal(finiteGpsAltitude(0),0);
  assert.equal(finiteGpsAltitude(-12),-12);
});

test("D2-C.1 replay never interpolates a missing altitude through measured zero",()=>{
  assert.equal(interpolatedGpsAltitude(null,100,0),null);
  assert.equal(interpolatedGpsAltitude(null,100,.5),null);
  assert.equal(interpolatedGpsAltitude(0,null,0),0);
  assert.equal(interpolatedGpsAltitude(0,null,.5),null);
  assert.equal(interpolatedGpsAltitude(null,0,1),0);
  assert.equal(interpolatedGpsAltitude(0,100,.5),50);
  assert.equal(interpolatedGpsAltitude(NaN,0,.5),null);
  assert.equal(interpolatedGpsAltitude(0,100,Infinity),null);
});

test("D2-C.1 altitude profile preserves gaps and isolated valid samples",()=>{
  const geometry=gpsAltitudeProfileGeometry([null,0,50,null,20,null],1000,150);
  assert.equal(geometry.segments.length,1);
  assert.equal(geometry.isolated.length,1);
  assert.ok(geometry.segments[0].startsWith("200,"));
  assert.equal(geometry.isolated[0].cx,800);
  assert.deepEqual(gpsAltitudeProfileGeometry([null,undefined,NaN],1000,150),{segments:[],isolated:[]});
  assert.deepEqual(gpsAltitudeProfileGeometry([0,0],1000,150).isolated,[]);
});


test("D2-C.1 saved replay does not connect disjoint track sections through an altitude profile",()=>{
  const profile=gpsAltitudeProfileGeometry([100,150,200,300],1000,150,[false,false,true,false]);
  assert.equal(profile.segments.length,2);
  assert.deepEqual(profile.isolated,[]);
});

test("D2-C.1 altitude geometry preserves actual negative and zero samples",()=>{
  const profile=gpsAltitudeProfileGeometry([-10,0,10],1000,150);
  assert.equal(profile.segments.length,1);
  assert.equal(profile.isolated.length,0);
  assert.equal(profile.segments[0].split(" ").length,3);
});
