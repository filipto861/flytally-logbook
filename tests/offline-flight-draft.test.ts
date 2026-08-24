import test from "node:test";
import assert from "node:assert/strict";
import { flightDraftSummary,normalizeFlightDraft,parseFlightDraft } from "../lib/offline-flight-draft.ts";

test("valid local flight draft is restored",()=>{
  const draft=normalizeFlightDraft({version:1,id:"draft_12345678",updatedAt:"2026-08-24T10:00:00.000Z",values:{date:"2026-08-24",registration:"OK-ABC",departure:"LKLT",arrival:"LKPR"}});
  assert.ok(draft);
  assert.equal(draft?.values.registration,"OK-ABC");
  assert.equal(flightDraftSummary(draft!),"2026-08-24 · OK-ABC · LKLT → LKPR");
});

test("malformed or untrusted local drafts are ignored",()=>{
  assert.equal(parseFlightDraft("not-json"),null);
  assert.equal(normalizeFlightDraft({version:2,id:"draft_12345678",updatedAt:"2026-08-24T10:00:00.000Z",values:{}}),null);
  assert.equal(normalizeFlightDraft({version:1,id:"bad id",updatedAt:"2026-08-24T10:00:00.000Z",values:{}}),null);
  assert.equal(normalizeFlightDraft({version:1,id:"draft_12345678",updatedAt:"not-a-date",values:{}}),null);
});

test("draft values are bounded before reuse",()=>{
  const long="x".repeat(7000),draft=normalizeFlightDraft({version:1,id:"draft_12345678",updatedAt:"2026-08-24T10:00:00.000Z",values:{note:long}});
  assert.equal(draft?.values.note.length,6000);
});
