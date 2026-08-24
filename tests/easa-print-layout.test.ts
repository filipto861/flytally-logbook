import test from "node:test";
import assert from "node:assert/strict";
import {paginateEasaRecords,totalsForEasaRecord,type EasaPrintRecord} from "../lib/easa-print-layout.ts";

const flight=(overrides:Record<string,unknown>={}):EasaPrintRecord=>({kind:"flight",sortKey:"2026-08-24T10:00",block_minutes:60,operation_type:"SP",engine_type:"SE",landings_day:1,landings_night:0,night_minutes:0,ifr_minutes:0,pic_minutes:60,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,...overrides});

test("EASA flight time is allocated to SP-SE, SP-ME or MP",()=>{
  assert.equal(totalsForEasaRecord(flight()).spSe,60);
  assert.equal(totalsForEasaRecord(flight({engine_type:"ME"})).spMe,60);
  assert.equal(totalsForEasaRecord(flight({operation_type:"MP",engine_type:"ME"})).mp,60);
});

test("FSTD contributes only to FSTD session total",()=>{
  const totals=totalsForEasaRecord({kind:"fstd",sortKey:"2026-08-24T12:00",total_minutes:95});
  assert.equal(totals.fstd,95);assert.equal(totals.flight,0);assert.equal(totals.pic,0);
});

test("page totals carry forward exactly between EASA logbook pages",()=>{
  const records=[flight({block_minutes:40,pic_minutes:40}),flight({block_minutes:50,pic_minutes:50}),{kind:"fstd",sortKey:"2026-08-25T12:00",total_minutes:30} as EasaPrintRecord];
  const pages=paginateEasaRecords(records,2);
  assert.equal(pages.length,2);
  assert.equal(pages[0].pageTotal.flight,90);assert.equal(pages[0].runningTotal.flight,90);assert.equal(pages[0].runningTotal.pic,90);
  assert.equal(pages[1].previousTotal.flight,90);assert.equal(pages[1].pageTotal.fstd,30);assert.equal(pages[1].runningTotal.fstd,30);assert.equal(pages[1].blankRows,1);
});
