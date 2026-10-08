# FlyTally Logbook Roadmap

**Status:** Active  
**Owner:** Filip Točík  
**Last updated:** 8 October 2026  
**Current production product version:** `3.5.5`  
**Current active release:** `3.6.0`

This is the canonical forward plan for `flytally-logbook`.

- `FEATURES.md` = what the product has / is intended to have.
- `ROADMAP.md` = order, dependencies, decisions and status.
- `CHANGELOG.md` = what actually changed.
- `ARCHITECTURE.md` = current architecture and data-integrity invariants.
- `DEVELOPMENT.md` = implementation / verification workflow.
- `docs/product/VERSIONING.md` = numeric release/versioning rules.
- Detailed release contracts belong under `docs/product/`.
- Superseded / historical milestone detail belongs under `docs/history/`.

A release is not DONE until implementation, verification, required documentation and production closeout are complete.

## Versioning rule

From 4 October 2026 forward, active product planning uses numeric `MAJOR.MINOR.PATCH` release versions only.

- No new active E/F/B/SP/M-style milestone families.
- Use the target release number plus **Phase 1, Phase 2, ...**.
- Database schema version, certification payload version and backup-format version are independent technical counters.
- Historical letter-coded milestones are preserved in `docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md`.

## Status legend

- ✅ **DONE** — implemented, verified, merged and production-closed where applicable.
- 🚧 **ACTIVE** — current release.
- ➡️ **NEXT** — first release after ACTIVE.
- ⏳ **PLANNED** — accepted direction, not yet next.
- 🔬 **RESEARCH** — not implementation-ready.
- ⚠️ **BLOCKED / EXTERNAL** — depends on evidence or a decision outside the repo.

## Current production baseline

| Area | State |
| --- | --- |
| Core logbook / certified record integrity | ✅ Production |
| Aeroplane / Helicopter / Sailplane / Balloon / ULL / conservative Other | ✅ Production |
| Manual + GPS flight entry | ✅ 3.4.1 production baseline |
| GPS review / T&G / Day-Night / Night-time suggestions | ✅ 3.5.2 production: always-on context-gated SERA suggestions + 3.5.1 fail-closed T&G containment |
| Certification / correction revisions / audit history | ✅ Production |
| Recency / licences / evidence | ✅ Production |
| Sharing / Connections / instructor workflows | ✅ Production |
| Aircraft profiles / profile sharing / canonical validation | ✅ Production |
| Backup / restore / protected history | ✅ Production |
| Statistics / professional presentation | ✅ Production |
| Production DB schema | **v20** — independent from product version |
| Product release version | **3.5.5** |

## Canonical release sequence

| Order | Target | Workstream | Status | Dependency / reason |
| ---: | ---: | --- | :---: | --- |
| 1 | **3.4.0** | Flight Entry Simplification | ✅ | Merged and production deployed on 5 October 2026 |
| 2 | **3.4.1** | GPS Night-time reliability | ✅ | Merged and production deployed on 6 October 2026 |
| 3 | **3.5.0** | Certified flight voiding + multi-aircraft integrity audit | ✅ | Merged and production deployed on 7 October 2026; schema v20 verified |
| 4 | **3.5.1** | GPS T&G false-positive containment | ✅ | Merged and production deployed on 7 October 2026; tightening-only reliability hotfix |
| 5 | **3.5.2** | Always-on GPS/SERA Night suggestions | ✅ | Merged and production deployed on 7 October 2026; no DB/certification/history rewrite |
| 6 | **3.5.3** | Flight detail navigation UX | ✅ | Merged and production deployed on 7 October 2026; immediate iPad visual follow-up is isolated in 3.5.4 |
| 7 | **3.5.4** | iPad flight-detail visual hotfix | ✅ | Merged and production deployed on 7 October 2026; production iPad visual acceptance confirmed the two 3.5.4 defects are resolved |
| 8 | **3.5.5** | iPad sidebar collapse-control alignment | ✅ | Corrective edge-handle placement deployed and accepted on production iPad on 7 October 2026 |
| 9 | **3.6.0** | Saved-date / timezone semantics · #144 | 🚧 | Active after 3.5.5 production closeout |
| 10 | **3.7.0** | Currency / monetary semantics · #136 | ➡️ | Next after 3.6.0 |
| 11 | **3.8.0** | Multi-aircraft heterogeneous onboarding proof | ⏳ | Prove no-code onboarding across supported categories |
| 12 | **3.9.0** | Multi-aircraft sharing / recovery / scale closeout | ⏳ | Close cross-workflow and scale evidence |
| — | — | GPS T&G time-normalized / evidence-limited follow-up | 🔬 | Confirmed ±10-point qualification defect; add-event logic needs broader real-track evidence before a release number is assigned |
| — | — | Professional Logbook Platform | 🔬 | No release number until scope is frozen |

**Pre-emption rule:** confirmed production, security or data-integrity defects may interrupt this order. Convenience/visual polish may not weaken evidence, validation, certification or historical integrity.

---

# 3.5.1 — GPS Touch-and-Go false-positive containment — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_1_GPS_TOUCH_AND_GO_RELIABILITY.md`

## Trigger

Three additional real SkyDemon KMLs exposed confirmed advisory T&G defects in the current detector:

- a false altitude T&G after a sensor level shift;
- a false altitude T&G during noisy climb-out;
- a false HIGH speed T&G caused by duplicate/stale position samples while the aircraft was climbing;
- a separate real T&G is still missed because the rolling-altitude qualification uses ±10 array points.

The false positives are the immediate data-integrity risk because `landingCount()` counts every returned T&G regardless of HIGH/MEDIUM confidence.

## Frozen 3.5.1 direction

