# FlyTally Logbook — Flights Apple Design V2 / Design Quality V2 source audit

## Owner selection 2026-10-26 — supersedes the original broad ranking
- **Scope confirmed:** `/flights` **LIST ONLY**, not `/flights/[id]` (opened flight), New Flight, GPS import/save, certification forms or shared workflows. The latter remain for later explicit phases; this request only chooses current Flights work order and does not cancel historic GPS Save First.
- **Explicitly DEFER** F-A01 5000-record `All` cap, F-A02 invalid deep-pagination/No flights found, F-A05 narrow-mobile category control. Preserve their current behavior unmodified even though source audit identified caveats.
- **Selected for work:** F-A03 **display-only** missing-time versus zero distinction and dramatically clearer separate BLOCK/AIR numbers for aircraft techlog transcription, with both clock pairs **visible in list without opening a flight**; F-A04 improve scanning and rearrange existing information rather than remove fields; F-A07 simplify controls **later as list-only second micro-batch**. Flight logged-time summary rules/calculation/persistence, aviation evidence, certification and all record context stay unchanged.
- **New requirement F-A10:** small discreet departure and destination **country flags** next to both airport codes. Source only `getCatalogAirport(ident)?.country` (`data/airports.csv` `iso_country`), never ICAO prefix inference; absent/unknown country => no flag. Initial prototype uses Unicode regional-indicator emoji, therefore **Windows Chrome color-flag rendering and Vercel availability/performance are NOT VERIFIED**. If Windows displays letters instead, choose local licensed SVG flag assets only after review, not external image CDNs without privacy/performance decision.
- **Approved staging route:** independent feature branch `feat/logbook-flights-list-time-flags-20261026` on verified main, no code landing on docs-only Draft #420. The feature PR is not merge/deploy authorization.
- **Acceptance:** user must be able to copy BLOCK and AIR duration individually and see actual OFF/ON and TAKEOFF/LANDING pairs in the list, including incomplete/unknown `—`; flags visually unobtrusive and source-backed. Existing certified/draft/shared/GPS/cost and category totals remain present. Motion NONE, no new libraries, preserved brand, no DB writes/flags/Training.

**Date:** 2026-10-26 UTC. **Mode:** READ-ONLY SOURCE AUDIT AND IMPLEMENTATION PROPOSAL, not a verified browser audit or approved feature implementation.
**Canonical repository/main:** `filipto861/flytally-logbook` at `5a51a214016a5815851b875a395bb12a36efc207`. **Audit branch:** `docs/flights-ux-skill-audit-20261026` (docs only, main-based).
**Runtime:** Vercel project `logbook`; `fly-tally.com` was independently observed READY on `dpl_Dqo7Tyj7kk311BdfwFPm8UXx9mLa`, source `cffbff69416e8c27f0e87c7de4aac3329dcdcb4f`. Merge-main and production Git source SHAs differ; do not equate an app-source audit with a browser screenshot or live account test.

## Decision and source authority

