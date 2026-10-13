# 3.8.0 — Restore D2: v20 production-path fidelity hardening

**13 October 2026 · DRAFT ONLY · UNTESTED RUNTIME SQL · NO DEPLOYMENT**

## Why this is needed

Actual `main@4ca2847795435549f36d44f253eb7c105eea6d25` `lib/flight-trash.ts` restored only 49 explicit flight columns from a 61-column full-v20 smoke fixture (`tooling/bootstrap-browser-smoke-db.mjs`). Missing fields comprised three ordinary historical aircraft identity values (`aircraft_make`, `aircraft_model`, `aircraft_variant`) plus nine excluded IDs/certification/correction values. Restoring while the aircraft snapshot trigger runs could otherwise change the historical aircraft identity.

Legacy expense restoration additionally silently mapped missing currency to `CZK`, defaulted child metadata and filtered nonpositive amounts. Future v21 JSON snapshots would lose their exact currency tuple/encoding because v20 restore lacked those fields.

## Exact candidate changes (not merged)

- `lib/flight-trash.ts`: explicitly includes the three archived aircraft identity fields in the flight INSERT projection; guards candidate eligibility against future v21 monetary keys, invalid/mismatched archive ownership, malformed JSON shapes, protected/certified revision state and unsupported child money evidence.
- Removes guessed `CZK`, dropping invalid expense rows and silent defaulting of source track/expense values. Invalid snapshot fails closed rather than claiming restore success; response text does not expose raw financial values.
- `tests/v380-trash-restore-v20-column-coverage.test.ts`: seven structural regression tests compared with the complete 61-field v20 smoke fixture. Expected projection: 52 ordinary columns, nine deliberately excluded id/certification/correction columns. Future schema changes must trigger review, not silent omission.
- **Architecture deliberately NOT changed in this batch**: old `restoreDeletedFlightRecord` still uses single CTE `INSERT` and cannot claim independent-session concurrency correctness or full child content matching. Test-only D1 `a1t2c_try_restore` in draft #327 demonstrated an atomic approach, but **must not be copied directly into runtime** because its fixture is reduced.
- Future NULL v21 columns are explicitly rejected by **presence of keys** (including when values are null), avoiding downgrade from v21 to v20. An approved v21-aware restore must replace this temporary gate once independently validated.

## Verification / blockers

- Source audit against full-v20 browser bootstrap, GitHub exact readback: 61 schema columns; 52 restored; 9 intentionally excluded; no unexpected missing fields; no silent CZK/expense filter/child metadata default in the draft source. This is **source inspection, NOT executing Node tests or SQL**.
- **NOT RUN** on this exact branch: project Node24 typecheck, 7 new targeted node tests, real PostgreSQL 16 restore tests, trigger interactions, independent-session concurrency, full v20/legacy fixtures, signed v13, Neon HTTP, CI, build, browser, production smoke.
- **Hard blocker:** before merge, verify production full-v20 database schema, real archived identity preservation with `logbook_snapshot_aircraft_identity` trigger, corrupted child/ownership rollback, participant/void/certified evidence and ordinary writer races. Special case: blank historical aircraft make/model/variant may cause the BEFORE INSERT trigger to repopulate current aircraft defaults. That must **fail closed** or be corrected; static projection coverage alone is insufficient.
- **Potential compatibility impact:** older trash snapshots pre-v17 without the three identity keys are now rejected; this is an intentional fail-closed candidate choice requiring actual archive inventory and owner approval before deploy.
- No full 3.8.0 production readiness until A1-T1 + T2a/T2b + T2c D1 full-field integration, official SIX registry evidence, A1-C/A1-F signed backup and A1-G rollout gates are satisfied.

## Owner-local first test / TS typing correction (13 October 2026)

- Exact commit `220b3e9cb1271e663a139856df9cef3c0e93ff22` run by owner on Windows: targeted source coverage **7/7 PASS**, no failures or skips. `npm run typecheck`: **FAIL TS2345** at `tests/v380-trash-restore-v20-column-coverage.test.ts:24` because `const excluded = [...] as const` narrowed `includes()` to a literal union while `columns` entries are `string`.
- Minimal correction at `36f6c1e4efda2e58c367ed93bae6059b78442518`: change to `const excluded: readonly string[] = [...]`. Runtime restore code, SQL projection and assertions unchanged. Equivalent isolated TS5.8.3 strict expression check **PASS**.
- **Next required result:** project Node24 `npm run typecheck` and targeted 7 Node tests on latest branch HEAD. These were **NOT RUN** on the corrected commit. This success is insufficient for merge; full-v20 PG16 trigger, void/shared evidence, independent-session transaction and Neon HTTP still blocked.

## Owner-local first verification (no DB writes)

On the new branch, first run:

```powershell
npm run typecheck
npm run test:target -- tests/v380-trash-restore-v20-column-coverage.test.ts
```

Then attach exact branch/commit and results. **Do not merge/deploy from structural tests alone.** Follow up with isolated native PG16 full-v20 runtime/trigger integration, then separately approved nonproduction Neon HTTP transaction tests before production changes.