- tightening-only hotfix: it may remove unsupported automatic T&G events but must not add a new auto-counted event;
- keep 28–145 km/h and 30 m rolling-altitude thresholds unchanged;
- keep the existing 25 m/s altitude discontinuity rule as a gross corruption guard, not an aircraft-performance model;
- do not add aircraft-specific flight-path-angle/performance assumptions;
- do not add spatial clustering or repeated-runway rescue;
- do not change takeoff detection helpers;
- require post-minimum climb evidence to be sustained beyond one timed altitude edge before a rolling-altitude T&G may count;
- admit speed/ground events as T&G only when their direct event motion is compatible with the existing 145 km/h rolling ceiling and usable altitude does not vary by 30 m or more during the alleged ground phase;
- rejected speed events must not suppress a valid altitude event;
- no DB/schema/certification/history rewrite.

Expected real-track outcomes:
- 0510261 false T&G: rejected;
- 0510262 immediate post-takeoff false T&G: rejected;
- 0510262 false speed T&G near 16:01:48: rejected;
- 0510263 positive control: exactly five T&Gs remain detected;
- 0510262 real T&G near 15:59: remains non-auto-counted in 3.5.1 because its approach evidence crosses a gross altitude discontinuity.

## Production closeout

3.5.1 is **DONE / PRODUCTION**:
- PR #245 merged to `main` as `230d835a9e4c3fddb02bf7b729242632626cb9a7`;
- Vercel deployment `dpl_AGLoght4FF1khhviPaZvMu5SZ2oT` is READY on that exact merge SHA and carries `fly-tally.com`;
- deployment root/login smoke returned HTTP 200;
- grouped runtime-error review found no errors in the checked post-deploy window;
- final candidate verification before merge: 1297/1297 unit/regression PASS, TypeScript PASS, production build PASS (41/41 static pages);
- PostgreSQL remains N/A: no persistence or schema contract changed.

## GPS T&G evidence-limited follow-up — RESEARCH

New evidence proves that ±10 array points is not a reliable physical qualification window: the known real 15:59 T&G misses +30 m climb evidence by ~0.27 m at point +10 and clearly exceeds it at point +11.

Research scope:
- elapsed-time / physical evidence-window research;
- an evidence-limited, non-counted "possible T&G" review tier if justified;
- density-invariance tests;
- explicit duplicate/stale-fix quality classification if needed;
- no spatial rescue unless separate evidence demonstrates that it cannot bootstrap low passes/go-arounds into landing evidence.

The earlier **T&G-only** provisional `3.5.2` reservation is superseded. This research remains unnumbered until a broader real-track corpus supports a safe add-event contract; product release `3.5.2` is now assigned to always-on GPS/SERA Night suggestions.

---

# 3.4.1 — GPS Night-time reliability — DONE

Detailed contract: `docs/product/3_4_1_GPS_NIGHT_TIME_RELIABILITY.md`

## Trigger

A production GPS review showed a confidently suggested NIGHT landing while Night time remained blank/manual.

Repository review confirms that this is possible because landing classification is event-level while Night-time accumulation is whole-track and currently returns `UNAVAILABLE` if any required segment fails its conservative guards.

## Frozen direction

- keep SERA geometric Sun-centre -6° and the ±0.5° confidence guard;
- keep GPS advisory/editable and IFR manual;
- never infer Night time from a night landing;
- add structured unavailable reason codes and human-readable UI feedback;
- keep manual Night-time edits sticky;
- do not auto-apply partial/lower-bound Night minutes;
- reuse canonical track discontinuity thresholds rather than inventing a second quality model;
- preserve the current >600-second fail-closed guard in 3.4.1; endpoint quality/displacement does not prove the unobserved sparse path, so sparse auto-classification is deferred until an evidence-backed contract exists;
- adaptive subdivision of an unsafe two-endpoint gap is not accepted as new evidence;
- no DB migration or certification-version change is expected.

## Single implementation phase — DONE

- structured unavailable diagnostics;
- pilot-facing unavailable reason copy;
- fail-closed >600 s sparse-gap handling; no endpoint-only path proof;
- shared GPS discontinuity contract for actual endpoint-quality rejection;
- fail-closed timestamp/position/confidence/discontinuity handling;
- stale automatic suggestion clearing while preserving sticky manual edits;
- targeted and full regression verification;
- real-like EHAM → LKPR fixture proving that NIGHT landing classification is independent from unavailable exact Night time when an earlier sparse gap blocks the whole-track total.

Production closeout on 6 October 2026:
- PR #241 merged to `main` as `b3e1de097b6d16cdaa96082d281602a2765b8ae0`;
- Vercel production deployment `dpl_3911vZiDAFduLhsPbyMnB1YtHKwn` is READY on that exact SHA and carries `fly-tally.com`;
- public production smoke returned HTTP 200 on the deployed root/login surface;
- grouped runtime-error query found no errors in the checked post-deploy window;
- DB schema remains v19 and certification payload remains v8;
- no migration or historical flight/certification/audit rewrite occurred.

---

# 3.4.0 — Flight Entry Simplification — DONE

Detailed contract: `docs/product/3_4_0_FLIGHT_ENTRY_SIMPLIFICATION.md`  
Independent review reconciliation: `docs/product/3_4_0_REVIEW_RECONCILIATION.md`  
UI matrix: `docs/product/3_4_0_FLIGHT_ENTRY_UI_MATRIX.md`

## Product goal

Make routine Manual/GPS entry materially simpler and more cockpit/iPad-friendly without weakening source provenance, validation, certification integrity, recency, sharing or historical record protection.

Target common single-flight flow:

**Source → Flight details → Save & certify**

with secondary/contextual information progressively disclosed.

## Frozen decisions

