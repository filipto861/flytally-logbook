import test from "node:test";
import assert from "node:assert/strict";
import { flightRestoreKey,trackRestoreKey } from "../lib/portable-backup.ts";

test("restore keys ignore source database ids",()=>{
  const left={id:1,date:"2026-08-22",registration:"ok-bid",off_block:"10:00",departure:"lksz",arrival:"lkro"},right={id:999,date:"2026-08-22",registration:"OK-BID",off_block:"10:00",departure:"LKSZ",arrival:"LKRO"};
  assert.equal(flightRestoreKey(left),flightRestoreKey(right));
});

test("track restore key belongs to its natural flight",()=>{
  const track={file_name:"flight.kml",start_utc:"2026-08-22T08:00:00Z",end_utc:"2026-08-22T09:00:00Z",point_count:500};
  assert.notEqual(trackRestoreKey("flight-a",track),trackRestoreKey("flight-b",track));
});
