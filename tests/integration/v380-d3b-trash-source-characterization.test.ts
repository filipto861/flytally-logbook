import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// D3b-0 source characterization only. These tests document CURRENT behavior;
// they are not a safety acceptance test or substitute for native full-v20 PG16.
const source = readFileSync(new URL("../../lib/flight-trash.ts", import.meta.url), "utf8");
const start = source.indexOf("export async function moveFlightToTrash");
const end = source.indexOf("export async function restoreDeletedFlightRecord", start);
assert.ok(start >= 0 && end > start, "Trash source boundaries must be reviewed");
const trash = source.slice(start, end);

test("D3b baseline: archived payload covers flight, tracks and expenses only", () => {
  assert.match(trash, /to_jsonb\(f\)/);
  assert.match(trash, /jsonb_agg\(to_jsonb\(t\)/);
  assert.match(trash, /jsonb_agg\(to_jsonb\(e\)/);
  for (const table of ["flight_participations", "flight_connected_crew", "flight_verifications", "flight_source_provenance"]) {
    assert.doesNotMatch(trash.slice(trash.indexOf("INSERT INTO deleted_flights"), trash.indexOf("RETURNING id", trash.indexOf("INSERT INTO deleted_flights"))), new RegExp(table));
  }
});

test("D3b baseline: success currently relies on archive INSERT, not final DELETE", () => {
  assert.match(trash, /DELETE FROM flights WHERE id=\$\{flightId\}/);
  assert.match(trash, /return Boolean\(\(results\[1\]/);
  assert.doesNotMatch(trash, /return Boolean\(\(results\[4\]/);
});

test("D3b baseline: ordinary draft lacks an unconditional parent row lock before snapshot", () => {
  const beforeArchive = trash.slice(0, trash.indexOf("INSERT INTO deleted_flights"));
  assert.match(beforeArchive, /UPDATE flights f SET locked_at=NULL/);
  assert.match(beforeArchive, /EXISTS\(SELECT 1 FROM flight_participations p/);
  assert.doesNotMatch(beforeArchive, /FOR UPDATE/);
  assert.doesNotMatch(beforeArchive, /SELECT .*FOR UPDATE/s);
});

// Native PG16 FK/trigger catalogue and two-session races remain NOT RUN.
// Do not change these assertions to imply that data loss was reproduced.