- GPS values remain advisory/editable; missing or ambiguous evidence fails closed.
- IFR remains pilot-entered.
- Existing SERA Day/Night/Night-time suggestion semantics remain unchanged.
- Certification remains an explicit pilot action.
- **Save & certify** is single-flight only in 3.4.0.
- **Save draft** remains available and is the implicit/default submit behavior.
- Pressing Enter must never certify.
- Certification hash/compliance/revision logic is reused from the current persisted-row authority path.
- If draft save succeeds but certification fails, the flight remains a draft with an explicit blocker message.
- Current generic GPS “I reviewed this flight” gate is removed only together with its server requirement.
- Only a non-blocking GPS-quality warning may require targeted acknowledgement; T&G detection, near-boundary SERA manual fallback and invalid profile state do not get extra acknowledgement checkboxes.
- Multi-flight GPS remains all-or-none **draft save only** in 3.4.0; no batch certification.
- Save & certify never sends PIC/crew/instructor invitations automatically.
- Regulatory category / evidence basis is part of the compact context and pre-certification summary.
- Collapsed sections must summarize their actual state; hidden must never mean invented zero/default.
- ULL category filtering remains correct; non-applicable Part-FCL/SFCL/BFCL purposes stay hidden.
- No new generic structured Training / practice purpose.
- Existing purpose codes/history remain backward-compatible.
- No DB migration is assumed.

## Phase 1 — Discovery / contract freeze — DONE

Repository reconciliation is substantially complete.

Confirmed current-state facts:
- current certification reads the persisted owned row, runs compliance, hashes certification v8 from that row and conditionally certifies only an uncertified record;
- current post-save page is a genuine second full Logbook-data review surface, not just a confirmation dialog;
- GPS `part_<n>_reviewed` is server-required but not persisted/certification-protected;
- Manual/GPS creation already uses flight fingerprint + PostgreSQL advisory locks + duplicate checks;
- GPS multi-flight draft creation is already transactional for parent/track/required connected-crew rows;
- recency and public-share authority require certified flights;
- `purpose_code` is certification-protected from certification payload v3 onward;
- Training-purpose UI is category-aware but server normalization also applies role/evidence gating, so one shared applicability contract is required.

Phase 1 closeout:
- KEEP / COLLAPSE / CONDITIONAL / REMOVE-DUPLICATE matrix frozen;
- pre-certification summary fields and blocker-to-disclosure mapping frozen;
- Enter/default-submit rule frozen: implicit submit = draft only;
- shared Training-purpose applicability predicate implemented and source-covered;
- independent review reconciled against actual repository behavior.

## Phase 2 — Information hierarchy — DONE

### GPS source
Default visible:
- source/file name;
- point count / detected-flight count;
- one concise source state;
- real GPS-quality warning when present.

Conditional:
- split controls hidden for one clean flight;
- split editor appears only for multi-flight/manual split/ambiguity;
- map + altitude/speed profile under **Review GPS track**;
- warning may auto-open visual review;
- raw diagnostics remain secondary.

### Flight context
Replace the large Common details area with one compact editable summary showing:
- aircraft registration/type;
- regulatory category / evidence basis;
- role;
- operation / engine where applicable;
- per-flight Role/Crew divergence when present.

Billing remains a secondary cost context, not a substitute for regulatory evidence.

### Flight details
Default visible:
- date;
- departure / arrival;
- landings total + Day/Night where applicable;
- Off-block / Takeoff / Landing / On-block;
- Night / IFR where applicable;
- concise Notes affordance;
- any blocking evidence problem.

Duplicate helper/provenance/status copy should be removed when one compact source/status cue is sufficient.

Phase 2 closeout:
- clean single-flight GPS track review is collapsed by default;
- multi-flight / ambiguous / warned GPS review remains surfaced;
- the old wizard-step chrome is removed;
- compact Flight context exposes aircraft + regulatory evidence basis + role + applicable operation/engine;
- Billing is no longer part of the primary context summary;
- clean GPS quality no longer emits a redundant standalone status line;
- incomplete imports jump to the first flight section that still needs evidence.

## Phase 3 — Progressive optional/contextual detail — DONE

Collapsed by default:
- additional crew;
- detailed aircraft provenance;
- Training purpose;
- Task / exercise;
- Costs / additional expenses;
- professional context;
- extended movement evidence when not required;
- source diagnostics.

Auto-open only when required, populated, invalid or explicitly opened.

Collapsed summaries must truthfully represent state and distinguish unset/unavailable/not tracked from explicit zero where the existing domain distinguishes them.

### Training-purpose reconciliation
- preserve the existing seven structured purpose codes;
- preserve category-aware regulatory filtering;
- keep ULL non-applicable Part-FCL/SFCL/BFCL purposes hidden;
- do not add a generic structured Training / practice marker;
- keep Task / exercise for ordinary descriptive detail;
- make one shared applicability predicate authoritative for both picker visibility and server persistence;
- preserve historical stored/certified purpose values even if current applicability differs.

## Phase 4 — Single-flight Save & certify — DONE

Primary explicit action:
**Save & certify flight**

Secondary:
**Save draft**

Rules:
- missing/default intent = Save draft;
- Enter/default submit cannot certify;
- save uses the existing canonical create path;
- certification re-reads the persisted row and uses one shared certification helper derived from current `certifyFlight`;
- hash is never calculated directly from raw form payload;
- certification failure after successful save leaves an owned draft and surfaces the blocker;
- successful certification requires no second certification click;
- existing correction-revision workflow remains authoritative for certified-flight edits;
- no sharing/invitation/verification side effect is triggered automatically.
- post-save blocker messaging, workflow readiness and the legacy Certify button all consume the same category-aware `flightCertificationCompliance` result used by direct certification.

### Pre-certification summary
Show next to the action:
- date;
- route;
- aircraft registration/type;
- regulatory category / evidence basis;
- role / required crew evidence;
- operation / engine where applicable;
- four movement times;
- landings Day/Night;
- Night / IFR;
- certification blockers.

Consequence copy:
**Certified flights are locked; later changes are recorded as corrections.**

## Phase 5 — GPS review-gate simplification / multi-flight safety — DONE

- remove the generic `I reviewed this flight` checkbox and server requirement;
- require targeted acknowledgement only for a non-blocking GPS-quality warning that the pilot is permitted to accept;
- T&G count remains visible/editable but gets no extra checkbox;
- near-boundary SERA remains manual/unavailable as today;
- invalid profile/evidence remains blocking;
- multi-flight import continues to save all parts atomically as drafts only;
- no 3.4.0 batch certification.

