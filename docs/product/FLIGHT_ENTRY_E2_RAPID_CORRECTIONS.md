# Flight Entry E2 — rapid post-production corrections

**Status:** DONE / PRODUCTION VERIFIED  
**Owner:** Filip Točík  
**Date:** 4 October 2026  
**Branch:** merged via PR #238

## Trigger

A real SkyDemon KML imported in production showed an advisory take-off marker materially later than the first credible post-gap airborne evidence. Source inspection found a near-instantaneous GPS teleport of about 1.8 km with a simultaneous altitude discontinuity. The current take-off guard scans an arbitrary ±10-point neighborhood, so that single corrupt transition invalidates later otherwise credible climb points until it falls outside the point window.

The same production review exposed linked entry-friction gaps: no aircraft SE/ME default, ULL Day/Night suggestion blocked despite an explicit SERA account definition, manual Night time despite usable GPS time/location evidence, and an over-heavy required PF movement card.

## Frozen product decisions

1. GPS-derived values remain advisory and editable. Missing/ambiguous evidence remains unavailable; no invented exact wheels-off time.
2. Take-off anomaly rejection is local to physical candidate evidence, not an arbitrary future/past point count. A detected discontinuity remains a track-quality warning.
3. Aircraft gets nullable `default_engine_type` with values `SE | ME | NULL`. No historical backfill. Catalogue suggestion is allowed only from unambiguous source engine count and remains editable.
4. Existing explicit account `night_definition=SERA` may drive GPS Day/Night and Night-time suggestions for both EASA and ULL standard-time review. `MANUAL` remains fail-closed/manual.
5. IFR time is always pilot-entered; GPS trajectory does not prove IFR.
6. PF evidence is optional. Absence means no PF movement evidence/recency credit; it must not block saving the flight. ULL without an explicit Part-FCL credit mapping does not expose FCL.060 PF controls.
7. No flight/certification/history backfill or rewrite.

## Acceptance

- supplied SkyDemon anomaly fixture no longer delays take-off solely because the corrupt point remains inside a ±10-point window; the track is still flagged for discontinuity and exact take-off remains advisory;
- NG5 catalogue identity (`engine=1P/S`) suggests SE in a new aircraft profile; ambiguous/manual catalogue identity stays unset; user override wins;
- Manual New and GPS use saved engine default only as editable prefill;
- SERA-enabled ULL GPS flight receives Day/Night landing suggestion when all landing events classify; manual edits stay sticky;
- Night time receives a conservative H:MM suggestion only when the complete relevant timed track can be classified; otherwise remains manual/unavailable;
- IFR is never auto-populated;
- PF confirmation is non-blocking; unchecked/absent persists zero PF movement evidence;
- v19 migration is additive, nullable, constrained and has no backfill;
- targeted tests cover detector, catalogue engine mapping, night logic, UI/source contract and PostgreSQL migration; one full local release gate only at final candidate.


## Production closeout — 4 October 2026

- Exact release candidate: `70f8e12c585b0f3713ce91ba0c1f036ebaf1102e`.
- CI: Verify FlyTally web #1141 PASS — TypeScript PASS, unit/regression **1208/1208**, PostgreSQL acceptance **86/86**.
- Browser smoke #514 PASS — production build PASS, authenticated Chromium **84/84** with **2 intentional skips**.
- Production v19 preflight ran read-only against `neondb`, proved exact schema registry v1–v18, no `default_engine_type`, no engine-default constraint, and no partial migration state; transaction ended with ROLLBACK.
- Baseline counts immediately before migration: aircraft 25, flights 289, certified revisions 56, flight audit rows 1549, deleted flights 8.
- Explicit v19 migration completed in one transaction with advisory xact lock `704190104`; column + CHECK constraint + registry row committed successfully.
- Postflight proved `default_engine_type TEXT NULL`, no column default, validated NULL/SE/ME CHECK constraint, **0** non-null engine defaults, unchanged baseline row counts and exact registry v1–v19; verification transaction ended with ROLLBACK.
- PR #238 merged to `main` as `ba2b4324f1f9ae84161ec86e82fc13d268938160`.
- Vercel production deployment `dpl_FsVYmDgJ2b3KNx4Yhd9jPsLJkvYc` is READY for that exact merge SHA, aliases `fly-tally.com`, and reports no alias error.
- Immediate production runtime-error query found no errors.
- No historical flight/certification/audit/recovery record was rewritten and no aircraft engine default was backfilled.
