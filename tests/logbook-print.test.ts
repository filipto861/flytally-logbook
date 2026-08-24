import test from "node:test";
import assert from "node:assert/strict";
import {matchesLogbookPrintScope,normalizeLogbookPrintScope,parsePilotPreferences,pilotInCommandName,printIdentity,withAccumulatedFlightTime} from "../lib/logbook-print.ts";

test("print scope normalization keeps a stable four-option contract",()=>{
  assert.equal(normalizeLogbookPrintScope("easa"),"easa");
  assert.equal(normalizeLogbookPrintScope("ULL-EASA"),"ull-easa");
  assert.equal(normalizeLogbookPrintScope("unknown"),"all");
  assert.equal(matchesLogbookPrintScope("ULL","ull"),true);
  assert.equal(matchesLogbookPrintScope("EASA","ull"),false);
  assert.equal(matchesLogbookPrintScope("EASA","ull-easa"),true);
  assert.equal(matchesLogbookPrintScope("OTHER","all"),true);
});

test("printed rows receive accumulated flight time within the selected scope",()=>{
  const rows=withAccumulatedFlightTime([{block_minutes:45},{block_minutes:70},{block_minutes:0}]);
  assert.deepEqual(rows.map(row=>row.accumulated_minutes),[45,115,115]);
});

test("pilot preferences and PIC name remain safe for legacy rows",()=>{
  assert.equal(parsePilotPreferences('{"pilot_address":"Prague"}').pilot_address,"Prague");
  assert.deepEqual(parsePilotPreferences("broken"),{});
  assert.equal(pilotInCommandName({role:"PIC",commander:""},"Test Pilot"),"Test Pilot");
  assert.equal(pilotInCommandName({role:"DUAL",instructor:"Flight Instructor"},"Test Pilot"),"Flight Instructor");
  assert.equal(pilotInCommandName({role:"DUAL",commander:"Test Pilot",instructor:"Flight Instructor"},"Test Pilot"),"Flight Instructor");
  assert.equal(pilotInCommandName({role:"DUAL",commander:"Captain",instructor:""},"Test Pilot"),"Captain");
  assert.equal(pilotInCommandName({role:"CO-PILOT",commander:"Captain"},"Test Pilot"),"Captain");
});

test("print identity comes from the active licence record and combined print shows both",()=>{
  const preferences={licence_profiles:{"11":{scope:"EASA",number:"CZ.FCL.123",address:"EASA Address"},"22":{scope:"ULL",number:"ULL-456",address:"ULL Address"}}};
  const licences=[{id:11,category:"Licence",label:"LAPL(A)",expiry_date:"2099-12-31",active:1},{id:22,category:"Licence",label:"ULL pilot licence",expiry_date:"2099-12-31",active:1}];
  const easa=printIdentity(preferences,"easa",licences),combined=printIdentity(preferences,"ull-easa",licences);
  assert.equal(easa.address,"EASA Address");assert.equal(easa.licence,"CZ.FCL.123");assert.deepEqual(easa.warnings,[]);
  assert.match(combined.address,/EASA: EASA Address/);assert.match(combined.address,/ULL: ULL Address/);assert.match(combined.licence,/EASA: CZ.FCL.123/);assert.match(combined.licence,/ULL: ULL-456/);
});

test("expired licence warning is scoped to the selected logbook",()=>{
  const preferences={licence_profiles:{"1":{scope:"EASA",number:"EASA-1",address:"A"},"2":{scope:"ULL",number:"ULL-2",address:"B"}}};
  const licences=[{id:1,category:"Licence",label:"EASA",expiry_date:"2020-01-01",active:1},{id:2,category:"Licence",label:"ULL",expiry_date:"2020-01-01",active:1}];
  const easa=printIdentity(preferences,"easa",licences);
  assert.equal(easa.warnings.length,1);assert.match(easa.warnings[0],/^EASA licence/);
});