- Owner requested a complete audit and improvement of the **Flights** area using latest merged repo skills. **No approval** to change production, migrate DB, toggle flags, merge this audit or reprioritize already-frozen work without review.
- Mandatory: `.agents/skills/apple-design/SKILL.md` and **full 17-chapter** `APPLE_DESIGN_PLAYBOOK.md`; `ui-ux-design`, `design-engineering`, `mobile-ipad`, `ui-quality-audit` plus `EXTERNAL_DESIGN_QUALITY_V2.md`, `flight-integrity`, `aviation-regulatory`, `database-security`, `testing-quality`, `release-workflow`.
- Existing owner-frozen path preference from [Draft PR #404](https://github.com/filipto861/flytally-logbook/pull/404): **GPS import → Save one flight FIRST; Manual entry SECOND**. Its plan is still Draft/stale; do not silently invert this priority by calling a Flights-list overhaul the new primary roadmap.
- Source code and current main > outdated ROADMAP/older Draft PR status notes. Inactive drafts #380 (narrow category discovery), #378 (cancelled unsaved tab/focus), #404 (GPS Save First) exist; each had an older base and must be rebased/reviewed/tested before any reuse; don't stack changes blindly.

## Scope / present behavior (code observed, *not* browser observed)

| User journey | Source | Current UI behavior |
| --- | --- | --- |
| Find/open Flights | `app/(protected)/flights/page.tsx`, `lib/data/flights-fast.ts` | Search GET + 13 advanced filter controls + six category tabs + active filter chips; five totals, eight-column table, record/certified/shared/GPS/cost indicators and list pagination |
| Review one flight | `app/(protected)/flights/[id]/page.tsx`, `components/flight-detail-workspace.tsx` | Overview/GPS/Logbook tabs; locked/certified correction, audit, sharing, saved-state completion and unsaved-change guard |
| Create a flight | `app/(protected)/flights/new/page.tsx`, `components/flight-entry-workspace.tsx`, `components/flight-form.tsx`, `components/kml-import-form.tsx` | Manual/GPS mode, first-aircraft dialog, guarded pilot review/persistence; no authorization to change default aircraft or inferred fields |
| Review exceptions | `app/(protected)/flights/needs-attention/page.tsx` | Separate contradiction/incomplete-data queue limited to most recent 500 records |
| Visual cascade | `app/layout.tsx`, `app/globals.css`, `app/v140-flights.css`, last-import `app/ui-system.css` | Desktop table; <=760px list rows become cards, later selectors change heading/panel/task rhythm. Final **computed** styles were NOT read from a live browser |

## Findings (ordered by consequence; severity requires browser/evidence confirmation)

### F-A01 · P1 · 'All records' can omit records beyond cap — CODE-INFERRED

- **Location:** `app/(protected)/flights/page.tsx`: `size==="all"` maps to 5000 and sets `all=true`; `Pagination` displays **All records** without page navigation. `lib/data/flights-fast.ts:getFlightsPageFast` honors a maximum **LIMIT 5000**.
- **Conflict:** for >5000 matching records the UI *claims* all records while silently rendering only first 5000. Numeric summary might describe more records than are visible. These are **not** flight deletes; misleading completeness is a serious logbook problem.
- **Smallest acceptable repair:** replace `All` with a truthful bounded view or true progressive/streamed full-result experience; preserve stable filters/sort and explicit displayed/total count. Never fetch thousands solely to make a button say All.
- **Regression:** isolated seeded 5001 rows (owner-scoped), first/last page, filtered and unfiltered, count semantics, no loss of access, scale/performance planner.

### F-A02 · P1 · out-of-range pages masquerade as zero flights — CODE-INFERRED

- **Location:** `lib/data/flights-fast.ts:getFlightsPageFast` gets `total_count` and aggregates from **rows[0]** after SQL `LIMIT/OFFSET`. If a user opens a stale deep link or filters shrink while `page` is high, the page query returns zero rows and `total`/summary become zero. UI displays `No flights found`, even when earlier pages contain matching flights.
- **Smallest repair:** obtain an authoritative matched count independently of the returned page window, then clamp/redirect invalid page while preserving filters. Do not read all rows to compute a count. Preserve backed cost/role summaries.
- **Regression:** `?page=999`, page becoming invalid after filter change/deletion, no flights at all, single surviving record, 25/50 paging, same user id only, SQL query performance.

### F-A03 · P1 domain risk · unknown duration maps to zero / BLOCK fallback — CODE-INFERRED

- **Location:** `lib/data/flights-fast.ts` SQL `CASE WHEN valid time pair THEN ... ELSE 0 END` for AIR/BLOCK minutes and `mapRow` numeric default 0. Both SQL summary and `page.tsx` use `AIR > 0 ? AIR : BLOCK` for Sailplane/Balloon, and `page.tsx` prints an AIR value derived as 0 despite incomplete timestamps.
- **Risk:** can't distinguish genuinely measured zero from an unavailable time. Category-specific fallback is established historic behavior, so **do not silently change flight-credit calculation** during a visual project.
- **Proposed step:** domain-owner review of missing-time provenance in the canonical model and all statistics/export/recency consumers; at minimum improve view-level `Unavailable` and explicit fallback provenance, pending approved semantic design. No made-up times.
- **Regression:** genuine 0 vs absent vs malformed, multi-day overnight, glider/balloon AIR missing, certified correction stability, same source across List/Detail/Exports.

### F-A04 · P2 · list information hierarchy and touch density — SOURCE OBSERVATION; layout impact UNVERIFIED

- **Location:** `app/(protected)/flights/page.tsx`: five summary values, 13 advanced controls, 8 table columns, multiple labels per record. `app/v140-flights.css` below 760px translates every row into a long card; status chips go as low as `.61rem` and pagers `34px`, while later theme/touch rules may affect computed sizes.
- **Design proposal:** one immediately discoverable row identity (**date + registration + route**), secondary exact record state/role, consistent `Open flight` with actual touch target; keep GPS/cost/time/landings accessible without hiding protected evidence. Search/categories/filters compose a single clearly labeled `Find and filter` station using approved N2 hierarchy. Reuse existing tokens and components (no glass/new UI library). **Motion: NONE**.
- **Evidence requirement:** verified synthetic long registration/airport/task, certified+shared/correction mix, cost unavailable, no GPS, zero rows at 320/390/768/1024/1440, light/dark/night supported, tabular numerals, focus/keyboard/touch, reduced motion. Inspect actual final cascade before CSS edit.

### F-A05 · P2 · selected category discovery on 320px — KNOWN DRAFT, NOT NEWLY VERIFIED

- **Location:** `page.tsx` has six horizontal category links, `.period-control` is horizontally scrollable; [Draft #380](https://github.com/filipto861/flytally-logbook/pull/380) proposes three columns × two rows at <=390px.
- **Disposition:** reuse/reconcile this older *unmerged* work after rebasing to current main; no duplicate implementation. Earlier owner U0 evidence showed narrow discovery friction, **not proven scrolling breakage**.

### F-A06 · P2 · cancelled unsaved tab switch may move focus anyway — KNOWN DRAFT, CODE-INFERRED

- **Location:** `components/flight-detail-workspace.tsx:onTabKeyDown` calls `selectTab(nextTab)`, then unconditionally `.focus()` next tab. `selectTab` returns without switching when user cancels the unsaved-change confirmation (or when submitting). This can leave focus on an unselected tab with `tabIndex=-1`.
- **Disposition:** existing [Draft #378](https://github.com/filipto861/flytally-logbook/pull/378) addresses this known focus case and has older test evidence. Rebase and validate against current main; no duplicate rewrite; preserve unsaved data and certification revision.

### F-A07 · P2 · filters and result boundaries need explicit feedback — CODE-INFERRED

- **Location:** `page.tsx` accepts `from`/`to` query strings into list SQL filters with no visible invalid/reversed-range explanation. Advanced form and search form are separate native GET submissions and selections persist via `HiddenParams`.
- **Proposed step:** one explicit applied-filter summary and range errors that distinguish **invalid query** from **empty valid result**; results count, Clear search/filters, consistent previous/next. Use no automatic broadening of failed filters. Stable sharable URL remains supported.
- **Regression:** invalid dates, reversed bounds, year/category selection, Clear all, empty search, Enter key and focus after full-page navigation.

### F-A08 · P3 · native table headings hidden on mobile / duplicate CSS variants — SOURCE OBSERVATION, a11y UNVERIFIED

- **Location:** `app/v140-flights.css` sets mobile `thead{display:none}` and `td:before{content:attr(data-label)}`; `app/globals.css` also contains older card/table mobile rules; final `app/ui-system.css` is imported after both. Pseudo-content may not be a reliable accessible header substitute for a transformed table. Some <=520px rules refer to obsolete data-labels like Aircraft/Date/Duration.
- **Proposal:** semantic associated labels in actual DOM or accessible table headers preserved across card transform; drop truly dead declarations only when actual computed cascade proves they are obsolete. Don't delete CSS blindly.
- **Regression:** screen reader/keyboard, 200% zoom, target sizes, sticky/header overlap, no root/inner horizontal overflow, 320px long values.

### F-A09 · P3 · avoid official-approval implication in record badge tooltip — CODE-INFERRED

- **Location:** `recordStatus` in `page.tsx` gives a `Certified Rn` badge `title="Official locked logbook record"`. It is a protected recorded status, not an independent regulator-issued authorisation.
- **Proposal:** retain the exact certification/protected revision semantics; choose provenance-accurate explanatory text, e.g. `Protected certified FlyTally record`. Only change wording after domain confirmation.

## Existing protections worth preserving

- Auth `requireUser()`, SQL `f.user_id=${userId}`, track/participant counts isolated by owner, parameterized queries; no direct exposed private-flight data in audit.
- Certified revision and correction indicators distinct from participant response, sharing role, attached GPS badge and cost metadata fail closed (`Unavailable` rather than guessed currency).
- URL-persistent filters, stable sorting with id tie-break, category-aware flight classes and current existing detail navigation.
- Detail has review/lock/certify/share workflow, unsaved confirmation and explicit pending affordances; do not regress or auto-apply flight data.
- Existing owner-approved Dashboard V11 design is untouched; do not restyle global shell or change FlyTally brand.

## Proposed milestones (NOT APPROVED FOR IMPLEMENTATION)

1. **Flights F0: source-backed correctness**, isolated list count/page window fixes (F-A01 / F-A02); separate domain review and acceptance first for missing-duration semantics (F-A03). No database schema change, no flight-record mutations. Targeted source/domain + owned PostgreSQL/large fixtures, browser list paging. Fail-closed.
2. **Flights F1: read/scan/navigation**, one narrowly scoped Flights List information-hierarchy/filters/mobile proposal (F-A04 / F-A07 / F-A08 / F-A09), based on actual synthetic screenshots/computed cascade. Preserve approved N2 design tokens. Integrate #380 only after current-main re-review. Motion NONE, no new dependencies.
3. **Flights F2: review/edit focus**, reconcile the prior #378 unsaved-cancel keyboard tab transition on latest main and verify correction/certification evidence. No automatic merge of stale PR.
4. **Flights F3: GPS Save First end-to-end**, honor previously frozen owner priority in Draft #404, preserve distinct Manual mode and existing G1/G2/G3 decisions; dedicated synthetic upload→review→Save draft / Save & certify→saved flight and GPS provenance, then owner-approved small fixes. Because this is a safety-sensitive workflow, invite independent read-only AI review before substantive flow redesign.

**Priority conflict to resolve before implementation:** the owner previously prioritized GPS Save First, but the present request is a broad Flights audit. Keep GPS-first as roadmap priority unless owner explicitly authorizes beginning with F0 small list correctness before returning to GPS. A docs-only proposal is not such authorization.

## Evidence matrix / boundaries

| Gate | Result |
| --- | --- |
| GitHub main SHA and repository documents | **PASS: inspected**, source 5a51a214016a5815851b875a395bb12a36efc207 |
| Latest merged Apple Design 17-area playbook + UI / integrity / regulatory / DB / QA skills | **PASS: read** |
| Flights source + SQL, detail/new flows, CSS import order, existing tests, historic open PR scopes | **PASS: inspected** |
| Live authenticated Flights screenshot / DOM / computed CSS | **NOT RUN** |
| `npm run audit:design` source heuristic, `npm test`, typecheck, build, owned PG16/large-fixture, Playwright desktop/tablet/mobile | **NOT RUN** for this audit |
| Native Safari/iPad/VoiceOver, actual production flight-data integrity | **NOT RUN / UNKNOWN** |
| Code changes | **N/A** — docs-only |
| DB migration / production feature flags / Vercel deployment / main merge | **NONE**; not authorized |

**ONE NEXT STEP:** owner reviews these ranked findings and confirms first implementation milestone/priority (GPS Save First versus F0 list correctness). Then update ROADMAP on an isolated scoped implementation branch, perform read-only independent review where risk warrants it, implement the smallest batch, run exact-SHA risk-selected verification, request separate merge/deploy approval.