## Phase 6 — Responsive / interaction polish — DONE

Required:
- desktop;
- iPad landscape;
- iPad portrait;
- mobile 390;
- compact mobile/reflow;
- light + dark.

Acceptance:
- materially fewer default-visible sections than production 2.7.0;
- one obvious primary action for the current context;
- no horizontal overflow;
- blocker identifies which disclosure needs attention;
- async actions have pending/disabled duplicate-submit protection;
- keyboard/focus order remains usable;
- save/certification result is announced accessibly;
- no raw errors.

Phase 6 implementation notes:
- completion evidence is grouped into four concise semantic rows rather than eight nested cards;
- completion chrome was reduced to one `Review & finish` heading plus the certification consequence;
- targeted authenticated browser coverage now includes the GPS-quality acknowledgement gate in addition to Manual/GPS direct certification and Enter-to-draft behavior.

## Phase 7 — Release closeout — DONE

Local verification evidence recorded on 5 October 2026:
- TypeScript: **PASS**;
- complete unit/regression suite: **1230/1230 PASS**;
- PostgreSQL core acceptance: **73/73 PASS**;
- production Next.js build: **PASS**;
- targeted authenticated 3.4.0 browser acceptance: **6/6 PASS** across desktop Chromium and mobile Chromium;
- focused responsive Flight Entry smoke: **1/1 PASS** in desktop Chromium while internally covering desktop 1440, iPad landscape, iPad portrait and mobile 390 in light + dark;
- targeted 3.4.0 source/contract pack: **13/13 PASS**;
- GitHub CI: **NOT RUN by policy**; workflows are manual-only diagnostics.

Production closeout on 5 October 2026:
- PR #240 merged to `main` as `76b57c5674ffcc8c62bfbe73c59974cfde341a7a`;
- `package.json` on the merge SHA is `3.4.0`;
- Vercel production deployment `dpl_3Zcyq7QmdSGPj1AcSHe2gj2Rn29r` is READY on the exact merge SHA and carries the `fly-tally.com` alias;
- production runtime logs on that deployment show successful 200 responses across authenticated flight/dashboard routes;
- grouped runtime-error query found no errors in the checked post-deploy window;
- DB schema remains v19 and certification payload remains v8;
- no historical flight/certification/audit rewrite occurred.

Required evidence:
- targeted tests during implementation;
- TypeScript;
- full unit/regression candidate gate;
- PostgreSQL acceptance for save/certification, duplicate/concurrency and multi-flight atomicity;
- certification parity test between old explicit certification and new Save & certify on equivalent persisted rows;
- risk-based authenticated browser coverage for Manual + GPS completion, Enter-to-draft, GPS warning acknowledgement and the dedicated Flight Entry responsive matrix; a full repository-wide Playwright suite is not required for this release;
- production build;
- exact-candidate local verification evidence recorded;
- GitHub CI: **NOT REQUIRED**; manual-only diagnostic if explicitly requested;
- production deployment + smoke + runtime-error check;
- ROADMAP / FEATURES / CHANGELOG reconciliation;
- one-time product-version reconciliation to **3.4.0** only at ship time.

### 3.4.0 Definition of Done

- simplified hierarchy production deployed;
- single-flight same-page Save & certify verified;
- default/Enter submit cannot certify;
- Save draft remains valid;
- multi-flight import remains atomic draft-only;
- generic reviewed checkbox removed without losing required GPS-warning evidence;
- Training-purpose UI/server applicability unified;
- certification/audit/correction/share/recency authority unchanged;
- responsive light/dark acceptance passes;
- `package.json`, visible app version, CHANGELOG release heading and Git tag agree on `3.4.0`.

---

# 3.5.0 — Multi-aircraft integrity + certified-flight voiding — DONE / PRODUCTION

Goal: complete the remaining historical/dynamic applicability integrity work and add a safe way for a pilot to remove an incorrectly certified flight from all operational logbook use without destroying its protected audit evidence.

## Phase 1 — Certified flight voiding — LOCAL GATE VERIFIED

Frozen product behavior:
- a certified flight may be explicitly **voided/removed from the active logbook**;
- the voided flight must disappear from normal Flights, Dashboard, Statistics, Map, Print/Export, recency/compliance totals and every other operational/read-model consumer;
- a voided flight contributes **zero** operational/regulatory credit after the void operation;
- the original certified record, certification hash/revision, who voided it, when, and the mandatory reason remain preserved as audit evidence;
- this is **not** a hard delete and is not the existing 90-day draft Trash workflow;
- public shares are revoked and pending workflow requests are superseded as part of the void transaction;
- already-created participant-owned copies are not destructively deleted from another pilot's account;
- no one-click undo may silently resurrect the prior certification fingerprint;
- the action must be server-authorized, atomic and fail closed.

Design gate before implementation — **PASSED 6 October 2026**:
- independent review returned **APPROVE WITH CHANGES**;
- archive+delete was accepted as the fail-closed model;
- repository discovery confirmed the large direct-`flights` consumer surface;
- actual portable-backup baseline was corrected from the review handoff's v11 assumption to **v12**; voiding therefore requires **backup v13**;
- schema v20, permanent tombstone/archive children, participant-copy provenance, same-transaction certified DELETE authorization, dedicated audit route and restore resurrection guards are now frozen;
- implementation proceeds in M1–M6 from `docs/product/3_5_0_CERTIFIED_FLIGHT_VOIDING.md`.

Detailed contract: `docs/product/3_5_0_CERTIFIED_FLIGHT_VOIDING.md`.

