import test from "node:test";
import assert from "node:assert/strict";
import {aircraftPrintCode,fullAircraftIdentity,matchesLogbookPrintScope,normalizeLogbookPrintScope,parsePilotPreferences,pilotInCommandName,printIdentity,withAccumulatedFlightTime} from "../lib/logbook-print.ts";

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
  assert.equal(pilotInCommandName({role:"PICUS",commander:"",verification_name:"Supervising PIC"},"Test Pilot"),"Supervising PIC");
  assert.equal(pilotInCommandName({role:"SPIC",commander:"Student Pilot",verification_name:"Instructor"},"Test Pilot"),"Instructor");
});

test("print uses ICAO code while retaining full structured aircraft identity",()=>{
  const row={icao_type:"br23",aircraft_type:"B23",aircraft_make:"BRM AERO",aircraft_model:"Bristell B23",aircraft_variant:""};
  assert.equal(aircraftPrintCode(row),"BR23");
  assert.equal(fullAircraftIdentity(row),"BRM AERO Bristell B23");
  assert.equal(aircraftPrintCode({aircraft_type:"P2008JC",aircraft_make:"Tecnam",aircraft_model:"P2008JC"}),"P2008JC");
  assert.equal(fullAircraftIdentity({aircraft_make:"nan",aircraft_model:"P2008JC",aircraft_variant:"undefined"}),"P2008JC");
});

test("print identity comes from the active legacy licence record and combined print shows both",()=>{
  const preferences={licence_profiles:{"11":{scope:"EASA",number:"CZ.FCL.123",address:"EASA Address"},"22":{scope:"ULL",number:"ULL-456",address:"ULL Address"}}};
  const licences=[{id:11,category:"Licence",label:"LAPL(A)",expiry_date:"2099-12-31",active:1},{id:22,category:"Licence",label:"ULL pilot licence",expiry_date:"2099-12-31",active:1}];
  const easa=printIdentity(preferences,"easa",licences),combined=printIdentity(preferences,"ull-easa",licences);
  assert.equal(easa.address,"EASA Address");assert.equal(easa.licence,"CZ.FCL.123");assert.deepEqual(easa.warnings,[]);assert.equal(easa.sources.easa,"legacy");
  assert.match(combined.address,/EASA: EASA Address/);assert.match(combined.address,/ULL: ULL Address/);assert.match(combined.licence,/EASA: CZ.FCL.123/);assert.match(combined.licence,/ULL: ULL-456/);
});

test("pilot_licences is authoritative for printed number, scope and validity",()=>{
  const preferences={licence_profiles:{
    "pilot-31":{scope:"EASA",number:"STALE-PROFILE-NUMBER",address:"Current EASA Address"},
    "31":{scope:"EASA",number:"LEGACY-31",address:"Legacy EASA Address"},
    "pilot-44":{scope:"ULL",number:"ULL-PROFILE",address:"Current ULL Address"},
  }};
  const licences=[
    {id:31,licence_type:"LAPL(A)",licence_number:"CZ.FCL.AUTHORITATIVE",validity_mode:"unlimited",valid_until:null,recency_until:null,active:true},
    {id:44,licence_type:"ULL pilot licence",licence_number:"ULL-AUTHORITATIVE",validity_mode:"date",valid_until:"2099-12-31",recency_until:null,active:true},
    {id:31,category:"Licence",label:"LAPL(A)",expiry_date:"2099-12-31",active:1},
  ];
  const easa=printIdentity(preferences,"easa",licences),combined=printIdentity(preferences,"ull-easa",licences);
  assert.equal(easa.address,"Current EASA Address");
  assert.equal(easa.licence,"CZ.FCL.AUTHORITATIVE");
  assert.equal(easa.sources.easa,"pilot_licences");
  assert.match(combined.licence,/EASA: CZ.FCL.AUTHORITATIVE/);
  assert.match(combined.licence,/ULL: ULL-AUTHORITATIVE/);
  assert.equal(combined.sources.ull,"pilot_licences");
});

test("modern inactive licence does not displace an active legacy fallback",()=>{
  const preferences={licence_profiles:{"pilot-7":{scope:"EASA",number:"INACTIVE",address:"Inactive"},"8":{scope:"EASA",number:"LEGACY-ACTIVE",address:"Legacy Active"}}};
  const licences=[
    {id:7,licence_type:"PPL(A)",licence_number:"INACTIVE",validity_mode:"unlimited",active:false},
    {id:8,category:"Licence",label:"PPL(A)",expiry_date:"2099-12-31",active:1},
  ];
  const identity=printIdentity(preferences,"easa",licences);
  assert.equal(identity.licence,"LEGACY-ACTIVE");
  assert.equal(identity.sources.easa,"legacy");
});

test("expired authoritative licence warning is scoped to the selected logbook",()=>{
  const preferences={licence_profiles:{"pilot-1":{scope:"EASA",address:"A"},"pilot-2":{scope:"ULL",address:"B"}}};
  const licences=[
    {id:1,licence_type:"PPL(A)",licence_number:"EASA-1",validity_mode:"date",valid_until:"2020-01-01",active:true},
    {id:2,licence_type:"ULL pilot licence",licence_number:"ULL-2",validity_mode:"date",valid_until:"2020-01-01",active:true},
  ];
  const easa=printIdentity(preferences,"easa",licences);
  assert.equal(easa.warnings.length,1);assert.match(easa.warnings[0],/^EASA licence/);
});
