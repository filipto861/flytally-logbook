import test from "node:test";
import assert from "node:assert/strict";
import {calendarDateInTimeZone,normalizeSaveableTimeZone} from "../lib/calendar-date.ts";

test("saveable calendar dates derive from the configured named timezone",()=>{
  const instant="2026-01-15T23:30:00Z";
  assert.equal(calendarDateInTimeZone(instant,"UTC"),"2026-01-15");
  assert.equal(calendarDateInTimeZone(instant,"Europe/Prague"),"2026-01-16");
  assert.equal(calendarDateInTimeZone(instant,"America/Los_Angeles"),"2026-01-15");
  assert.equal(calendarDateInTimeZone(instant,"Pacific/Auckland"),"2026-01-16");
  assert.equal(calendarDateInTimeZone(instant,"Asia/Kathmandu"),"2026-01-16");
  assert.equal(calendarDateInTimeZone(instant,"Australia/Lord_Howe"),"2026-01-16");
});

test("saveable timezone validation accepts runtime named zones and rejects raw offsets",()=>{
  assert.equal(normalizeSaveableTimeZone("UTC"),"UTC");
  assert.equal(normalizeSaveableTimeZone("Europe/Prague"),"Europe/Prague");
  assert.equal(normalizeSaveableTimeZone("+02:00"),null);
  assert.equal(normalizeSaveableTimeZone("-0500"),null);
  assert.equal(normalizeSaveableTimeZone("Not/A/Zone"),null);
  assert.equal(normalizeSaveableTimeZone("   "),null);

  const alias="US/Eastern";
  let runtimeAccepts=true;
  try{new Intl.DateTimeFormat("en-GB",{timeZone:alias}).format(new Date(0))}catch{runtimeAccepts=false}
  assert.equal(normalizeSaveableTimeZone(alias),runtimeAccepts?alias:null);
});

test("calendar date derivation stays deterministic across DST transitions",()=>{
  assert.equal(calendarDateInTimeZone("2026-03-29T00:30:00Z","Europe/Prague"),"2026-03-29");
  assert.equal(calendarDateInTimeZone("2026-03-29T01:30:00Z","Europe/Prague"),"2026-03-29");
  assert.equal(calendarDateInTimeZone("2026-10-25T00:30:00Z","Europe/Prague"),"2026-10-25");
  assert.equal(calendarDateInTimeZone("2026-10-25T01:30:00Z","Europe/Prague"),"2026-10-25");
  assert.equal(calendarDateInTimeZone("2026-03-08T09:30:00Z","America/Los_Angeles"),"2026-03-08");
  assert.equal(calendarDateInTimeZone("2026-03-08T10:30:00Z","America/Los_Angeles"),"2026-03-08");
  assert.equal(calendarDateInTimeZone("2026-11-01T08:30:00Z","America/Los_Angeles"),"2026-11-01");
  assert.equal(calendarDateInTimeZone("2026-11-01T09:30:00Z","America/Los_Angeles"),"2026-11-01");
});

test("calendar date derivation rejects invalid zones and instants",()=>{
  assert.equal(calendarDateInTimeZone("not-a-date","UTC"),null);
  assert.equal(calendarDateInTimeZone("2026-01-15T23:30:00Z","+02:00"),null);
  assert.equal(calendarDateInTimeZone("2026-01-15T23:30:00Z","Not/A/Zone"),null);
});
