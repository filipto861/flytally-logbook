**CURRENT OWNER PRIORITY (2026-10-10): SATELLITE FIRST.** Finish Satellite source-backed integration and verification before resuming openAIP; A2A branch remains staged/paused. Do not interpret simultaneous S1/A1 roadmap text as instruction to start more openAIP implementation now.

**Implementation checkpoint A2A:** isolated offline openAIP XYZ parser and explicit availability gate STAGED on `feat/3.7.0-openaip-airspaces-a2a-offline-control`; tests not yet run, no overlay or upstream access. [Detailed batch](3_7_0_A2A_AIRSPACE_BOUNDARY.md).

**S1/A1 update 2026-10-10:** [Provider gate decision](3_7_0_S1_A1_PROVIDER_GATES.md): S1 Satellite DEFER pending source-backed scheme/terms; A1 openAIP BLOCKED pending applicable usage authorization and current Tiles API schema. This does not change feature/runtime state.

# 3.7.0 — Current state and next decisions

**Updated:** 2026-10-10 · **Canonical handoff:** [3.7.0 NEW CHAT HANDOFF](../handoffs/3_7_0_MAPS_HANDOFF_2026-10-10.md) · **Scope:** `flytally-logbook` only

> **This page is the quick current-state index, NOT a substitute for verifying the actual repo at the next session.** Source priority: current repo/main + branch/PR state → this page → ROADMAP → FEATURES → CHANGELOG → authoritative product/provider docs → historical evidence. Where contradictory, reconcile explicitly before coding.

## Product goal — frozen by owner on 2026-10-10

**Deliver new Satellite and openAIP airspace capabilities in 3.7.0.** Existing Standard maps already work: do not treat re-releasing Standard as a new feature. Preserve standard flight maps, private/public replay, GPS, sharing, safety and canonical flight evidence.

- Satellite: optional Standard/Satellite choice on **authenticated** map and GPS review/replay surfaces, no persistence or automatic prefetch; UI selector default OFF via `NEXT_PUBLIC_FLYTALLY_SATELLITE_MAPS`, still subject to server-side credentials/usage security. Public share and new Story exposure NOT in 3.7.0 scope.
- openAIP: optional **airspace-only raster reference overlay** initially, authenticated views only, OFF by default. Not approved EFB, no claims of live activation, NOTAM status or clearance; other objects deferred. Public/export disabled.
- Final release requires both capabilities accepted or an **explicit revised owner release decision**; do not silently split/scope-reduce 3.7.0.

## State at this checkpoint — distinguish sources

| Area | Last supported fact | Current gate |
|---|---|---|
| Current production | Product version 3.6.0; Standard map Phase 1 **merged/deployed** at `main@cc7abd41858cb2b2ddd8e794889922c856885686` per canonical product document; owner-reported functional smoke and Map API HTTP 4/4 PASS | Do not re-release Standard; confirm latest main/deploy when continuing |
| Satellite UI R1 | `feat/3.7.0-satellite-selector-trial` tested on runtime HEAD `7661d1dd...`: owner-local ON/OFF release-risk PASS including 11/11 desktop+mobile each, PG 100/100 OFF run; PR #272 described as DRAFT | Not production-enabled; do not transfer PASS to later branch SHA or real provider |
| Satellite provider M3 | Bounded fetch/admission/raster/grid work in isolated branches; latest offline diagnostics `test/3.7.0-satellite-m3d5-exit-path@ec5770fa`: owner local 5/5 exit path, collector 7/7, TS/build PASS | No evidence-backed real end-to-end integration or provider coverage yet |
| ArcGIS real metadata | Two authorized **World Imagery** metadata GETs attempted; second HTTP 200 text/plain; collector denied; two Windows Node24 UV_HANDLE_CLOSING native assertions observed | Actual response body/grid unknown; preferred/fallback metadata NOT called in those attempts; **no further request approved** |
| DeepSeek M3-D6 review | External read-only review supplied 2026-10-10: lifecycle risk, compressed Content-Length flaw, provenance/CRS gaps; recommendations assessed, no M3-D7 code made | Defer generic extra Node diagnostics unless needed by a specific release gate |
| openAIP | Official schema entrypoints identified; rights for FlyTally's intended use, live API contract, keys/quotas/attribution/cache/effectivity unverified | **A1 external rights and current Tiles API contract BLOCKED**; do not ship/use key without evidence |
| Release | Satellite OFF; openAIP not delivered; no 3.7.0 release/tag | S1/S2, A1/A2 and exact-candidate release gate remain |

**Important:** `ROADMAP.md` contains many historical `STAGED / NOT VERIFIED` paragraphs superseded by later owner local results. They must not override this dated current-state table. Keep them as audit history, do not erase evidence. Doc-only branches are not proof of production state.

## Next bounded work — NO indefinite diagnostic batches

| Stage | One deliverable / decision | Exit criterion |
|---|---|---|
| **S1 — NEXT** | Choose Satellite provider architecture using exact provider, auth, terms, attribution, tile/grid compatibility and resource facts; compare legacy server compose with supported layered alternative | Written **GO / NO-GO / DEFER** + chosen approach + dependencies; no fabricated numbers |
| **A1 — IN PARALLEL** | Confirm openAIP Tiles API current schema, permitted FlyTally usage, server-only auth, cache/rate, attribution/data-age terms | Authoritative provider/license evidence or explicit **NO-GO / DEFER** and contact plan |
| S2 | Integrate approved provider design with authenticated tile route and Satellite selector, strict fail-closed budgets, attribution and Story/public protection | Real permitted representative evidence + current-commit tests and UX proofs |
| A2 | Implement private airspaces-only tile overlay on `flytallyAviation` pane, authenticated fixed-host proxy, no operational validity claims | HTTP unit/Playwright, missing/stale/unavailable, dark/iPad checks |
| R | Complete integrated 3.7.0 candidate | Exact SHA release verification, flags ON/OFF, PG, desktop/mobile/iPad, provider rights, security/cost/attribution, rollback/smoke; owner merge/deploy decision |

**Stop rule:** do not keep adding M3-D subbatches or local `PASS` counts unless the work directly resolves a specified release gate. Never enable external data with unverified rights/config. External blocker remains explicit; do not fill unknowns heuristically.

## Key documentation

- [Product contract](3_7_0_MAPS_AVIATION_LAYERS.md) — frozen surfaces/panes/privacy and terminology
- [Satellite R1 implementation](3_7_0_PHASE2_SATELLITE_IMPLEMENTATION.md) — UI flag and ON/OFF acceptance
- [Esri provider evidence matrix](../satellite-provider-resource-evidence-matrix.md) — exact outstanding technical/licensing evidence
- [M3-D4 transport review](../satellite-m3d4-transport-review-2026-10-10.md) — native error, hypotheses (not proven causes)
- `lib/satellite-map-provider.ts`, `app/api/map-tile/[z]/[x]/[y]/route.ts` — existing provider/authorization boundaries
- `tooling/collect-satellite-provider-metadata.mjs` — **diagnostic tool**, NOT an enabled provider
- `ROADMAP.md` / `FEATURES.md` / `CHANGELOG.md` — canonical governance with historical detail retained

## Work hygiene / closing

Small branch per milestone; distinguish branch/commit, local vs CI, synthetic vs supplier, tests PASS vs NOT RUN, DB and migration and deploy; update all three governance docs in same cycle. No writes to `flytally-training`. No new ArcGIS or openAIP supplier request without explicit scope and owner approval.
