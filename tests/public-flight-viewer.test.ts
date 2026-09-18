import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("public share route renders an interactive flight viewer instead of the social Story card",()=>{
  const page=read("app/f/[token]/page.tsx");
  assert.match(page,/FlightTrackPlayer/);
  assert.match(page,/publicView/);
  assert.match(page,/Replay the flight/);
  assert.doesNotMatch(page,/FlightStoryCard/);
  assert.match(page,/GPS track not shared/);
});

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

test("public viewer ships responsive standalone presentation while final accessibility CSS remains last",()=>{
  const layout=read("app/layout.tsx"),css=read("app/v301-public-flight-viewer.css");
  assert.match(layout,/v301-public-flight-viewer\.css/);
  assert.ok(layout.indexOf('import "./v301-public-flight-viewer.css"')<layout.indexOf('import "./v300-u6-acceptance.css"'));
  assert.match(css,/public-flight-viewer-page/);
  assert.match(css,/public-flight-replay/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/safe-area-inset-bottom/);
});


test("public viewer supports persistent Light and Dark modes without changing protected app preference",()=>{
  const page=read("app/f/[token]/page.tsx"),toggle=read("components/public-theme-toggle.tsx"),bootstrap=read("components/theme-bootstrap.tsx"),css=read("app/v301-public-flight-viewer.css");
  assert.match(page,/PublicThemeToggle/);
  assert.match(toggle,/Light<\/button>/);
  assert.match(toggle,/Dark<\/button>/);
  assert.match(toggle,/flytally-public-theme/);
  assert.match(toggle,/flytally:themechange/);
  assert.match(bootstrap,/location\.pathname\.startsWith\("\/f\/"\)/);
  assert.match(bootstrap,/flytally-public-theme/);
  assert.match(css,/public-flight-theme-toggle/);
});
