import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { cronRequestAuthorized } from "../lib/cron-auth.ts";
import { directionalRouteHref,directionalRouteKey,routePairHref,routePairKey } from "../lib/route-filter.ts";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const releaseAtLeast=(actual:string,minimum:string)=>{
  const a=actual.split(".").map(Number),b=minimum.split(".").map(Number);
  for(let i=0;i<3;i++){if((a[i]??0)>(b[i]??0))return true;if((a[i]??0)<(b[i]??0))return false}
  return true;
};

test("v1.38.0 closes spoofable cron fallback and fails closed without CRON_SECRET",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,"1.38.0"));
  assert.equal(cronRequestAuthorized(undefined,"Bearer anything"),false);
  assert.equal(cronRequestAuthorized("","Bearer anything"),false);
  assert.equal(cronRequestAuthorized("secret",null),false);
  assert.equal(cronRequestAuthorized("secret","Bearer wrong"),false);
  assert.equal(cronRequestAuthorized("secret","Bearer secret"),true);
  for(const file of ["app/api/cron/recency/route.ts","app/api/cron/backups/route.ts"]){const source=read(file);assert.match(source,/cronRequestAuthorized/);assert.doesNotMatch(source,/user-agent|vercel-cron/i)}
});

test("v1.38.0 guarantees ULL and EASA read-only field parity",()=>{
  const entry=read("components/readonly-logbook-entry.tsx");
  assert.equal(entry.split('<table className="readonly-fcl-table">').length-1,1);
  assert.match(entry,/caption=easa\?"FCL\.050 single-flight logbook preview":"ULL single-flight logbook preview"/);
  for(const field of ["Departure","Arrival","Aircraft","Single-pilot time","Multi-pilot","Total flight","Name PIC","Landings","Conditions","Pilot function","Co-pilot","DUAL","FI/FE","Remarks"])assert.ok(entry.includes(field),`missing ${field}`);
  assert.doesNotMatch(entry,/easa\?<div className="readonly-fcl-table-wrap"/);
});

test("v1.38.0 dashboard aggregation keeps airports and directional routes distinct and user scoped",()=>{
  const data=read("lib/data/dashboard.ts");
  assert.match(data,/uniqueAirports:number;uniqueRoutes:number/);
  assert.match(data,/topRoutes:Array<\{route:string;departure:string;arrival:string;flights:number;minutes:number;firstDate:string;lastDate:string\}>/);
  assert.match(data,/topAirports:Array<\{airport:string;visits:number;departures:number;arrivals:number;firstDate:string;lastDate:string\}>/);
  assert.match(data,/WHERE f\.user_id=\$\{userId\}/);
  assert.match(data,/departure\|\|'→'\|\|arrival/);
  assert.match(data,/COALESCE\(MIN\(date_key\),' '\)|COALESCE\(MIN\(date_key\),''\)/);
  assert.match(data,/LIMIT 50/);assert.match(data,/LIMIT 100/);
});

test("v1.38.0 route drill-down distinguishes direction from airport pair",()=>{
  assert.equal(directionalRouteKey("lkpr","lkkv"),"LKPR→LKKV");
  assert.equal(directionalRouteHref("LKPR","LKKV"),"/flights?route=LKPR%E2%86%92LKKV");
  assert.equal(routePairKey("LKKV","LKPR"),"LKKV↔LKPR");
  assert.match(routePairHref("LKPR","LKKV"),/^\/flights\?routePair=/);
  const details=read("components/dashboard-details.tsx");
  assert.match(details,/\["airports","Airports"\]/);assert.match(details,/\["routes","Routes"\]/);
  assert.match(details,/directionalRouteHref/);assert.match(details,/routePairHref/);assert.match(details,/First visit/);assert.match(details,/First flown/);
});

test("v1.38.0 consolidates Aircraft Costs and exposes Airports Routes without touching mobile navigation",()=>{
  const page=read("app/(protected)/dashboard/page.tsx"),widgets=read("lib/dashboard-widgets.ts"),layout=read("app/layout.tsx"),css=read("app/v138-dashboard-insights.css"),roadmap=read("ROADMAP.md");
  assert.match(page,/Aircraft & costs/);assert.match(page,/Average cost \/ h/);assert.match(page,/Visited airports/);assert.match(page,/Flown routes/);
  assert.match(widgets,/label:"Airports & routes"/);assert.match(layout,/v138-dashboard-insights[.]css/);
  assert.doesNotMatch(css,/mobile-toggle|mobile-nav-backdrop|\.sidebar nav/);
  assert.match(roadmap,/v1\.38\.0/);assert.match(roadmap,/fail closed/);assert.match(roadmap,/ULL.*EASA/);
});
