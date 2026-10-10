# FlyTally Logbook Roadmap

**Status:** Active  
**Owner:** Filip Točík  
**Last reconciled:** 10 October 2026  
**Current production product version:** `3.6.0`  
**Current active release:** `3.7.0`  
**Current active workstream:** Maps & Aviation Layers — **Satellite FIRST**, then openAIP airspaces; full 3.7.0 unreleased.

This is the canonical **forward execution plan** for `flytally-logbook`. Older milestone narratives, failed attempts, test logs and superseded PR states were preserved verbatim in [the pre-reconciliation roadmap snapshot](docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md). Dated evidence there is **historical**, never an instruction to override this page.

## Current state — 10 October 2026

| Area | Verified state | Gate / next action |
| --- | --- | --- |
| Production | Product `3.6.0`; database schema **v20** as recorded at 3.6.0 closeout | No 3.7.0 version bump/tag or full production release |
| 3.7.0 Phase 1 — Standard Maps | **DONE.** Feature PR [#269](https://github.com/filipto861/flytally-logbook/pull/269) and docs PR [#270](https://github.com/filipto861/flytally-logbook/pull/270) **MERGED**; Phase 1 accepted by owner | Do not reopen or describe #270 as pending |
| Phase 1 verification | Deployed at `cc7abd41` / Vercel `dpl_51zwnZYfFADxeDEyZheTYg9siXD8` READY; owner-reported live browser functional smoke PASS; public Map API **4/4 PASS**; prior exact-candidate local Node **1,447/1,447**, PostgreSQL **100/100**, build and desktop/mobile Chromium **12/12** each PASS | Native physical iPad/Safari and full provider acceptance **NOT VERIFIED**; do not inflate acceptance |
| 3.7.0 Phase 2 — Satellite | **Draft/unmerged** engineering in [PR #272](https://github.com/filipto861/flytally-logbook/pull/272) through [#279](https://github.com/filipto861/flytally-logbook/pull/279), with some exact-SHA **local synthetic** ON/OFF, auth/HTTP and browser PASS | **FIRST priority: S1 provider architecture/evidence decision**, then S2 controlled integration and real acceptance; production UI flag **OFF** |
| 3.7.0 Phase 3 — openAIP | Separate offline parser/gating spike staged on `feat/3.7.0-openaip-airspaces-a2a-offline-control`; no production overlay, owner tests on spike **NOT RUN** | **PAUSED until Satellite first milestone**; external rights and current Tiles API/schema **BLOCKED** |
| Next scheduled release | `3.8.0` Currency / monetary semantics | Do not begin runtime until 3.7.0 closure or explicit reprioritization |

**Source-of-truth boundary:** this table reflects inspected `main`, live GitHub PR states, and the owner's 10 October Satellite-first decision recorded in [the current-state handoff on an unmerged branch](https://github.com/filipto861/flytally-logbook/blob/feat/3.7.0-openaip-airspaces-a2a-offline-control/docs/product/3_7_0_CURRENT_STATE.md). The handoff is supporting evidence, **not merged runtime**. Offline supplier experiments and isolated tests are not real ArcGIS/openAIP acceptance.

### Frozen decisions and immediate next step

- **Satellite FIRST**: finish Satellite source-backed provider decision, integration, provider/security/licensing and UX acceptance before resuming openAIP implementation. Do not open new generalized Node/undici diagnostic loops by default.
- **Both Satellite and openAIP remain in the planned 3.7.0 deliverable.** If external provider evidence prevents openAIP delivery, only an explicit owner release/scope decision may change that; do not silently ship a partial 3.7.0.
- Standard remains default; optional Satellite applies only to authenticated routes/GPS/review surfaces, without automatic prefetch or stored preference. Public shared replay stays Standard-only. Existing Story Standard/Satellite and PNG behavior must be preserved, but its external-provider use/export rights need independent verification.
- openAIP first scope is **authenticated airspace-only raster reference overlay**, off by default. It is not an approved aviation chart, NOTAM, active-airspace or clearance authority; public/export excluded.
- No speculative Esri tile-grid transform, licence entitlement, provider quota, decoded-image resource budget, caching permission or production enablement. Missing evidence gives **BLOCKED / unavailable**, not invented defaults.
- Existing certification, flight model, GPS inference, sharing/privacy and 3.6.0 data integrity must not change as a side effect of maps work.

**Next bounded deliverable: `3.7.0 Phase 2 / S1 — Satellite provider decision`.** Compare the existing server-side imagery/label SVG composition against an officially supported layered Esri approach under actual tiling geometry, attribution, entitlement, cost, secure proxy and resource evidence. Produce a written **GO / NO-GO / DEFER** and a minimal S2 implementation plan; do not repeat unapproved live requests. Source-backed provider/rights and real tile-path checks are necessary before production ON. DeepSeek review should challenge the final S1 architecture before implementation.

## Document ownership

- `FEATURES.md` = implemented, intentionally constrained and planned capabilities.
- `ROADMAP.md` = active order, dependencies, decisions and acceptance.
- `CHANGELOG.md` = actual changes with historical dated evidence.
- `ARCHITECTURE.md` = canonical data/integrity model.
- `DEVELOPMENT.md` = verification and development workflow.
- `docs/product/VERSIONING.md` = numeric release/versioning rules.
- Detailed active release contracts belong under `docs/product/`; superseded detail belongs under `docs/history/`.

A release is not DONE until implementation, exact-candidate verification, required docs, and applicable production closeout are complete.

## Versioning rule

Since 4 October 2026, new release targets use `MAJOR.MINOR.PATCH` and `Phase 1 / Phase 2 / ...`; no new active legacy E/F/B/SP/M-style milestone families. Technical database schema, certification payload and backup-format versions are independent. Historical legacy milestones remain at `docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md`.

## Status legend

- ✅ **DONE** — completed and accepted for explicit scope.
- 🚧 **ACTIVE** — current release.
- ➡️ **NEXT** — first release after ACTIVE.
- ⏳ **PLANNED** — accepted, not active.
- 🔬 **RESEARCH** — not implementation-ready.
- ⚠️ **BLOCKED / EXTERNAL** — source, provider or external decision still required.

## Phase 1 frozen product decision — 9 October 2026

**Decision A APPROVED and shipped with Standard Phase 1:** For `/api/map-tile/[z]/[x]/[y]`, missing `style` means legacy Standard. Exactly one `style=map` or `style=satellite` is allowed. Duplicate, malformed, empty, unknown or case-variant style arguments return **HTTP 400** `unsupported_style`, `Cache-Control: no-store`, before upstream access. This intentionally rejects formerly permissive duplicate query handling. The parsing contract is **not** proof of Satellite provider authorization or entitlement.

## Current production baseline

| Area | State |
| --- | --- |
| Core pilot logbook, certified evidence and revisions | ✅ Production |
| Aeroplane / Helicopter / Sailplane / Balloon / ULL / conservative Other | ✅ Production |
| Manual and GPS entry, review, T&G and evidence-limited SERA Day/Night | ✅ Production |
| Recency, licences, shared flights, aircraft profiles, backups, statistics | ✅ Production |
| Standard map layer/controller | ✅ Phase 1 accepted on deployed `main@cc7abd41` |
| Product version | **3.6.0** |
| Database schema | **v20** (independent technical counter) |

## Canonical release sequence

| Order | Target | Workstream | Status | Dependency / reason |
| ---: | ---: | --- | :---: | --- |
| 1 | **3.4.0** | Flight Entry Simplification | ✅ | Production 5 October 2026 |
| 2 | **3.4.1** | GPS Night-time reliability | ✅ | Production 6 October 2026 |
| 3 | **3.5.0** | Certified flight voiding + multi-aircraft integrity audit | ✅ | Production 7 October 2026; schema v20 |
| 4 | **3.5.1** | GPS T&G false-positive containment | ✅ | Production 7 October 2026 |
| 5 | **3.5.2** | Always-on GPS/SERA Night suggestions | ✅ | Production 7 October 2026 |
| 6 | **3.5.3** | Flight detail navigation UX | ✅ | Production 7 October 2026 |
| 7 | **3.5.4** | iPad flight-detail visual hotfix | ✅ | Production 7 October 2026 |
| 8 | **3.5.5** | iPad sidebar collapse-control alignment | ✅ | Production 7 October 2026 |
| 9 | **3.6.0** | Saved-date / timezone semantics · #144 | ✅ | Production 9 October 2026 |
| 10 | **3.7.0** | Maps & Aviation Layers | 🚧 | Phase 1 ✅; Satellite FIRST, openAIP afterward; both source-gated |
| 11 | **3.8.0** | Currency / monetary semantics · #136 | ➡️ | Preserved after 3.7.0 |
| 12 | **3.9.0** | Multi-aircraft heterogeneous onboarding proof | ⏳ | Canonical multi-category workflows |
| 13 | **3.10.0** | Multi-aircraft sharing / recovery / scale closeout | ⏳ | Controlled recovery and performance |
| — | — | GPS T&G time-normalized / evidence-limited follow-up | 🔬 | More real-track evidence needed |
| — | — | Professional Logbook Platform | 🔬 | No release number |

**Pre-emption:** only evidenced production, security or data-integrity issues override sequence automatically. Any material product reprioritization requires an explicit owner decision and roadmap update.

## Completed numeric releases — reference only

Detailed previous acceptance, source decisions, code/test/production timelines and superseded failures for `3.4.0` through `3.6.0` are in the [verbatim historical roadmap snapshot](docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md) and `CHANGELOG.md`. These headings are retained as stable reference anchors, **not active milestones**.

#### 3.5.1 — GPS Touch-and-Go false-positive containment — DONE / PRODUCTION

#### 3.4.1 — GPS Night-time reliability — DONE
##### Single implementation phase — DONE

#### 3.4.0 — Flight Entry Simplification — DONE

#### 3.5.0 — Multi-aircraft integrity + certified-flight voiding — DONE / PRODUCTION

#### 3.5.2 — Always-on GPS/SERA Night suggestions — DONE / PRODUCTION
#### 3.5.3 — Flight detail navigation UX — DONE / PRODUCTION
#### 3.5.4 — iPad flight-detail visual hotfix — DONE / PRODUCTION
#### 3.5.5 — iPad sidebar collapse-control alignment — DONE / PRODUCTION

#### 3.6.0 — Saved-date / timezone semantics — DONE / PRODUCTION

---

# 3.7.0 — Maps & Aviation Layers — ACTIVE

**Product goal:** Standard/Satellite optional map layers on authenticated flight-map consumers and optional private source-backed openAIP airspace reference. Preserve center/zoom, GPS replay, Story behavior, privacy, theme/iPad usability, and no modifications to flight/certification/recency evidence.

**Source contracts and prior detailed evidence:** `docs/product/3_7_0_MAPS_AVIATION_LAYERS.md`, `docs/product/3_7_0_PHASE1_TEST_ACCEPTANCE.md`, `docs/product/3_7_0_MAPS_REVIEW_RECONCILIATION.md`, and [the historical roadmap snapshot](docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md). Latest unmerged handoff details are not a substitute for current PR/head inspection.

## Phase 0 — Discovery / review — DONE

Initial source inventory, pane/fallback contract and independent review completed. External provider eligibility is **not** cleared by that discovery.

## Phase 1 — Standard Maps controller — DONE / PRODUCTION

PR #269 merged as `cc7abd41`; PR #270 documentation closure merged as `7d47010e86`. Owner manual signed-in Map/GPS replay/public-share/mobile browser smoke PASS; production public Map API 4/4 PASS; original local release candidate Node 1,447/1,447, PG 100/100, build, Chromium desktop/mobile 12/12 each PASS. Native Safari/iPad device evidence remains unverified. **Do not report 3.7.0 as shipped.**

## Security pre-emption — Satellite tile endpoint auth (DRAFT / UNVERIFIED)

**10 October 2026:** Source audit plus DeepSeek S1.1 review identified that production `main` Satellite map-tile route had no per-request `getSession()` gate and returned publicly cacheable SVG with wildcard CORS. This is a **confirmed source-code exposure**, not proof that Esri requests succeed or that costs were incurred. An isolated `fix/3.7.0-satellite-endpoint-auth-containment` Draft patch is being prepared to require live session 401, send `private, no-store` on success and preserve legacy public Standard and authenticated Story. **NOT MERGED/DEPLOYED; tests NOT RUN.** The security patch deliberately keeps the shared Next.js 16 route on default request-time GET behavior instead of `force-dynamic`, to avoid overriding the Standard upstream's explicit `next.revalidate` fetch-cache contract. Confirm via actual Next HTTP tests. Before any merge/deploy: exact-candidate automated + authenticated Next HTTP tests, risk-plan build/browser/PG as selected, public CDN cache/old-object review, owner version/rollout/rollback decision. UI Satellite remains OFF; this fix does not clear provider licensing, geometry, resource budgets or 3.7.0 release gates. Details also in Draft [S1 reviewer reconciliation](docs/product/3_7_0_S1_SATELLITE_ARCHITECTURE_DECISION.md) (unmerged PR #281). The [security acceptance runbook](docs/product/3_7_0_SATELLITE_AUTH_SECURITY_ACCEPTANCE.md) defines isolated route behavior tests, Next/Story/browser gates and CDN/browser cache rollout. This is source/testing scaffolding, **not a local Node PASS**.

## Phase 2 — Satellite — ACTIVE / SOURCE-GATED

**Owner priority: Satellite FIRST (10 October 2026).** Existing stacked Draft branches/PRs contain a local-only selector and engineering/testing for Story PNG, authenticated tiles, fallback, emergency upstream disable and bounded-provider helper experiments. Some earlier exact runtime SHAs passed local ON/OFF release gates with synthetic upstreams. None proves actual Esri tile-grid compatibility, entitlement, cost, live supplier response, production authorization or physical Safari.

1. **S1 — NEXT: source-backed provider architecture / rights decision.** Verify exact Esri World Imagery + labels scheme compatibility (256 vs 512 tile contracts), supplier attribution, tile/export rights, token/referrer privileges, acceptable caching/cost and bounded resource policy. Compare existing server composition against documented layered approach; resolve **GO / NO-GO / DEFER**, without guessed transforms or unapproved supplier probes.
2. **S2 — conditional integration.** Integrate only the selected scheme into existing authenticated map/Story boundaries; keep Standard default and public share Standard-only. Enforce server-side session/disabled-state ordering, no-store as required, controlled unavailable/fallback and correct attribution. No new database or certified flight changes by assumption.
3. **S3 — acceptance gate.** Real permitted provider evidence, ON/OFF exact-SHA testing, Next build, isolated PostgreSQL if selected by risk planner, authenticated HTTP, desktop/mobile/iPad landscape+portrait light/dark/browser touch, Story exports, error/no-provider paths and production smoke **before activation**. Synthetic PASS cannot replace provider licence or production test.
4. Existing Satellite provider metadata attempts were inconclusive (one rejected Content-Type, one HTTP 200 `text/plain` rejected by collector; Windows Node native assertion root cause not established). **No additional supplier GET pre-approved**. Do not loop diagnostics unless a concrete S1 decision requires them.

## Phase 3 — openAIP Airspaces — PLANNED / EXTERNAL BLOCKED

**Pause active implementation until Satellite acceptance.** Earlier A2A offline parsing/capability-gate code is staged only, not merged/tested as a product feature. Before any live proxy: establish authoritative applicable SaaS usage rights, current Tiles API schema/auth, airspace-specific layers, attribution, quota/cost, caching and source-age requirements. Unknown or missing rights mean **unavailable**. Following approval, implement authenticated fixed-host raster overlay in `flytallyAviation` pane with nonauthoritative airspace wording; no public sharing/Story tiles, no NOTAM or activation claim.

## Phase 4 — Integrated release acceptance — PENDING

Full 3.7.0 requires **both** Satellite and openAIP source-backed delivery unless owner explicitly changes scope. Exact candidate release gate and feature-flag ON/OFF, PostgreSQL, browser/iPad, rights/attribution, logs, provider observation, rollback, production smoke, VERSIONING/package/footer/CHANGELOG and final owner merge/deploy acceptance. **No merge en masse** of stacked drafts; integrate in reviewed small batches. No CI/deploy success is inferred from local tests.

# 3.8.0 — Currency / monetary semantics — NEXT (formerly 3.7.0)

Preserve issue **#136** and all existing monetary/data-integrity decisions: classify currencies already persisted, account default/display versus record authority, legacy values without explicit denomination, export and backups. No silent FX conversion or guessed legacy currency. Reconstruct code/data, freeze contract and request independent review before implementation.

# 3.9.0 — Multi-aircraft heterogeneous onboarding proof — PLANNED (formerly 3.8.0)

Prove canonical catalogue/manual identity, Add/Edit, Quick Add, deactivate/reactivate, flight selection and applicability across Aeroplane, Helicopter, Sailplane/TMG, Balloon, ULL and Other, desktop/iPad/mobile and light/dark. No make/model-specific branch.

# 3.10.0 — Multi-aircraft sharing / recovery / scale closeout — PLANNED (formerly 3.9.0)

Prove shared profile recipient ownership, canonical validation, safe removal with historical flights, backup/restore of certification evidence and measured multi-profile scale before optimization. Exact tests, DB and browser acceptance required.

# Research — Professional Logbook Platform

No version assigned. Organization/operator accounts, fleet workflows, instructor/student organization evidence, team permissions and reports require a separate product-scope decision.

## Permanent engineering constraints

- One canonical flight model, shared strict Create/Edit/GPS rules; invalid evidence or combinations fail closed.
- Certified/finalized history remains audited, never silently/destructively overwritten; regulatory/recency claims evidence-first.
- Server-side authentication and ownership are mandatory; no client-only provider permission.
- Schema/backup/certification changes are explicit migration and release decisions, not map-side effects.
- Runtime/code and UI verification must be for the exact commit and environment; unknown steps remain **NOT RUN**.
- ROADMAP, FEATURES and CHANGELOG reconciled in each milestone; do not rewrite past verification into a fictional PASS.
- No change to `flytally-training` in this release.

## Historical record

- [Verbatim pre-10-Oct-2026 roadmap snapshot](docs/history/ROADMAP_FULL_SNAPSHOT_BEFORE_2026-10-10_RECONCILIATION.md) — includes previous numeric-release detail, PR #269 pre-merge attempts, stale contemporaneous Phase 1 statuses and long verification logs; **not a current roadmap**.
- `docs/history/ROADMAP_PRE_NUMERIC_2026-10-04.md` — previous E/F/B/SP/M milestone history.
- `CHANGELOG.md` — dated merged/deployment/verification history; its older entries describe status **at the time written**, not today's current state.
