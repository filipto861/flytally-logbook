# FlyTally Logbook — ROADMAP

**Current planning state:** 11 October 2026  
**Canonical repository:** `filipto861/flytally-logbook`; `main` is the source of truth.  
**Release candidate package version:** `3.7.0`; **last independently verified production footer:** `3.6.0` until a new deployment/alias smoke  
**Current release workstream:** `3.7.0 — Maps & Aviation Layers` (**owner UX accepted; version-cut candidate staged; production cut NOT YET VERIFIED**)  
**Last runtime-changing merge:** [PR #297](https://github.com/filipto861/flytally-logbook/pull/297), `090015053e33fb4b391a304e0a9e57f4145223a4`. Subsequent documentation commits do not by themselves demonstrate a new runtime release.

> **Reading rule:** This file describes the forward plan and verified current state, not the full dated development diary. The [verbatim pre-cleanup ROADMAP](docs/history/ROADMAP_BEFORE_2026-10-10_CANONICAL_CLEANUP.md), [earlier pre-reconciliation snapshot](docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md), milestone acceptance documents, GitHub PRs and CHANGELOG preserve decisions, failures and earlier verification identities. A historical `Draft`, `FAIL`, `OFF`, `NOT RUN` or unmerged status must never be applied to a later merged candidate without checking its date/SHA.

## 1. Verified release state

**Release candidate at 11 October 2026:** In response to the owner’s explicit closeout request, package and lock version are staged at `3.7.0` on a separate release branch, not claimed deployed. The 9-case owner-reported UX acceptance is in [final acceptance](docs/product/3_7_0_FINAL_PRODUCTION_ACCEPTANCE_2026-10-11.md). Prior source/Chromium gates at A2F exact code SHA remain historical evidence. Post-merge Vercel build, runtime alias SHA, deployed footer and smoke must be verified before marking `3.7.0 DONE / PRODUCTION`. Esri/openAIP rights and usage constraints remain **UNVERIFIED/BLOCKED** in a separately retained external-provider risk; acceptance is not approval of contractual/commercial permissions. No automatic provider flags, data migration or certified-chart claim.

| Scope | Current evidence | Remaining gate |
| --- | --- | --- |
| Standard maps | Phase 1 [#269](https://github.com/filipto861/flytally-logbook/pull/269) merged, deployed and owner-accepted; [#270](https://github.com/filipto861/flytally-logbook/pull/270) merged | Preserve strict style API and existing map/flight behavior |
| Satellite map selection | Authenticated map selector [#285](https://github.com/filipto861/flytally-logbook/pull/285) merged and deployed. Session security containment [#282](https://github.com/filipto861/flytally-logbook/pull/282) merged/deployed; owner-reported signed-in visual check on route overview | Entitlement, provider contract, cost/quotas/export/Story rights, iPad/real-user acceptance remain separate |
| Aviation overlay | Combined openAIP Aviation raster [#293](https://github.com/filipto861/flytally-logbook/pull/293), consolidated Map settings [#295](https://github.com/filipto861/flytally-logbook/pull/295), and z15–18 display retention/compact menu [#297](https://github.com/filipto861/flytally-logbook/pull/297) merged. Vercel Production deployment `dpl_8thpSpB1aGPEBtbjkPnU61qL771t` independently inspected: `READY`, exact runtime SHA `09001505`, `fly-tally.com` alias assigned | Signed-in real production map toggle/tiles/high-zoom smoke, light/dark and physical Safari iPad portrait/landscape; source reachability/rights/coverage/freshness/quotas unresolved |
| Product release | `package.json` reports `3.6.0`; deployment of some 3.7.0 scope does **not** equal full 3.7.0 acceptance or version bump | Integrated acceptance, provider decisions and explicit owner release closeout |

**Evidence taxonomy:** Prior exact-PR-head locally executed verification for A2F had Aviation client ON and OFF **each PASS** (per mode source 233/233, domain 36/36, Node 1473/1473, TypeScript/Next build, Chromium desktop/mobile 8/8 each; no retries/skips). PostgreSQL full/scale gates were N/A according to that planner and browser fixtures used separate local PostgreSQL environments. This is **owner-local evidence for the tested feature SHA**, not CI, not a new test of current documentation commits, not Safari and not a live provider smoke. Earlier failing test-sequence runs remain in [A2F acceptance](docs/product/3_7_0_A2F_MAP_OVERLAY_ZOOM_POLISH_ACCEPTANCE.md).

**Real-provider evidence boundary:** The A2D closeout [#294](https://github.com/filipto861/flytally-logbook/pull/294) reports one owner-observed authenticated same-origin openAIP PNG tile and Production flag activation; it does not prove broad geography, freshness, license terms or the full in-map workflow. A2D/A2E/A2F current reconciliation is in merged [#298](https://github.com/filipto861/flytally-logbook/pull/298).

## 2. Immediate execution order

**11 October owner decision — functional acceptance COMPLETE:** The owner states that all remaining 3.7.0 map/UI functionality was tested on 10 October 2026 and explicitly requests 3.7.0 closeout without repeating manual tests. PROD-01–09 are now classified **OWNER-REPORTED UX ACCEPTANCE**, not independent per-step tracing. Standard/Satellite, Aviation at z18, GPS playback/scrub, iPad Safari and GPS Tracks were separately confirmed in conversation. **Numeric 3.7.0 release is not yet published:** packaging/build/deployment identity and the release cut must be independently verified. Esri/openAIP entitlements, source currency and export rights remain **UNVERIFIED/BLOCKED** as external compliance issues, not silently marked approved; no change to existing provider flags or credentials is authorized. Earlier numbered plan below describes the pre-signoff steps and must not be read as a demand to repeat the owner's tests.

**Acceptance execution opened 11 October 2026:** [Exact-deployment production UX checklist and provider rights matrix](docs/product/3_7_0_FINAL_PRODUCTION_ACCEPTANCE_2026-10-11.md). Verified `fly-tally.com` alias points at A2F runtime SHA `09001505`; latest 24h Vercel error-cluster check returned no errors, but signed-in map/iPad interaction is **NOT RUN**. Esri/openAIP entitlement remains **BLOCKED/unverified**, not implied by existing enabled settings. Owner has now confirmed basic live map rendering, Standard ↔ Satellite switching, and Aviation overlay persisting visibly at zoom 18 in production (owner-observed PASS for these behaviors only). Owner additionally confirmed GPS flight replay and timeline scrubbing, with Standard ↔ Satellite switching and no observed map freeze or position reset (partial PROD-05 PASS). In direct response to the portrait/landscape iPad Safari check, owner confirmed that Map/Map Settings work (partial PROD-08 PASS); detailed Safari/touch/attribution assertions and independent screenshots are not recorded. Remaining PROD-01–09 assertions, error/attribution states, GPS import/tracks, public share and themes require their own evidence before explicit GO/NO-GO/DEFER. Owner deprioritized further Esri attribution work in this cycle; external permissions stay unverified, never silently approved. No version bump/deploy authorized by this document.

1. **3.7.0 acceptance / production UX:** Owner performs signed-in map settings, Standard/Satellite, explicit Aviation selection, zoom 14→18 (native imagery max z14, visually overscaled only), attributed/reference-only presentation, errors, dark/light and physical Safari iPad portrait/landscape. Record exact deployment/observations. Do not infer a PASS from synthetic Chromium coverage.
2. **Provider and security gates:** Record valid Esri/openAIP commercial/redistribution/export/usage entitlement, real-provider availability, documented source currency/coverage, quota and exact request behavior; check authenticated/private caching and no key exposure. Missing evidence = `BLOCKED` or `Unavailable`. No silent bypass.
3. **Integrated 3.7.0 decision:** Reconcile release acceptance and decide `GO / NO-GO / DEFER`, including what scope is approved. Only then update product version, release note/tag (if used) and production closeout. Do not silently mark partial deployment as full release.
4. **Documentation/GitHub housekeeping, parallel docs-only:** Complete PR reconciliation and the canonical docs cleanup, followed by evidence-preserving PR/branch classification. Historical drafts must not be merged to override current runtime. Any branch deletion requires an individual reference check and owner authorization.
5. **Next product release after 3.7.0:** `3.8.0` Currency/monetary semantics (issue #136). Begin design/implementation only following the current release decision or explicit reprioritization.

## 3. Frozen decisions / constraints

- **Repos remain separate:** No FlyTally Training changes in Logbook work.
- **Maps:** Standard default; authenticated-only optional Satellite and Aviation; no silently persisted layer preference or automatic switch; public replay stays Standard-only. Share Story's older map behavior must not be altered by this docs effort.
- **Standard map API:** missing `style` = legacy `map`; exactly one `style=map` or `style=satellite` accepted. Duplicate/malformed/unknown/empty/case-variant style → HTTP 400 `unsupported_style`, `no-store` before upstream.
- **Satellite security:** server-side live session check and private/no-store Satellite response. Never expose upstream credential or substitute a client flag for authentication.
- **Aviation applicability:** owner selected **combined Aviation raster**, superseding the earlier airspaces-only label. The private layer is reference-only, never an approved aviation chart, live NOTAM, airspace activation or clearance authority. Client can retain native z14 imagery through display z18; server still only requests permitted z<=14.
- **Operational evidence:** Third-party permissions, map coverage/currentness, and real provider responses cannot be inferred from a merged PR, an enabled UI flag or a synthetic test.
- **Flights and compliance:** one canonical flight model; shared strict Create/Edit/GPS rules; category/configuration/evidence fail closed; certified/finalized records stay auditable. No unapproved regulatory or certification claims.
- **Engineering:** exact-SHA test provenance, local ≠ CI, build ≠ runtime. Database schema/backup changes need independent migration and deployment prerequisites. No production DB operations as part of docs cleanup.

## 4. Forward release sequence

| Target | Description | Status |
| --- | --- | --- |
| 3.4.0 | Flight Entry Simplification | DONE / PRODUCTION |
| 3.4.1 | GPS Night-time reliability | DONE / PRODUCTION |
| 3.5.0 | Certified-flight voiding and multi-aircraft integrity | DONE / PRODUCTION |
| 3.5.1 | GPS T&G false-positive containment | DONE / PRODUCTION |
| 3.5.2 | Always-on GPS/SERA Night suggestions | DONE / PRODUCTION |
| 3.5.3 | Flight detail navigation | DONE / PRODUCTION |
| 3.5.4 | iPad flight-detail visual hotfix | DONE / PRODUCTION |
| 3.5.5 | iPad sidebar control alignment | DONE / PRODUCTION |
| 3.6.0 | Saved-date / timezone semantics | DONE / PRODUCTION |
| **3.7.0** | Maps & Aviation Layers | **RELEASE CANDIDATE; owner functional acceptance complete, production version cut awaiting independent verification** |
| **3.8.0** | Currency / monetary semantics · #136 | NEXT; preserve legacy denominations, no invented FX |
| 3.9.0 | Multi-aircraft heterogeneous onboarding proof | PLANNED |
| 3.10.0 | Multi-aircraft sharing / recovery / scale closeout | PLANNED |
| — | GPS T&G time-normalized / evidence-limited follow-up | RESEARCH |
| — | Professional Logbook Platform | RESEARCH |

The 9 October owner decision moved the **unstarted** Currency work to 3.8.0; it did not cancel issue #136, change approved monetary evidence rules or authorize silent data conversions.

## 5. Other open integrity and governance work

- **Production aircraft defaults:** [PR #299](https://github.com/filipto861/flytally-logbook/pull/299) describes an already executed one-time database-only aircraft-profile SE/SP backfill. It reported an anomalous King Air/C90 ULL classification, which must remain excluded from automatic correction pending aircraft/profile evidence and owner review. Documentation reconstruction is not an independent database verification.
- **Retired engineering drafts — owner decision 11 October 2026:** Satellite R1/R2 [PRs #271–#279](https://github.com/filipto861/flytally-logbook/pulls?q=is%3Apr+is%3Aclosed+is%3Aunmerged) and #281 were **closed without merge** as abandoned/superseded. No selective port is scheduled as a consequence of those old branches; prior [triage](docs/maintenance/2026-10-10-open-pr-triage.md) and [M2A source audit](docs/maintenance/2026-10-10-r2-m2a-source-audit.md) remain historical evidence, not active implementation instructions. The ten PR discussions and source history remain archived; the corresponding branch refs were subsequently removed in the separately verified 11 October cleanup after three archival tags were created. Current main remains the only development baseline.
- **Repository branch cleanup completed (11 October 2026):** [SHA-pinned audit, batch A/B and independently verified closeout](docs/maintenance/2026-10-11-branch-prune-preflight.md). Owner first archived three historical Satellite roots and removed ten abandoned R1/R2 branch refs (batch A). Subsequently, owner verified all six proposed old branches were fully ancestors of `main` and deleted those six refs (batch B), with GitHub independently confirming **28 branches (44 before both batches), 0 open PRs, 15 tags (including all 3 archival refs and the original 12 tags)**. No unreviewed branches were deleted; the pre-F3 integration anchor is intentionally retained. This is Git housekeeping only, not new runtime or 3.7.0 release acceptance. Dated counts are snapshots.

### Historical M2A source audit — no R1/R2 revival planned

The [10 October exact-SHA source review](docs/maintenance/2026-10-10-r2-m2a-source-audit.md) identified technical differences in old PRs (#273 Story tile failure handling; #278 server-only emergency stop; #279 non-integrated resource controls; #281 provider geometry review). **Owner declined revival of these dead-end development paths on 11 October 2026.** These are **not current scheduled milestones, approval to port code, or proof of a production incident**. If a genuine problem is observed in the active app, characterize it against current main and reprioritize it separately. Continue the actual 3.7.0 provider/iPad/integrated acceptance gates; nothing here approves its full release.

## 6. Documentation ownership and release DoD

- `ROADMAP.md` = current decisions, order, dependencies, milestones and acceptance.
- `FEATURES.md` = implemented/planned capability truth and intentional limits.
- `CHANGELOG.md` = what changed, with dated historical test and production evidence.
- `ARCHITECTURE.md` = runtime, data and domain contracts; `DEVELOPMENT.md` = verification, branches, CI and deployment policy.
- `docs/product/` = supporting source-backed implementation and milestone acceptance; `docs/history/` = earlier evidence and verbatim snapshots; `docs/maintenance/` = one-time audits and housekeeping plans.

A milestone is **DONE** only after implementation, evidence-based verification, relevant data/deploy checks and the required docs have been reconciled. Historical status errors are corrected by new dated evidence, never by misrepresenting older failures.
