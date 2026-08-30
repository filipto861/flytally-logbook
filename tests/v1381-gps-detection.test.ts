import test from "node:test";
import assert from "node:assert/strict";
import { flightEnvelope,landingCount,suggestedSplits,touchAndGoEvents,type KmlPoint } from "../lib/track-processing.ts";

const at=(start:number,seconds:number,lat:number,alt:number):KmlPoint=>({
  lat,lon:14,alt,time:new Date(start+seconds*1000).toISOString(),
});

test("v1.38.1 does not split a taxi speed burst followed by a ground wait from the real flight",()=>{
  const start=Date.parse("2026-08-29T07:53:00Z"),points:KmlPoint[]=[];
  // Reproduces the failure shape from a real SkyDemon import: about 0.3 km of
  // quick ground movement, a long stop, then the actual departure.
  for(let index=0;index<5;index++)points.push(at(start,index*5,50+index*.0007,366));
  const groundLat=50+4*.0007;
  for(let seconds=30;seconds<=180;seconds+=10)points.push(at(start,seconds,groundLat+((seconds/10)%2 ? .000005 : 0),366+((seconds/10)%3===0 ? .2 : 0)));
  let latitude=groundLat;
  for(let seconds=190,index=1;seconds<=290;seconds+=10,index++){latitude+=.005;points.push(at(start,seconds,latitude,366+index*30))}
  assert.deepEqual(suggestedSplits(points),[]);
});

test("v1.38.1 rejects an impossible GPS altitude discontinuity as touch-and-go evidence",()=>{
  const start=Date.parse("2026-08-29T15:59:20Z"),altitudes=[580,590,600,610,620,630,635,638,640,642,515,505,500,499,540,560,580,600,615,625,635,640,645,650,655,660,665,670,675,680,685];
  const points=altitudes.map((alt,index):KmlPoint=>({lat:50+index*.0008,lon:14,alt,time:new Date(start+index*2500).toISOString()}));
  assert.deepEqual(touchAndGoEvents(points),[]);
  assert.equal(landingCount(points),1);
});

test("v1.38.2 flight envelope ignores an early taxi speed spike and anchors takeoff to the sustained climb",()=>{
  const start=Date.parse("2026-08-29T07:53:00Z"),points:KmlPoint[]=[];
  let latitude=50;
  for(let seconds=0;seconds<=720;seconds+=10){
    let speedKmh=10,altitude=366;
    if(seconds>=60&&seconds<=80)speedKmh=90;
    else if(seconds>=460&&seconds<480)speedKmh=65;
    else if(seconds>=480)speedKmh=100;
    if(seconds>=480)altitude=366+(seconds-480)*1.5;
    if(points.length)latitude+=(speedKmh*10/3600)/111.2;
    points.push(at(start,seconds,latitude,altitude));
  }
  const envelope=flightEnvelope(points);
  assert.match(envelope.takeoffUtc||"",/^2026-08-29T08:01:/);
  assert.match(envelope.offBlockUtc||"",/^2026-08-29T07:56:/);
});
