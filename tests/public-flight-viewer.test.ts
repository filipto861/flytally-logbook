import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("public GPS payload removes hidden logbook metadata before client serialization",()=>{
  const sharing=read("lib/flight-sharing.ts");
  assert.match(sharing,/tracks:MapTrack\[\]/);
  assert.match(sharing,/flightId:0,date:"",registration:""/);
  assert.match(sharing,/evidence:""/);
  assert.match(sharing,/Boolean\(r\.show_track\)\?await getFlightTracks/);
  assert.match(sharing,/remaining=1800/);
  assert.match(sharing,/Date\.UTC\(2000,0,1\)/);
  assert.match(sharing,/parsed-Number\(first\)/);
});

test("shared replay mode does not expose exact GPS point timestamps",()=>{
  const player=read("components/flight-track-player.tsx");
  assert.match(player,/publicView=false/);
  assert.match(player,/publicView\?"FLIGHT REPLAY":"GPS PLAYER"/);
  assert.match(player,/of route/);
});
