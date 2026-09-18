import test from "node:test";
import assert from "node:assert/strict";
import {paginateEasaRecords,sumEasaRecords,totalsForEasaRecord,type EasaPrintRecord} from "../lib/easa-print-layout.ts";

const flight=(overrides:Record<string,unknown>={}):EasaPrintRecord=>({kind:"flight",sortKey:"2026-08-24T10:00",block_minutes:60,operation_type:"SP",engine_type:"SE",landings_day:1,landings_night:0,night_minutes:0,ifr_minutes:0,pic_minutes:60,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,role:"PIC",...overrides});

test("EASA flight time is allocated to SP-SE, SP-ME or MP",()=>{
  assert.equal(totalsForEasaRecord(flight()).spSe,60);
  assert.equal(totalsForEasaRecord(flight({engine_type:"ME"})).spMe,60);
  assert.equal(totalsForEasaRecord(flight({operation_type:"MP",engine_type:"ME"})).mp,60);
});

test("FSTD contributes only to FSTD session total",()=>{
  const totals=totalsForEasaRecord({kind:"fstd",sortKey:"2026-08-24T12:00",total_minutes:95});
  assert.equal(totals.fstd,95);assert.equal(totals.flight,0);assert.equal(totals.pic,0);
});

test("Safety Pilot auxiliary records do not increase FCL.050 totals",()=>{
  const totals=totalsForEasaRecord(flight({role:"SAFETY PILOT",pic_minutes:0}));
  assert.equal(totals.flight,0);assert.equal(totals.spSe,0);assert.equal(totals.landingsDay,0);assert.equal(totals.pic,0);
});

test("page totals carry forward exactly between EASA logbook pages",()=>{
  const records=[flight({block_minutes:40,pic_minutes:40}),flight({block_minutes:50,pic_minutes:50}),{kind:"fstd",sortKey:"2026-08-25T12:00",total_minutes:30} as EasaPrintRecord];
  const pages=paginateEasaRecords(records,2);
  assert.equal(pages.length,2);
  assert.equal(pages[0].pageTotal.flight,90);assert.equal(pages[0].runningTotal.flight,90);assert.equal(pages[0].runningTotal.pic,90);
  assert.equal(pages[1].previousTotal.flight,90);assert.equal(pages[1].pageTotal.fstd,30);assert.equal(pages[1].runningTotal.fstd,30);assert.equal(pages[1].blankRows,1);
});

test("last running total equals the selected-record grand total across all FCL columns",()=>{
  const records:EasaPrintRecord[]=[
    flight({sortKey:"2026-08-21T09:00",block_minutes:47,engine_type:"SE",landings_day:2,night_minutes:12,ifr_minutes:10,pic_minutes:47}),
    flight({sortKey:"2026-08-22T09:00",block_minutes:63,engine_type:"ME",landings_night:1,night_minutes:63,ifr_minutes:45,role:"DUAL",pic_minutes:0,dual_minutes:63}),
    flight({sortKey:"2026-08-23T09:00",block_minutes:82,operation_type:"MP",engine_type:"ME",role:"CO-PILOT",pic_minutes:0,copilot_minutes:82,landings_day:1}),
    flight({sortKey:"2026-08-24T09:00",block_minutes:55,role:"INSTRUCTOR",pic_minutes:55,instructor_minutes:55,landings_day:1}),
    {kind:"fstd",sortKey:"2026-08-25T12:00",total_minutes:74},
  ];
  const expected=sumEasaRecords(records),pages=paginateEasaRecords(records,2),grand=pages[pages.length-1]?.runningTotal;
  assert.ok(grand);
  assert.deepEqual(grand,expected);
  assert.deepEqual(expected,{spSe:102,spMe:63,mp:82,flight:247,landingsDay:5,landingsNight:1,night:75,ifr:55,pic:102,copilot:82,dual:63,instructor:55,fstd:74});
});

test("print layout defaults to ten fixed record rows per page",()=>{
  const records=Array.from({length:11},(_,index)=>flight({sortKey:`2026-08-${String(index+1).padStart(2,"0")}T10:00`}));
  const pages=paginateEasaRecords(records);
  assert.equal(pages.length,2);assert.equal(pages[0].records.length,10);assert.equal(pages[0].blankRows,0);assert.equal(pages[1].records.length,1);assert.equal(pages[1].blankRows,9);
});