Implementation milestones:
- **M1 — Schema v20 + archive invariants: VERIFIED LOCAL** — TypeScript PASS; migration/schema contract 10/10 PASS; PostgreSQL acceptance 6/6 PASS on 6 October 2026.
- **M2 — Domain mutation: END-TO-END VERIFIED LOCAL**
- **M3 — Audit-only UX: END-TO-END VERIFIED LOCAL**
- **M4 — Backup / restore v13: VERIFIED LOCAL** — exact-head TypeScript PASS; unit/regression 1280/1280 PASS on the immediately preceding runtime-equivalent head; PostgreSQL core 85/85 PASS on `7d18fb9`; production build PASS on the immediately preceding runtime-equivalent head.
- **M5 — Consumer and integration verification: VERIFIED LOCAL** — M5A source/runtime consumer contract PASS on `bb3fcd2`; M5B PostgreSQL collaboration/provenance acceptance **86/86 PASS** on `efd9b62`; M5C authenticated certified-void acceptance **2/2 PASS** across desktop + mobile Chromium on `a423239` after isolating the dedicated test notification fixture.
- **M6 — Release gate / documentation: LOCAL GATE VERIFIED** — exact-head `a2d3f65`: TypeScript PASS; full unit/regression **1285/1285 PASS**; full PostgreSQL integration + scale **99/99 PASS**; production build PASS. The runtime-equivalent M5C head `a423239` already has authenticated desktop/mobile browser **2/2 PASS**. GitHub CI is **NOT RUN — local-first policy**. Production migration/deploy is intentionally **NOT RUN** here because canonical `3.5.0` still includes Phase 2; production remains `3.4.1` / schema v19 until the complete 3.5.0 scope is release-ready.

## Phase 2 — Remaining multi-aircraft integrity audit — VERIFIED / NO RUNTIME CHANGE REQUIRED

Detailed discovery / review contract: `docs/product/3_5_0_MULTI_AIRCRAFT_INTEGRITY_PHASE2.md`.

Scope:
- audit remaining recency consumers for current-profile dependencies;
- preserve established ordinary ULL → SEP behavior;
- preserve explicit effective-dated `part_fcl_credit_*` provenance;
- verify Manual/GPS snapshot equivalence where applicable;
- preserve certification/revision compatibility.

Discovery on 7 October 2026:
- normal historical regulatory classification is already snapshot-owned: Dashboard, Statistics, Print/export, professional experience, SPL/BPL recency and helicopter flight eligibility read stored `flights` context rather than today's aircraft profile;
- Manual and GPS create paths both use PROFILE authority for the selected aircraft and persist the same flight-owned regulatory context; same-registration edits use SNAPSHOT authority rather than re-resolving today's profile;
- helicopter type recency uses the stored flight model/type; the current active helicopter profile is used only to enumerate/setup type workspaces, not to rewrite historical flight type;
- the only authoritative aeroplane-recency dependency on the current aircraft row is the intentional external Annex-I/ULL mapping tuple `part_fcl_credit_class/basis/from` in `recency-service.ts` and `recency-audit-service.ts`;
- ordinary ULL → SEP credit remains automatic and profile-independent. The explicit tuple is only the atypical class override/effectivity provenance path;
- no evidence currently justifies copying `part_fcl_credit_*` into certified flight snapshots or adding another schema migration.

Resolved integrity question:
- the aircraft-profile write validator requires a complete class + basis/reference + valid-from tuple, while the recency evaluator intentionally tolerates broader legacy input shapes;
- repository history showed v1.51.3 Add/Edit still required complete explicit tuples despite UI copy calling basis/from optional;
- a read-only production census on 7 October 2026 found **25/25 aircraft profiles with no explicit `part_fcl_credit_*` metadata**, including **295 saved flights** and **36 certified ULL flights**. There were zero complete overrides, partial tuples, orphan metadata, invalid dates or unsupported classes;
- therefore no compatibility relaxation, canonical-resolver runtime rewrite, flight snapshot expansion, schema v21 or certification-version change is justified for 3.5.

Phase 2 execution order:
1. freeze the consumer/dependency census with characterization tests — **VERIFIED LOCAL 4/4** on `69310a3`;
2. obtain independent review of the external-credit mapping boundary and legacy compatibility — **COMPLETE**; reviewer agrees with snapshot/external separation and no-migration default, but requires a bounded legacy rule before compatibility is widened;
3. reconcile v1.51.3/v1.51.4 persistence history — **COMPLETE**: the v1.51.3 UI/engine described basis/from as optional, but the server-side Aircraft Add/Edit action still required both whenever an explicit class was persisted; exact restore remained outside that validator;
4. run the read-only production `part_fcl_credit_*` shape census — **VERIFIED PRODUCTION READ-ONLY**: 25 profiles, all `NONE`; 25 active / 0 inactive; 295 saved flights; 36 certified ULL flights; no anomalous or explicit override shapes;
5. runtime decision — **NO CHANGE REQUIRED**. Keep strict profile writes, snapshot-owned historical facts, automatic ULL → SEP behavior and the existing external override concept. No schema v21 / certification payload change.

**Canonical final local gate: VERIFIED** on exact head `f0a1f1a` — TypeScript PASS; unit/regression **1289/1289 PASS**; full PostgreSQL integration + scale **99/99 PASS**; production build PASS. GitHub CI remains **NOT RUN — local-first policy**.

**Release candidate metadata:** package/app-visible version is now `3.5.0`; this identifies the unreleased candidate and does not claim production deployment. Schema-v20 production preflight/migration/reconcile/postflight tooling is implemented and locally source-verified **10/10 PASS** with TypeScript PASS on `eddbfb5`.

**Candidate metadata/build delta: VERIFIED LOCAL** on exact head `c0daa46` — version-governance **5/5 PASS**; production Next.js build PASS with **41/41** static pages generated.

**Production v20 preflight: VERIFIED READ-ONLY** on 7 October 2026 against production Primary / `neondb` — transaction read-only ON; exact migration registry v1..v19; no partial v20 tables/functions/triggers; 5 users, 25 aircraft, 295 flights, 95 certified flights, 56 certified revisions, 5 verifications, 16 participations / 11 accepted, 8 deleted flights; **7** provenance backfill candidates; preflight integrity guards passed.

