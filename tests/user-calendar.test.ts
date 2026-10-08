import test from "node:test";
import assert from "node:assert/strict";
import {getUserSaveableCalendarDefault,resolveSaveableCalendarDefault} from "../lib/data/user-calendar.ts";

const instant=new Date("2026-01-15T23:30:00Z");

test("strict user calendar resolver returns an exact configured-zone date",()=>{
  assert.deepEqual(resolveSaveableCalendarDefault("Europe/Prague",instant),{
    status:"resolved",
    timeZone:"Europe/Prague",
    date:"2026-01-16",
  });
  assert.deepEqual(resolveSaveableCalendarDefault("America/Los_Angeles",instant),{
    status:"resolved",
    timeZone:"America/Los_Angeles",
    date:"2026-01-15",
  });
});

test("strict user calendar resolver fails closed for missing blank and invalid configuration",()=>{
  assert.deepEqual(resolveSaveableCalendarDefault(undefined,instant),{status:"needs_configuration",reason:"missing"});
  assert.deepEqual(resolveSaveableCalendarDefault(null,instant),{status:"needs_configuration",reason:"missing"});
  assert.deepEqual(resolveSaveableCalendarDefault("",instant),{status:"needs_configuration",reason:"blank"});
  assert.deepEqual(resolveSaveableCalendarDefault("   ",instant),{status:"needs_configuration",reason:"blank"});
  assert.deepEqual(resolveSaveableCalendarDefault("+02:00",instant),{status:"needs_configuration",reason:"invalid"});
  assert.deepEqual(resolveSaveableCalendarDefault("Not/A/Zone",instant),{status:"needs_configuration",reason:"invalid"});
});

test("strict user calendar read failures stay unavailable instead of falling back",async()=>{
  assert.deepEqual(
    await getUserSaveableCalendarDefault(7,async()=>{throw new Error("database unavailable")},instant),
    {status:"unavailable",reason:"read_failed"},
  );
});

test("strict user calendar reader never substitutes Prague for invalid persisted state",async()=>{
  assert.deepEqual(
    await getUserSaveableCalendarDefault(7,async()=>"+02:00",instant),
    {status:"needs_configuration",reason:"invalid"},
  );
  assert.deepEqual(
    await getUserSaveableCalendarDefault(7,async()=>undefined,instant),
    {status:"needs_configuration",reason:"missing"},
  );
});
