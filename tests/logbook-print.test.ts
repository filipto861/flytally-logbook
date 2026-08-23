import test from "node:test";
import assert from "node:assert/strict";
import {matchesLogbookPrintScope,normalizeLogbookPrintScope,parsePilotPreferences,pilotInCommandName,withAccumulatedFlightTime} from "../lib/logbook-print.ts";

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