**Production schema-v20 migration: APPLIED / VERIFIED** on 7 October 2026 after explicit approval. A pre-migration Neon branch `pre-v20-2026-10-07` (`br-dry-moon-b1n30x0b`) preserves the exact pre-write production state. Migration registry is now exact v1..v20; all required v20 objects/triggers/functions exist; provenance backfill produced **7/7** rows; immediate read-only postflight preserved 295 flights / 95 certified flights / 56 certified revisions / 16 participations / 11 accepted and created zero void-history rows. Final post-deploy reconciliation + postflight are still pending.

**Production closeout:** PR #243 squash-merged to `main` as `881f4b2159a00a23609bf9a3d4a783084a0ec5f1`; Vercel deployment `dpl_FTPxxhKFWnRRBvKZZPcNrYUYeZXn` reached READY and serves `fly-tally.com`; post-deploy provenance reconciliation completed; final read-only v20 postflight preserved all operational counts with 7/7 provenance rows and zero void-history rows; immediate runtime-error check found no errors.

**Subsequent release:** 3.5.2 always-on GPS/SERA Night suggestions.

A migration is allowed only when the Phase 1 data model or later evidence proves one necessary.

# 3.5.2 — Always-on GPS/SERA Night suggestions — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_2_ALWAYS_ON_NIGHT_SUGGESTIONS.md`

## Product decision

The account-level **Night definition** switch is removed. For GPS imports, FlyTally always attempts the existing SERA civil-twilight suggestions when the selected aircraft/logbook context supports the relevant Day/Night or Night-time fields.

## Frozen behavior

- remove the Night definition control from Settings;
- do not require or read an account preference to enable GPS/SERA suggestions;
- keep the existing geometric SERA civil-twilight model, confidence guard and fail-closed evidence rules unchanged;
- Day/Night landing suggestions remain applicable only where the canonical source requirements use a Day/Night landing split;
- Night-time suggestions remain applicable only where the canonical source requirements expose Night/IFR review;
- automatic values remain **suggestions**, not authoritative evidence;
- pilot edits remain sticky and must not be overwritten by later recomputation;
- unavailable/ambiguous GPS evidence still returns unavailable and leaves manual entry available;
- IFR remains manual;
- legacy persisted `night_definition` preference values may remain in historical settings JSON but are ignored by runtime behavior;
- no DB migration, certification-payload change or historical flight rewrite.

## Required verification

- Settings no longer renders or persists an active Night-definition choice;
- both legacy MANUAL and SERA accounts receive identical runtime GPS/SERA suggestion behavior;
- applicability gating by aircraft/logbook context remains intact;
- 3.4.1 Night-time fail-closed diagnostics remain intact;
- TypeScript, targeted tests, full unit/regression gate and production build before merge;
- PostgreSQL migration: N/A unless implementation scope changes.

## Production closeout

3.5.2 is **DONE / PRODUCTION**:
- PR #248 squash-merged to `main` as `60be6fd23f283302dadc7a3d611a19ff0bc8ebf3`;
- final exact-head local verification: TypeScript **PASS**, full unit/regression **1298/1298 PASS**, production build **PASS** with 41/41 static pages;
- targeted 3.5.2 / 3.4.1 / E2 GPS contract: **24/24 PASS**;
- PostgreSQL migration: **N/A**; schema remains v20, certification payload remains v8, portable backup remains v13;
- Vercel production deployment `dpl_4pyJEv2pjWQLNcmNPpFYcjsf3PHj` reached READY on the exact merge SHA and serves the production project/domain;
- deployment root/login smoke returned HTTP 200;
- immediate grouped runtime-error check found no errors.

---

# 3.5.3 — Flight detail navigation UX — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_3_FLIGHT_DETAIL_NAVIGATION.md`

## Product decision

Flight detail already has filter-aware Previous/Next navigation and a Back to flights link, but the controls are visually too quiet. Keep the existing navigation semantics and make them obvious and stable across desktop, iPad and mobile.

## Frozen behavior

- preserve `getFlightNavigationFast()` ordering, filtering and context-query behavior;
- keep `FLIGHT x/y` position evidence;
- expose an obvious **Back to flights** control;
- render **Previous flight** and **Next flight** as clear peer controls;
- keep both movement controls visible at list boundaries, with the unavailable direction explicitly disabled rather than removed;
- preserve the current flight-list filter/sort context in Back/Previous/Next destinations;
- no flight data, certification, recency, DB or persistence semantics change.

## Production closeout

- PR #250 squash-merged to `main` as `7068c5f03a3bf5b05ef5f0b45793db54848b9c9e`;
- final pre-merge local gate: targeted **18/18 PASS**, TypeScript **PASS**, full unit/regression **1302/1302 PASS**, production build **PASS** with 41/41 static pages;
- Vercel production deployment `dpl_5w2vFSXpSbVEruqcP8mzjXRLuqag` reached READY on the exact merge SHA;
- root/login production smoke returned HTTP 200 and the immediate grouped runtime-error window was clean;
- PostgreSQL migration: **N/A**; schema remains v20, certification payload v8 and portable backup v13;
- post-deploy iPad visual review found two presentation defects: **More** could wrap onto a second line for wider flight titles, and the visually hidden **Skip to content** link could leave a focus-colored border fragment in the iPad safe area. Those are isolated to 3.5.4.

---

# 3.5.4 — iPad flight-detail visual hotfix — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_4_IPAD_FLIGHT_DETAIL_UX.md`

## Trigger

Production iPad visual acceptance of 3.5.3 showed two presentation-only defects:
- the **More** control can wrap below Back/Previous/Next when the flight title consumes more header width;
- the off-screen **Skip to content** accessibility link can leave a cyan border fragment visible in the iPad safe area.

## Frozen behavior

