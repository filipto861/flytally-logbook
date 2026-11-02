import test from "node:test";
import assert from "node:assert/strict";
import { sameRestoreParentNaturalIdentity } from "../lib/recovery-parent-identity.ts";
import { flightRestoreKey } from "../lib/portable-backup.ts";

const flight = {
  id: 501,
  date: "2026-10-31",
  registration: "OK-B1B",
  off_block: "10:20",
  departure: "LKPR",
  arrival: "LKKV",
};
const fstd = {
  id: 601,
  session_date: "2026-11-01",
  device_type: "Synthetic Trainer",
  qualification_number: "SIM-1",
  instruction: "IFR",
  total_minutes: 0,
};
const fstdKey = (row: Record<string, unknown>): string => [
  String(row.session_date ?? "").trim().slice(0, 10),
  String(row.device_type ?? "").trim().toUpperCase(),
  String(row.qualification_number ?? "").trim().toUpperCase(),
  String(row.instruction ?? "").trim().toUpperCase(),
  Number(row.total_minutes || 0),
].join("|");

test("B1b: identical complete flight natural identity with same ID may be classified as existing", () => {
  assert.equal(sameRestoreParentNaturalIdentity(flight, {...flight, registration: "ok-b1b"}, "flight", flightRestoreKey), true);
});

test("B1b: same ID with different route, date, registration or off-block time must reject", () => {
  for (const difference of [
    { arrival: "LKTB" }, { departure: "LKPD" },
    { date: "2026-10-30" }, { registration: "OK-OTHER" }, { off_block: "10:25" },
  ]) {
    assert.equal(sameRestoreParentNaturalIdentity(flight, {...flight, ...difference}, "flight", flightRestoreKey), false);
  }
});

test("B1b: source and target flight IDs must actually match", () => {
  assert.equal(sameRestoreParentNaturalIdentity(flight, {...flight, id: 502}, "flight", flightRestoreKey), false);
});

test("B1b: absent or malformed flight evidence never becomes an identity match", () => {
  for (const difference of [
    { date: "" }, { date: "2026-02-30" }, { date: "2026-10-31T00:00:00Z" },
    { registration: null }, { off_block: undefined }, { departure: "" }, { arrival: "" },
  ]) {
    assert.equal(sameRestoreParentNaturalIdentity(flight, {...flight, ...difference}, "flight", flightRestoreKey), false);
  }
});

test("B1b: matching complete FSTD identity with explicit zero minutes is valid", () => {
  assert.equal(sameRestoreParentNaturalIdentity(fstd, {...fstd, device_type: "SYNTHETIC TRAINER", total_minutes: "0"}, "fstd", fstdKey), true);
});

test("B1b: same FSTD ID with mismatched identifying field must reject", () => {
  for (const difference of [
    { session_date: "2026-11-02" }, { device_type: "OTHER" },
    { qualification_number: "SIM-2" }, { instruction: "VFR" }, { total_minutes: 1 },
  ]) {
    assert.equal(sameRestoreParentNaturalIdentity(fstd, {...fstd, ...difference}, "fstd", fstdKey), false);
  }
});

test("B1b: empty FSTD qualifiers and missing minutes are NOT an explicit zero", () => {
  for (const difference of [
    { device_type: "" }, { qualification_number: "" }, { instruction: null },
    { total_minutes: null }, { total_minutes: undefined }, { total_minutes: "" },
    { total_minutes: -1 }, { total_minutes: 1.5 },
  ]) {
    assert.equal(sameRestoreParentNaturalIdentity(fstd, {...fstd, ...difference}, "fstd", fstdKey), false);
  }
});

test("B1b: source-incomplete flight or FSTD cannot prove an existing identity", () => {
  assert.equal(sameRestoreParentNaturalIdentity({...flight, departure: ""}, flight, "flight", flightRestoreKey), false);
  assert.equal(sameRestoreParentNaturalIdentity({...fstd, instruction: ""}, fstd, "fstd", fstdKey), false);
});