- keep the 3.5.3 Back/Previous/Next destinations, disabled edge states, ordering and query-context preservation unchanged;
- keep the full desktop/iPad navigation row together when horizontal space is available;
- at narrower tablet widths, move the whole navigation group below the flight identity instead of allowing only **More** to wrap;
- keep the mobile Back + Previous/Next hierarchy unchanged;
- keep **Skip to content** keyboard-accessible, but make it fully visually hidden until it receives focus;
- no flight data, certification, recency, sharing, DB or persistence change.

## Required verification

- source regression for non-wrapping desktop/iPad navigation and whole-header tablet reflow;
- source regression for visually hidden skip-link state plus restored focused state;
- existing 3.5.3 navigation and v3.0 accessibility regressions;
- TypeScript, targeted tests, full unit/regression suite and production build;
- PostgreSQL migration: N/A.

---

# 3.5.5 — iPad sidebar collapse-control alignment — DONE / PRODUCTION

Detailed contract: `docs/product/3_5_5_IPAD_SIDEBAR_TOGGLE.md`

## Trigger

Production iPad review after 3.5.4 confirmed the flight-detail navigation and safe-area fixes are substantially improved, but exposed a separate shell presentation defect: the coarse-pointer enlargement of the sidebar collapse button leaves it visually overlapping the notification bell because the button is absolutely positioned relative to the padded brand row.

## Frozen behavior

- keep sidebar expand/collapse behavior and persisted `logbook-sidebar` state unchanged;
- keep the iPad/coarse-pointer 44 px touch target;
- align the collapse target vertically with the brand-row controls;
- move it horizontally into the sidebar rail/gutter so it no longer overlaps the notification bell;
- do not change phone/mobile navigation, notification behavior, sidebar contents or route semantics;
- no DB, flight, certification, recency, sharing or persistence semantics change.

## Required verification

- source regression for coarse-pointer placement and 44 px target preservation;
- existing sidebar/mobile/accessibility regressions;
- TypeScript, targeted tests, full unit/regression suite and production build;
- PostgreSQL migration: N/A;
- production iPad visual acceptance after deploy.

---

# 3.6.0 — Saved-date / timezone semantics — ACTIVE

Issue: #144  
Phase 0 contract: `docs/product/3_6_0_PHASE0_ENGINEERING_QUALITY.md`

## Phase 0 — Engineering quality / test architecture gate — ACTIVE

Timezone runtime implementation is paused until the repository's verification path is audited and hardened.

**Current step: Phase 0E — canonical verification commands — ACTIVE.**

Current milestone: **Phase 0E — canonical verification commands — ACTIVE**. Phase 0D evidence taxonomy is ✅ DONE / VERIFIED.

Phase 0D closeout:
- independent review verdict **ACCEPT WITH CHANGES** was reconciled into the registry/evidence design;
- development registry schema v3, homogeneous evidence metadata, planner/evaluator separation and fail-closed evidence semantics are implemented;
- first verification attempt exposed 14 stale historical source-location assertions from the already-verified Phase 0C browser split; they were retargeted without changing product runtime, browser behavior, DB schema or timezone semantics;
- final exact-code-head verification on `686734911f5c3f45e395fdda6b7d98a5021e84ae`: development-pipeline **65/65 PASS**, TypeScript **PASS**, aggregate regression **1354/1354 PASS**, production build **PASS (41/41 static pages)**;
- `domain-unit`: **N/A**; PostgreSQL acceptance: **N/A**; browser acceptance: **N/A** for this tooling/source-contract candidate.

Phase 0E now owns the next work: create a small canonical verification command surface for targeted iteration, changed-scope selection, complete application verification, explicit PostgreSQL/browser gates and risk-assembled release verification. Do not start 3.6.0 timezone runtime work while Phase 0 remains active.

Phase 0E discovery/design is complete enough for independent review; implementation has **not** started.

Current command-surface findings:
- `verify` is the existing complete application gate (`typecheck + npm test + build`) but its name is too generic;
- `verify:release` is currently static and semantically wrong for the new risk model: it always forces PostgreSQL full acceptance, never runs browser acceptance, and ignores `scope:changed`;
- `verify:browser` currently bundles the build prerequisite with browser acceptance and does not force explicit `--retries=0`;
- `scope:changed` is already the correct planner boundary and must remain side-effect free;
- PostgreSQL core/scale/full runners and the authenticated browser runner already fail closed and should be reused rather than replaced;
- manual GitHub workflows duplicate command composition and should consume the canonical commands after the local surface is frozen;
- **critical 0E gap:** `domain-unit` may be required by the Phase 0D evidence policy, but there is no canonical direct domain-evidence command or registry-backed domain-test selection. The heterogeneous full suite is explicitly forbidden from satisfying that evidence class.

Draft canonical command surface:
- `test:target` — unchanged raw targeted Node tests;
- `test:group` — unchanged homogeneous registry-backed targeted groups;
- `verify:plan` — side-effect-free candidate planner, sharing the `scope:changed` classifier; `scope:changed` remains a compatibility alias;
- `verify:app` — canonical complete application gate: TypeScript + full Node regression + production build; existing `verify` remains a compatibility alias;
- `verify:postgres` — canonical final PostgreSQL acceptance = full PostgreSQL gate; core/scale commands remain iteration/milestone tools;
- `verify:browser` — canonical full browser acceptance with explicit retries=0; it may build as an operational prerequisite because Playwright starts `npm start`, but build remains a separate evidence concept;
- `verify:domain` — direct domain-unit evidence over **explicit registry-approved test files only**; no inference from `npm test`;
- `verify:release` — risk-assembled local release orchestrator using an explicit candidate change set. It runs selected source-contract groups even when `npm test` is also required, runs direct domain evidence when required, and then only the heavy gates selected by the planner.

Candidate input must be explicit: positional paths, `--files <file>`, or `--base <git-ref>`; no guessed/default merge base. An explicit `--all` escape hatch may replace the legacy `[full-ci]` title convention while preserving backward compatibility.

Direct domain evidence is proposed as **opt-in per module** in the existing registry (for example module-level `evidenceTests.domain-unit`). Missing required domain evidence must fail closed before expensive gates rather than silently treating aggregate `npm test` as proof. No mass per-test classification project is proposed for 0E.

Proposed 0E milestones:
1. **0E.0 — discovery / command semantics freeze** — current step, independent review pending;
2. **0E.1 — shared explicit candidate-input + planner surface**;
3. **0E.2 — canonical app/PostgreSQL/browser/domain commands with compatibility aliases**;
4. **0E.3 — risk-based release orchestrator, fail-closed missing evidence, no implicit heavy gates**;
5. **0E.4 — regression tests for command selection, retries, candidate input and domain-evidence refusal**;
6. **0E.5 — manual workflow + DEVELOPMENT alignment**;
7. **0E.6 — exact-candidate verification / closeout**.

Frozen constraints for review:
- no product runtime, DB schema, certification, backup or timezone-semantic changes;
- no browser DB architecture or worker-count change;
- no remote/destructive PostgreSQL target;
- no aggregate `fullTests` → `domain-unit` inference;
- no automatic candidate base guess;
- preserve existing low-level commands and aliases where practical.

Phase 0A — gate safety / reproducibility — ✅ DONE / VERIFIED:
- fail-closed PostgreSQL gate ownership, localhost-only PostgreSQL acceptance targeting, real connection preflight before test fanout, explicit PostgreSQL CLI-path propagation, cross-platform direct execution of the pinned Playwright CLI, and deterministic localhost-only browser-fixture cleanup aligned with current GPS/3.5.2 UI contracts;
- repository-pinned Playwright 1.55.0 + explicit authenticated browser gate;
- Node 24.x alignment with the Vercel production runtime;
- corrected browser DB connection-timeout variable;
- DEVELOPMENT/Vercel policy drift reconciliation;
- exact-candidate evidence: targeted governance **32/32 PASS**, PostgreSQL core **86/86 PASS**, PostgreSQL full **99/99 PASS**, TypeScript **PASS**, production build **PASS (41/41 static pages)**, full browser **96 PASS / 2 intentional skips / 0 failed**, plus final stale v1.44 assertion rerun **5/5 PASS** after the preceding full suite proved the remaining 1,316 tests.

Phase 0E owns the next work. Do not start 3.6.0 timezone runtime work while Phase 0 remains active.

Mandatory Phase 0 scope:
- make explicitly invoked PostgreSQL gates fail closed instead of allowing a skipped integration suite to look like acceptance;
- replace duplicated/manual fast-suite lists with one authoritative risk/test registry;
- distinguish documentation, UI/presentation, domain, persistence/schema, auth/security, browser and scale risk;
- pin the browser test runner for local/manual-cloud parity;
- split the growing browser monolith into stable domain-owned specs without weakening isolated DB serialization;
- reconcile DEVELOPMENT documentation with executable tooling;
- review stale PR/branch state without deleting anything until supersession is proven.

No 3.6.0 saved-date/timezone runtime semantics are changed in Phase 0.

Phase 0 acceptance is defined in the detailed contract. Required closeout includes the applicable TypeScript, unit/regression, PostgreSQL, browser and build evidence plus ROADMAP / CHANGELOG / DEVELOPMENT reconciliation. FEATURES changes only if product capability changes.

## Phase 1 — Saved-date / timezone semantics — BLOCKED BY PHASE 0

Before code:
- define which defaults use configured user calendar timezone;
- identify evidence that must remain UTC;
- define midnight/day-boundary and DST tests;
- define timezone-setting changes versus already-persisted records;
- decide whether any existing persisted data requires treatment;
- define backup/export/edit consequences.

GPS/FCL.050 UTC evidence must not be converted into local-time evidence by convenience.

# 3.7.0 — Currency / monetary semantics — PLANNED

Issue: #136

Before code:
- define whether account currency is display/default denomination or record authority;
- classify records that already persist currency;
- classify legacy values with/without explicit denomination;
- define export/backup consequences;
- no automatic FX conversion without an explicit future rule.

# 3.8.0 — Multi-aircraft heterogeneous onboarding proof — PLANNED

Representative Aeroplane, Helicopter, Sailplane/TMG, Balloon, ULL and Other profiles must pass the same canonical workflow without make/model-specific runtime branches.

Proof includes:
- catalogue/manual identity;
- Add/Edit;
- Quick Add;
- deactivate/reactivate;
- flight selection;
- applicability guidance;
- desktop/iPad/mobile light/dark acceptance.

# 3.9.0 — Multi-aircraft sharing / recovery / scale closeout — PLANNED

Scope:
- aircraft sharing preserves recipient ownership + canonical validation;
- exact backup/restore preserves profile + protected-flight evidence;
- multi-profile picker/library behavior measured before optimization;
- deletion/deactivation remains safe when historical flights reference registration;
- complete regression / PostgreSQL / browser / build closeout.

# Research — Professional Logbook Platform

No product version is assigned yet.

Possible future scope:
- organization/operator accounts;
- fleet workflows;
- instructor/student organizational evidence;
- controlled reports;
- team permissions.

Promotion requires a dedicated research/design decision first.

## Permanent engineering constraints

- One canonical flight/data model.
- Manual/GPS/Create/Edit business rules converge rather than fork.
- Invalid combinations fail closed; no silent repair.
- Certified/finalized history is revisioned/audited, never destructively overwritten.
- Recency/currency/compliance claims are evidence-first.
- Auth/ownership is server-enforced.
- Schema changes are explicit deployment prerequisites.
- Production deployment is not inferred from build/merge success.
- Testing evidence is reported exactly as run.
- ROADMAP / FEATURES / CHANGELOG close in the same work cycle.

## Historical record

Pre-standardization milestone history, including the prior E/F/B/SP/M labels and detailed closeout evidence, is preserved at:

`docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md`

Historical docs remain evidence/context only. If they conflict with this ROADMAP on current priority, this ROADMAP controls.
