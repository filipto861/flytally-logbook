# FlyTally changelog

This is the canonical record of **what actually changed** in `flytally-logbook`.

- `ROADMAP.md` is forward-looking and may contain planned work.
- `FEATURES.md` is the capability inventory.
- This file records merged/product changes and must not describe planned work as completed.
- Historical PR/version labels are preserved even where old release numbering was inconsistent with package metadata.
- From 4 October 2026 forward, canonical product releases use numeric `MAJOR.MINOR.PATCH`; see `docs/product/VERSIONING.md`.

## Unreleased

### Development / verification governance
- Added the 3.6.0 Phase 0 engineering-quality gate before any saved-date/timezone runtime implementation.
- Recorded and independently reviewed the current test/development audit, including the suite-wide PostgreSQL silent-skip exposure, test-scope registry drift, browser-runner reproducibility, browser-suite ownership and stale Git/PR hygiene.
- Started Phase 0A hardening: explicitly invoked PostgreSQL acceptance now owns the integration-test flag, rejects malformed or non-localhost database targets, preflights a real connection before test fanout, and supports an explicit `FLYTALLY_PSQL` path that is propagated to PostgreSQL/browser child processes when the client is installed outside `PATH`.
- Pinned Playwright Test 1.55.0 in repository dependencies, added an explicit authenticated browser gate, removed the ad-hoc manual-workflow runner install, and execute the pinned Playwright CLI directly through Node instead of a platform command wrapper.
- Hardened authenticated browser acceptance against current product contracts: certified test-fixture cleanup is local-only and transaction-scoped, GPS tests explicitly reopen auto-collapsing review sections and use the current first-split control before interaction, and obsolete pre-3.5.2 Night-definition browser expectations were replaced with the frozen always-on GPS/SERA behavior.
- Aligned the development/manual-workflow Node line to the production Vercel project's Node 24.x runtime.
- Corrected the browser PostgreSQL bootstrap timeout variable to `PGCONNECT_TIMEOUT`.
- Phase 0A gate-safety/reproducibility is verified locally: targeted governance **32/32 PASS**, PostgreSQL core **86/86 PASS**, PostgreSQL full **99/99 PASS**, TypeScript **PASS**, production build **PASS (41/41 static pages)**, authenticated browser acceptance **96 PASS / 2 intentional skips / 0 failed**, and the final corrected historical v1.44 source contract **5/5 PASS** after the preceding full suite proved the other 1,316 tests.
- Runtime product behavior is unchanged by this engineering-infrastructure work; FEATURES remains unchanged. Phase 0B risk-model / deterministic-selection work is now active.
- Phase 0B.1 registry convergence is verified: development risk/gate metadata and named targeted test groups share one v2 registry, CSS is UI/presentation instead of documentation, unknown runtime no longer invents PostgreSQL risk, and `test:ui` delegates to the registry-backed group runner rather than duplicating its 16-file list in package scripts. Verification: UI group **113/113 PASS**, TypeScript **PASS**, production build **PASS (41/41 static pages)**, full suite **1322/1323 PASS** with one stale documentation assertion, followed by the corrected development-pipeline file **12/12 PASS**.
- Phase 0B.2 stable ownership is verified: the audited 381-file app/components/lib runtime surface has **368 stable-owned files (96.6%)**, up from **121 (31.8%)**; the remaining **13** reviewed cross-cutting files are explicitly `shared-runtime` rather than guessed into a product domain. Verification: targeted scope/pipeline **28/28 PASS**, TypeScript **PASS**.
- Phase 0B.3 command convergence is verified: PostgreSQL scale-suite membership is single-sourced in the development registry, manual-cloud targeted verification executes the generic registry-backed `ui-contract` group, and DEVELOPMENT defines `scope:changed` as a planner with independent targeted/full/PostgreSQL/scale/browser/build gates. Verification: targeted scope/pipeline **29/29 PASS**, TypeScript **PASS**. Phase 0B is complete; Phase 0C browser-suite structure discovery/design is active.
- Phase 0C discovery inventoried the current authenticated browser architecture before refactor: the main spec is 2,053 lines/~127.6 kB with 48 logical tests and 25 browser-DB helper imports; two device projects still intentionally serialize through one mutable isolated PostgreSQL fixture. Draft 0C sequencing keeps one worker, splits helpers/spec ownership first, then removes only proven redundant device-project execution for tests that already own their viewport/theme matrices.
- Independent Phase 0C review returned **ACCEPT WITH CHANGES**. The reconciled plan adds a machine-checkable 0C.0 baseline, makes helper extraction deliberately minimal, keeps browser DB ownership centralized, splits into seven modest domains with full browser acceptance after each split batch, treats project×matrix deduplication as the highest-risk step, and keeps per-worker DB isolation out of scope.
- Added and verified the 0C.0 browser-suite baseline and structure contract: exact 48 logical test names, two-project/one-worker/retry invariants, centralized browser DB helper exports/fixture IDs/users, and required responsive/theme states. Verification: targeted structure/scope/pipeline **34/34 PASS**, TypeScript **PASS**.
- Phase 0C.1 minimal helper extraction is verified: only `expectNoHorizontalOverflow` and `loginBrowserPilot` moved into `e2e/browser-actions.mjs`; GPS/details/RoleCrew/request-hold helpers remain local, no tests moved, and browser DB/project/worker/retry behavior is unchanged. Verification: targeted structure/scope/pipeline **35/35 PASS**, TypeScript **PASS**, full authenticated browser **96 PASS / 2 intentional skips / 0 failed** in **4.9m**.
- Phase 0C.2 Batch 1 is verified: the four settings/connections mutation tests live in `e2e/settings-connections-mutations.spec.mjs` with unchanged names/assertions/fixture IDs. Verification: targeted structure/scope/pipeline **36/36 PASS**, TypeScript **PASS**, focused spec **8/8 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **4.8m**.
- Phase 0C.2 Batch 2 is verified: seven E1/Night/SERA advisory tests live in `e2e/advisory-presentation.spec.mjs`. Verification: targeted structure/scope/pipeline **37/37 PASS**, TypeScript **PASS**, focused advisory **14/14 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **4.7m**. The run again logged Windows/PostgreSQL shared-memory reservation warnings without a failing browser/persistence assertion; retain as a local-environment watch item if future failures correlate.
- Phase 0C.2 Batch 3 is verified: five Manual RoleCrew / verification / Safety Pilot PIC tests live in `e2e/manual-rolecrew-verification.spec.mjs` with unchanged names/assertions and centralized browser DB fixtures. Verification: targeted structure/scope/pipeline **38/38 PASS**, TypeScript **PASS**, focused spec **10/10 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **5.0m**. The recurring Windows/PostgreSQL shared-memory warning remains a local-environment watch item because it did not coincide with a failing assertion.
- Phase 0C.2 Batch 4 is verified: eight Manual aircraft-authority/certification tests live in `e2e/manual-authority-certification.spec.mjs` with unchanged names/assertions. Verification: targeted structure/scope/pipeline **39/39 PASS**, TypeScript **PASS**, focused spec **16/16 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **4.8m**.
- Phase 0C.2 Batch 5 is verified: nine broad responsive/theme matrix tests live in `e2e/responsive-presentation.spec.mjs` with unchanged names/assertions and F6 viewport/theme state labels. Verification: targeted structure/scope/pipeline **40/40 PASS**, TypeScript **PASS**, focused responsive spec **18/18 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **12.0m** on the second local PC. Its initial all-login failure was traced to missing local `SESSION_SECRET`, not a test assertion regression.
- Phase 0C.2 Batch 6 is verified: ten GPS functional acceptance tests and their GPS-only interaction helpers live in `e2e/gps-rolecrew.spec.mjs`; `e2e/public-shell.spec.mjs` contains exactly five public/auth/shell tests and no direct browser-DB/GPS helper ownership. Verification: targeted structure/scope/pipeline **41/41 PASS**, TypeScript **PASS**, focused GPS / RoleCrew **20/20 PASS** across both projects, full browser **96 PASS / 2 intentional skips / 0 failed** in **11.8m**. Phase 0C.2 domain splitting is complete.
- Started Phase 0C.2a helper-ownership reconciliation: generic `expectAuthenticatedRoute`, `ensureDetailsOpen`, and `holdPost` now have one shared home in `e2e/browser-actions.mjs`; shared GPS interaction helpers now live in domain-scoped `e2e/gps-actions.mjs`; local duplicates were removed from the consuming specs while presentation/shell-only helpers remain local. Source inventory remains **48 unique logical acceptance tests**. Verification is pending.
- Corrected the first 0C.2a candidate after focused Playwright discovery exposed a syntax-invalid stale `completeF43GpsPart` body tail in the GPS and responsive specs. Removed both tails and added a structure-gate `node --check` sweep for every `e2e/*.mjs` module so syntax-invalid browser modules fail before Playwright. Verification remains pending on the corrected head.
- Phase 0C.2a is verified on the corrected head: targeted structure/scope/pipeline **43/43 PASS** (including syntax checks for every `e2e/*.mjs`), TypeScript **PASS**, focused GPS **20/20 PASS**, focused responsive **18/18 PASS**, and full browser **96 PASS / 2 intentional skips / 0 failed** in **11.4m**.
- Started Phase 0C.3 proof-driven project×matrix deduplication: only four F6 tests that each own the complete viewport/theme matrix are tagged `@self-managed-presentation` and excluded from the Pixel 7 project via `grepInvert`; five narrower responsive tests retain both projects. Candidate keeps all 48 logical tests and targets 94 total full-gate executions instead of 98. Verification is pending.
- Phase 0C.3 is verified: targeted structure/scope/pipeline **44/44 PASS**, TypeScript **PASS**, focused responsive **14/14 PASS**, and full serialized browser acceptance with explicit retries=0 **92 PASS / 2 intentional skips / 0 failed** across **94 executions** in **10.3m**.
- Phase 0C.4 final acceptance is complete: all **48 unique logical browser tests** remain, fixture/reset identities and centralized `browser-db.mjs` are preserved, workers=1 remains, required presentation states remain evidenced, no product runtime/timezone/schema behavior changed, and per-worker DB isolation remains out of scope. Phase 0C is closed.
- Phase 0D independent review returned **ACCEPT WITH CHANGES**. The reconciled design keeps one development registry, separates risk/gate/evidence semantics, keeps build outside behavioral evidence, treats the full Node suite as aggregate regression only, and keeps `scope:changed` planner-only rather than fabricating observed test results.
- Started the Phase 0D evidence-taxonomy candidate: `development-modules.json` is schema v3 with four behavioral evidence classes; named `ui-contract` and `development-pipeline` groups are explicitly homogeneous application/source-contract groups; a JSON Schema contract and fail-closed evidence evaluator were added; `scope:changed` now reports required evidence, aggregate gates and build independently.
- Added negative evidence-contract regressions so source-contract PASS, aggregate `fullTests` PASS and build PASS cannot masquerade as domain/PostgreSQL/browser acceptance; required missing evidence reports NOT RUN, raw acceptance skips/retries prevent PASS, and explicit N/A cases remain distinguishable from skipped execution. Phase 0D verification is pending; no product runtime, DB schema, browser fixture architecture or timezone semantics changed.
- Phase 0D first full regression run exposed **14 stale source-contract assertions** left behind by the verified Phase 0C browser-spec split: the assertions still read `e2e/public-shell.spec.mjs` even though the covered browser behavior had moved to domain specs/helpers. The run itself was **1340/1354 PASS, 14 FAIL**; all failures were source-location drift, not browser/runtime execution failures. Retargeted those historical assertions to `browser-actions.mjs`, `settings-connections-mutations.spec.mjs`, `manual-rolecrew-verification.spec.mjs`, `manual-authority-certification.spec.mjs`, `responsive-presentation.spec.mjs`, and `advisory-presentation.spec.mjs`.
- Closed Phase 0D after correction verification on exact code head `686734911f5c3f45e395fdda6b7d98a5021e84ae`: development-pipeline **65/65 PASS**, TypeScript **PASS**, aggregate regression **1354/1354 PASS**, and production build **PASS** with **41/41** static pages. `domain-unit`, PostgreSQL acceptance and browser acceptance are **N/A** for this tooling/source-contract candidate under the frozen evidence taxonomy. Phase 0E canonical verification commands is now active.
- Started Phase 0E.1 canonical planner implementation: added explicit candidate-source parsing, content-aware candidate fingerprints, JSON/human `verify:plan` output, explicit planner `typecheck` selection, `--force-all` gate forcing without candidate expansion, and dedicated planner contract tests.
- Closed Phase 0E.1 after local exact-head verification on `34146fdc2cf8dc7645acfb1aea9de66078cd430a`: development-pipeline **72/72 PASS**, TypeScript **PASS**, aggregate regression **1361/1361 PASS**, production build **PASS (41/41 static pages)**, and canonical planner JSON smoke **PASS**. Phase 0E.2 available direct domain evidence is now active.
- Started Phase 0E.2: registered exact reviewed direct `domain-unit` evidence for all **10/10** current domain-risk modules, added pure aircraft-profile and professional-experience direct suites, added registry schema/selection enforcement, and extended `verify:plan` with module-scoped direct-domain tests plus fail-closed blocked-evidence reporting.
- Closed Phase 0E.2 after local exact-head verification on `3227bb587cd89a1d4d93cb8396b7a0388ebe4dc5`: development-pipeline **75/75 PASS**, dedicated direct-domain candidate **6/6 PASS**, TypeScript **PASS**, aggregate regression **1370/1370 PASS**, production build **PASS (41/41 static pages)**, and canonical direct-domain planner smoke **PASS** with no blocked evidence. Phase 0E.3 evidence ledger / canonical gate wrappers is now active.
- Started Phase 0E.3: added ignored candidate-bound verification ledgers; canonical `verify:app`, `verify:domain`, `verify:postgres`, browser-only `verify:browser`, and compatibility `verify:browser:with-build`; same-candidate Next build freshness enforcement; explicit browser N/A classification for the audit-capture exclusion; and registry risk mapping for the new PostgreSQL/browser harness wrappers. Verification is pending.
- First 0E.3 local verification attempt exposed two development-contract defects before heavy acceptance: one overly strict browser source assertion and TypeScript declaration errors caused by static `.mjs` imports in the new ledger test. Corrected both without product runtime changes and added a no-argument compatibility wrapper for legacy `npm run verify`; correction verification is pending.
- Corrected 0E.3 verification then passed development-pipeline **83/83**, TypeScript, aggregate regression **1378/1378**, production build **41/41**, and PostgreSQL full acceptance **99/99**. Full browser acceptance remained **FAIL** at **90 PASS / 2 FAIL / 2 intentional skips** (11.6 min); both failures were mobile-only and require focused reproduction before any test/runtime correction. Phase 0E.3 remains open.
- Focused mobile reruns of both browser failures passed independently with retries disabled. Added test-only synchronization hardening: explicit bounded post-save navigation wait for the GPS server action, and completion-state wait plus summary-scoped persistence assertions for Connection access. Full browser rerun is still required before 0E.3 can close.
- The synchronization correction passed a **6/6** targeted mobile repeat. `verify:app` remained green at **1378/1378** regression tests plus **41/41** build pages. The next full browser gate improved to **91 PASS / 1 FAIL / 2 intentional skips**; only the mobile F3.5 Quick Add status wait timed out. 0E.3 remains open and the next step is focused Quick Add reproduction, not another full matrix run.
- Isolated mobile F3.5 Quick Add then passed **5/5** with retries disabled, confirming suite-load timing. Hardened that browser test only: wait for the successful Quick Add dialog close and success notice with a bounded 15 s server-action window before proceeding. Product runtime remains unchanged.
- Product decision: the ~12-minute full 94-test browser matrix is removed from the normal development/Phase-0 closeout path. It remains available as a manual diagnostic, but targeted risk-owned browser checks will become the normal evidence path in 0E.4. 0E.3 requires only the cheap targeted Quick Add correction repeat; no unrun full-browser PASS will be claimed.
- Closed Phase 0E.3 after final targeted Quick Add correction **5/5 PASS** at retries=0/workers=1. Final 0E.3 evidence: development-pipeline **83/83 PASS**, planner PASS, direct-domain N/A for the tooling candidate, `verify:app` PASS with **1378/1378** aggregate regression + **41/41** build pages, PostgreSQL full **99/99 PASS**, and targeted browser correction evidence **11/11 PASS** across GPS, Connections and Quick Add. The legacy full browser matrix is **NOT RUN** after the policy change. Phase 0E.4 fast iteration / risk-based release orchestration is now active.
- Drafted the Phase 0E.4 fast-verification architecture: explicit registry-owned browser targets, fail-closed target selection, candidate-scoped `browser-risk` evidence, `verify:iterate`, exact-ledger reuse, risk-based `verify:release`, and preservation of the 94-test full browser command as manual diagnostics only. Implementation is pending independent review; no runtime/schema/timezone behavior changed.
- Phase 0E.4 independent review returned **ACCEPT WITH CHANGES**. Reconciled the design to keep legacy `verify:release` semantics unchanged, introduce `verify:release:risk`, machine-enforce browser-risk authority and exact selection/config/build/tool/fixture identity, fail closed on missing/stale/ambiguous browser ownership, and harden dirty/untracked candidate identity. 0E.4a implementation is active.
- Implemented the 0E.4a planning candidate: verification candidate/ledger schema v2 with dirty/untracked worktree identity; deterministic config/toolchain/browser-fixture contract hashes; registry schema for **41** exact risk-scoped browser targets; fail-closed browser target validation/selection and selection hashing; planner schema v2 browser-evidence output; and the correction that browser-required plans also require a production build artifact. Verification is pending; no new browser executor or release command is active yet.
- First 0E.4a local verification passed development-pipeline **91/91**, aggregate regression **1386/1386**, TypeScript and build **41/41**, but exposed generated local `test-results` / scale-evidence files as untracked candidate members. Added explicit ignores plus a regression test so generated verification artifacts no longer contaminate candidate identity. Final exact-head verification then passed at `4b14f34585f8d1653112e964ed4043c444dfe655`: clean worktree, development-pipeline **92/92**, aggregate regression **1387/1387**, TypeScript and build **41/41**, with planner candidate identity free of generated artifacts. 0E.4a is DONE / VERIFIED.
- Started 0E.4b fast iteration implementation: canonical source-contract execution/ledger, TypeScript ledger, exact candidate/config/toolchain reuse contract, planner source-evidence ownership and a separate `verify:iterate` command. Release/browser semantics remain unchanged; verification pending.
- 0E.4b candidate now runs/reuses only the cheap planner-selected source/domain/typecheck evidence and explicitly reports heavy aggregate/build/PostgreSQL/browser work as release **NOT EVALUATED**. Added `--rerun`, reserved/rejected `--with-browser` until 0E.4c, regression coverage for exact reuse/N/A reuse/docs-only iteration, and preserved the legacy `verify:release` command unchanged.

### Print / PDF
- Hid the keyboard accessibility `Skip to content` link from printed logbook and Save-as-PDF output while preserving it in the interactive app.
- Added a source regression guard so the accessibility link cannot silently reappear in print output.

## 3.5.5 — 7 October 2026

### iPad sidebar collapse-control alignment
- Reworked the coarse-pointer collapse chevron into a dedicated 44 px sidebar-edge handle, separate from the logo and notification controls.
- Centers the handle vertically in the viewport and tracks the expanded/collapsed sidebar width so it stays attached to the rail in both states.
- The first production placement from PR #252 was visually rejected on iPad and intentionally superseded rather than treated as accepted.
- Corrective exact-head local gate before the final production fix: targeted **17/17 PASS**, TypeScript **PASS**, full unit/regression **1308/1308 PASS**, production build **PASS** with 41/41 static pages.
- PR #253 squash-merged to `main` as `ec75388ab437218086ef4fb86d1d53648fb77dbe`; Vercel production deployment `dpl_4NbxFjAa6dJyQn1VdiSwf4wndiUW` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the immediate runtime-error window was clean.
- Production iPad visual acceptance confirmed the final centered edge-handle placement is accepted.
- Scope is presentation-only: sidebar state, notifications, routes and mobile navigation semantics are unchanged.
- PostgreSQL migration **N/A**; schema remains v20, certification payload v8 and portable backup v13.

## 3.5.4 — 7 October 2026

### iPad flight-detail visual hotfix
- Keeps Back / Previous / Next / More together on wider iPad/desktop flight-detail headers instead of allowing only **More** to wrap onto a second line.
- Reflows the whole flight-detail header navigation below the flight identity on narrower tablet widths.
- Fully hides the keyboard **Skip to content** link until focus so its focus-colored border cannot leak into the iPad safe area.
- Final local gate: targeted **21/21 PASS**, TypeScript **PASS**, full unit/regression **1305/1305 PASS**, production build **PASS** with 41/41 static pages.
- PR #251 squash-merged to `main` as `8ed7567ca3f1f2ffb2834ecca0f29359bbd330c6`; Vercel production deployment `dpl_BceR2z3B27eXwnFuNzDL3AugQNjc` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the immediate runtime-error window was clean.
- Production iPad visual acceptance confirmed the two targeted defects are resolved.
- PostgreSQL migration **N/A**; schema remains v20, certification payload v8 and portable backup v13.

## 3.5.3 — 7 October 2026

### Flight detail navigation UX
- Reworked the existing flight-detail navigation into an obvious **Back to flights** control plus explicit **Previous flight** / **Next flight** controls.
- Previous/Next continue to use the existing filter-aware server navigation and preserve the active Flights query context.
- Boundary directions remain visible but disabled instead of disappearing, keeping the navigation layout stable.
- Mobile gives Back its own row and keeps Previous/Next in a two-column row without horizontal core-navigation scrolling.
- Final pre-merge local gate: targeted **18/18 PASS**, TypeScript **PASS**, full unit/regression **1302/1302 PASS**, production build **PASS** with 41/41 static pages.
- PR #250 squash-merged to `main` as `7068c5f03a3bf5b05ef5f0b45793db54848b9c9e`; Vercel production deployment `dpl_5w2vFSXpSbVEruqcP8mzjXRLuqag` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the immediate runtime-error window was clean.
- PostgreSQL migration **N/A**; schema remains v20, certification payload v8 and portable backup v13.
- Post-deploy iPad visual review found two presentation-only defects (More wrapping and a hidden skip-link safe-area border fragment); corrective scope is isolated in 3.5.4.

## 3.5.2 — 7 October 2026

### Always-on GPS/SERA Night suggestions
- Removed the account-level **Night definition** selector from Settings; GPS/SERA Night suggestion behavior is no longer user-toggleable.
- GPS import now attempts the existing SERA Day/Night landing split and conservative Night-time suggestion automatically whenever the canonical flight context supports those fields.
- Preserved the existing civil-twilight calculation and fail-closed evidence contract: -6° geometric boundary, ±0.5° confidence guard, explicit UTC/offset evidence, sparse-gap/track-integrity rejection, sticky pilot edits and manual fallback when exact GPS evidence is unavailable.
- IFR remains manual. Legacy stored `night_definition` values are ignored by active flight-entry behavior; no DB migration, certification-payload change or historical-flight rewrite was introduced.
- Added/reconciled source regression coverage for the removed Settings switch, always-on applicability gating and sticky manual Day/Night/Night-time edits.
- Final exact-head local verification: targeted 3.5.2 / 3.4.1 / E2 GPS contract **24/24 PASS**, TypeScript **PASS**, full unit/regression **1298/1298 PASS**, production build **PASS** with 41/41 static pages.
- PR #248 squash-merged to `main` as `60be6fd23f283302dadc7a3d611a19ff0bc8ebf3`; Vercel production deployment `dpl_4pyJEv2pjWQLNcmNPpFYcjsf3PHj` reached READY on that exact SHA, root/login smoke returned HTTP 200, and the checked immediate runtime-error window was clean.
- PostgreSQL migration **N/A**; production schema remains v20, certification payload v8 and portable backup v13.

## 3.5.1 — 7 October 2026

### GPS touch-and-go reliability
- Tightened advisory GPS touch-and-go inference against three reproduced real-track false positives without adding a new auto-counted T&G path.
- Rolling-altitude T&G now requires post-minimum climb evidence beyond a single timed altitude edge; the existing 28–145 km/h rolling-speed range, 30 m altitude evidence and 25 m/s gross-discontinuity guard remain unchanged.
- Short speed/ground events are no longer accepted as T&G when direct event motion exceeds the existing 145 km/h rolling ceiling or usable altitude changes by at least 30 m during the alleged ground interval.
- Takeoff inference, shared ground-stop split detection, the public T&G DTO, database schema, certification data and historical flights are unchanged.
- Added anonymized real-derived regressions for the level-shift false event, climb-out sawtooth false event and duplicate/stale-fix false HIGH event, plus positive controls for five rolling T&Gs and a genuine stop-and-go.
- The separate real T&G missed near 15:59 remains intentionally non-auto-counted: new evidence proves the current ±10-array-point qualification window is defective, but that event also crosses gross-corrupt approach altitude evidence. Time-normalized qualification and an evidence-limited non-counted review tier remain separate unnumbered research rather than weakening fail-closed behavior.
- Local isolated verification on the feature branch: targeted 3.5.1 **6/6 PASS**, focused GPS/track corpus **62/62 PASS**, full unit/regression **1297/1297 PASS**, TypeScript **PASS**, production build **PASS** with 41/41 static pages. PostgreSQL and browser acceptance are **N/A / NOT RUN** for this pure track-inference change; no DB or UI runtime contract changed.
- PR #245 merged to `main` as `230d835a9e4c3fddb02bf7b729242632626cb9a7`; Vercel production deployment `dpl_AGLoght4FF1khhviPaZvMu5SZ2oT` is READY on that exact SHA, carries `fly-tally.com`, returned HTTP 200 on the root/login smoke surface, and had no grouped runtime errors in the checked post-deploy window.


## 3.5.0 — 7 October 2026

### Certified flight voiding + multi-aircraft integrity
- Certified flight voiding: owners can remove an incorrectly certified flight from active-logbook use while preserving immutable certification and audit evidence.
- Permanent void audit: the original certified snapshot, certification fingerprint and revisions, verification evidence, void actor/time and mandatory reason are retained.
- Collaboration safety: public shares are revoked, pending source workflows are superseded, and independently owned participant copies remain intact with permanent source provenance.
- Backup/restore v13: protected void and provenance history is portable as authenticated history-only evidence and cannot silently resurrect an active certified flight.
- Multi-aircraft integrity audit: historical regulatory facts remain flight-snapshot authoritative; production census found no malformed or legacy Part-FCL override state requiring a runtime compatibility layer.
- Database schema v20: permanent void archive/provenance protections were deployed with preflight, recovery branch, reconciliation and postflight verification.
- Production verification: final local gate passed 1289/1289 unit/regression and 99/99 PostgreSQL integration+scale; authenticated certified-voiding acceptance passed desktop/mobile 2/2; production deployment reached READY and immediate runtime-error check is clear.

### Detailed implementation record
- Froze the archive+delete model after independent review: certified flights will be removable from all active logbook consumers while permanent certification/audit evidence remains.
- Started schema v20 with a permanent certified-void tombstone, protected revision/verification archive tables, typed dependent-evidence archive rows, accepted participant-copy provenance, same-transaction certified DELETE authorization and active/tombstone coexistence protection.
- Added source-level and PostgreSQL acceptance coverage for migration v20, archive immutability, participant provenance, direct-delete rejection, same-transaction deletion and certified-correction compatibility.
- Repository reconciliation corrected the portable-backup baseline: current exports are v12 with server authenticity; certified-void archive support is therefore reserved for portable backup v13.
- M2 now includes the canonical authenticated atomic void mutation: exact-row optimistic locking, permanent evidence archiving, pending workflow supersession, public-share revocation, participant-copy provenance binding, active revision/track removal, final evidence-count-gated flight deletion, recency refresh and active-view invalidation.
- Shared-flight materialization now persists source provenance before an accepted participant copy is linked.
- Added the certified-flight removal UX and dedicated immutable void-audit route, including mandatory reason, duplicate-submit protection, active-logbook exclusion warning, success-to-audit link, and legacy audit-link fallback.
- Added authenticated browser acceptance that creates and certifies a real test flight, removes it via the UI, verifies active-logbook disappearance and permanent tombstone/audit retention, and runs in both desktop and mobile Chromium.
- First browser execution correctly exposed an unsupported `track_points` assumption in the new void service. FlyTally has no such canonical table; GPS evidence is stored completely on `flight_tracks`, so the runtime/schema/tests were corrected to archive only the real persisted source.
- Second browser execution reached the real void flow without the prior database exception but did not leave the current flight-detail URL. Completion is now redirected server-side after successful mutation, and the browser test proves database deletion/tombstone creation before checking navigation.
- Third browser execution exposed a test sequencing race: the test read PostgreSQL before the asynchronous Server Action had an authoritative completion state. It now waits for server redirect or a surfaced action error before asserting database state.
- Fourth browser execution showed the mobile void path reached successful deletion/tombstone/redirect assertions; remaining failures were caused by a transient certification-banner dependency on desktop and a broad date/registration list selector that matched the failed desktop fixture. The acceptance test now uses durable certified state and exact flight-id disappearance.
- Final M2/M3 browser acceptance passed **2/2** across desktop and mobile Chromium, proving certified-flight removal, active-row exclusion, permanent tombstone/audit retention and legacy-audit redirect end to end.
- Portable backup format v13 is implemented pending verification: signed backups include permanent void/provenance history, exact restore is history-only and conflict-guarded, legacy v4–v12 `track_points` remains parser-compatible without current-schema queries, and participant source provenance is append-only.
- Backup v13 implementation is present and awaits verification; schema v20 is **not applied to production**.
- First M4 verification run failed on typed recovery-conflict wiring and stale test assumptions; these were corrected on the feature branch.
- Second M4 gate on `25d73e6`: TypeScript PASS and production build PASS; unit/regression was **1259/1273 PASS** with 14 failures traced to historical source-contract drift plus one Node direct-import alias in `void-evidence.ts`. PostgreSQL did **not execute** because the shell had no `DATABASE_URL` (all 93 integration cases failed setup). Follow-up corrections update historical assertions to v13/schema-v20/current-roadmap semantics, keep legacy `track_points` parser compatibility explicit, and make the void-evidence helper directly Node-testable.
- Third M4 gate on `e311a4e`: TypeScript PASS; unit/regression **1280/1280 PASS**; production build PASS. PostgreSQL core executed after restoring local `psql` access and reached **82/85 PASS**. The three failures were acceptance-fixture drift: the certification fixture loaded the v20 protection function without creating its referenced `voided_certified_flights` table, while the E2 migration-19 helper accidentally parsed migration 20 blocks because its end marker still targeted the global `throw`. Follow-up fixes make both fixtures version-bounded without weakening runtime contracts.
- Final M4 PostgreSQL rerun on `7d18fb9`: TypeScript **PASS** and PostgreSQL core **85/85 PASS**. All v13 history-restore, archive immutability, resurrection/conflict, certified-delete, migration-19, participant-provenance and correction-compatibility acceptance cases passed. Because `7d18fb9` changed only PostgreSQL acceptance fixtures and documentation after the `e311a4e` runtime gate, the existing **1280/1280 unit/regression PASS** and production build PASS remain the runtime-code evidence for M4. M4 is therefore **VERIFIED LOCAL**. No production migration/deploy occurred.
- M5A consumer audit found that workflow notification rows outlive source participation/approval rows by design. Certified voiding now prevents stale inbox links: owner notifications that pointed at the removed source flight/audit are redirected to the permanent void-audit route, and recipient `/connections/shared/*` / `/connections/flight/*` links tied to the removed source are cleared before cascade. Notification text/history remains intact and is not promoted to protected certification evidence.
- M5A verification on exact head `bb3fcd2`: TypeScript **PASS**; targeted consumer/domain contract **13/13 PASS**; full unit/regression **1285/1285 PASS**; production build **PASS**. M5A is **VERIFIED LOCAL**.
- M5B adds isolated PostgreSQL collaboration acceptance proving that a void transaction can archive live collaboration evidence, supersede pending work, revoke the public share, redirect/neutralize notification links before cascade, preserve an accepted participant-owned flight, bind its immutable provenance to the tombstone, and remove the source-side live workflow rows.
- M5B verification on exact head `efd9b62`: PostgreSQL core **86/86 PASS**, including the new collaboration teardown acceptance. M5B is **VERIFIED LOCAL**.
- M5C extends the existing authenticated desktop/mobile certified-void browser acceptance: after void, the source is absent from the active flight list, the permanent audit remains reachable, the legacy active-flight audit URL redirects to that audit, and retained owner notification history opens the permanent audit instead of a dead source-flight route.
- M5C browser execution reached the actual certified-void flow. An initial fully configured run passed desktop and exposed only a serialized test-notification collision on mobile; the fixture was isolated without changing runtime behavior. Final rerun on exact head `a423239` passed **2/2** across desktop and mobile Chromium, including certified removal, active-logbook exclusion, permanent audit retention, legacy audit redirect, and retained owner-notification navigation to the permanent audit. M5 is **VERIFIED LOCAL**.
- Phase 1 M6 local release gate on exact head `a2d3f65` is green: TypeScript PASS; full unit/regression **1285/1285 PASS**; full PostgreSQL integration + retained scale fixtures **99/99 PASS**; production Next.js build PASS. GitHub CI is **NOT RUN — local-first policy**. No production migration or deployment occurred; `3.5.0` remains unreleased while Phase 2 of the canonical combined scope proceeds.
- Phase 2 discovery found that historical regulatory category/class/type consumers are already flight-snapshot based; the remaining deliberate current-profile dependency is the effective-dated Annex-I/ULL `part_fcl_credit_class/basis/from` tuple used by aeroplane recency and its evidence audit. The current profile validator requires complete provenance, while the evaluator still accepts older class-only metadata; this compatibility boundary is frozen for independent review before runtime changes.
- Added a characterization-only Phase 2 suite that freezes the consumer census, Manual/GPS PROFILE + SNAPSHOT boundaries, and the legacy class-only explicit-credit behavior before any regulatory runtime change. Initial suite **4/4 PASS** on exact head `69310a3`.
- Independent review accepted the snapshot/external-applicability split and the default no-migration/no-certification-change direction, but correctly required a bounded compatibility rule before legacy eligibility is widened. Repository-history reconciliation then found an important correction to the review handoff: v1.51.3 UI/engine copy described override basis/from as optional, but the server-side Aircraft Add/Edit action still required both whenever an explicit class was persisted. Exact restore remained intentionally outside current profile validation. An unverified draft compatibility batch was therefore superseded before local verification and runtime returned to the verified `69310a3` characterization state.
- Phase 2 production census completed read-only on the production Primary branch / `neondb`: **25 aircraft profiles, all `NONE`**, 25 active / 0 inactive, 295 saved flights and 36 certified ULL flights; zero complete overrides, partial tuples, orphan metadata, invalid dates or invalid classes. Production schema remains **v19**. Decision: no Phase 2 runtime compatibility layer, no schema v21 and no certification-version change. The census tooling was corrected after its first operator run exposed a malformed SQL regex literal; the corrected query was executed successfully before documenting the result.
- Canonical 3.5 final local gate on exact head `f0a1f1a` passed: TypeScript PASS; unit/regression **1289/1289 PASS**; full PostgreSQL integration + scale **99/99 PASS**; production build PASS. GitHub CI is **NOT RUN — local-first policy**.
- Added explicit v20 production deployment tooling: strict read-only v19 preflight, transactionally locked migration mirroring the runtime v20 DDL, idempotent post-deploy participant-provenance reconciliation to close the old-runtime/deploy window, and read-only v20 postflight verification. Tooling source verification on `eddbfb5` is **10/10 PASS** with TypeScript PASS; no production write has been performed.
- Reconciled the unreleased candidate package/app-visible version to **3.5.0** in `package.json` and `package-lock.json`, consistent with the canonical versioning policy. Candidate metadata verification on exact head `c0daa46` is **5/5 PASS** and production build PASS with 41/41 static pages generated.
- Production v20 preflight completed **read-only** on 7 October 2026 against Primary/`neondb`: transaction read-only ON; exact registry v1..v19; no partial v20 objects; 295 flights / 95 certified flights / 56 certified revisions; 16 participations / 11 accepted; **7** clean provenance backfill candidates; all preflight integrity guards passed.
- After explicit approval, created pre-migration Neon branch `pre-v20-2026-10-07` (`br-dry-moon-b1n30x0b`) at the production pre-write LSN, then applied the exact transactionally guarded schema-v20 migration to production. Immediate read-only postflight PASS: exact registry v1..v20; **7/7** participant provenance rows; 295 flights, 95 certified flights, 56 certified revisions, 5 verifications, 16 participations / 11 accepted, 8 deleted-flight rows; zero voided-flight/archive rows. Production app runtime is still 3.4.1; deploy, post-deploy provenance reconciliation, final postflight and smoke remain pending.


## 3.4.1 — 6 October 2026

### GPS Night-time reliability
- Opened a narrow production-correction follow-up after GPS review showed a NIGHT landing suggestion while Night time remained unavailable/manual.
- Added structured Night-time unavailable reasons and concise GPS-review explanation while preserving manual editable Night time and manual-only IFR.
- Reused the canonical GPS position-discontinuity thresholds from track processing rather than creating a second quality model.
- Final correctness review rejected the attempted >600 s same-state proof: endpoint displacement/quality does not prove the unobserved intermediate path. Sparse segments above the existing 600 s direct-interpolation guard therefore remain fail-closed with `SEGMENT_GAP_TOO_LARGE`.
- Hardened equal-time conflicting positions, non-monotonic/ambiguous timestamps, unsupported solar envelope and twilight-confidence cases to explicit fail-closed reasons.
- Added a real-like EHAM → LKPR regression that preserves the valid distinction between a confidently NIGHT landing event and unavailable exact Night time when an earlier sparse gap prevents a complete total; partial/lower-bound values are never auto-applied.
- Added the frozen single-phase contract at `docs/product/3_4_1_GPS_NIGHT_TIME_RELIABILITY.md`. No DB migration, certification-version change or historical-record rewrite is part of 3.4.1.
- Added authenticated browser coverage for the sparse-gap fallback: automatic Night time stays blank with an explicit reason, and a pilot-entered manual value remains sticky.
- Final local runtime candidate verification: TypeScript PASS, full unit/regression suite **1238/1238 PASS**, production Next.js build PASS, and targeted authenticated sparse-gap browser acceptance **2/2 PASS** across desktop and mobile Chromium.
- Release verification also reconciled stale repository contract tests with the already-adopted manual-only GitHub Actions policy, browser fixture schema v19, the compact 3.4 certification summary, and the 3.4.1 roadmap state; the manual Verify workflow is now self-contained instead of depending on pull-request event fields.
- PR #241 merged to `main` as `b3e1de097b6d16cdaa96082d281602a2765b8ae0`; production deployment `dpl_3911vZiDAFduLhsPbyMnB1YtHKwn` is READY on that exact SHA, carries `fly-tally.com`, returned HTTP 200 on the public smoke surface, and had no grouped runtime errors in the checked post-deploy window.

## 3.4.0 — 5 October 2026

### Flight Entry Simplification
- Local release verification now includes TypeScript PASS, 1230/1230 unit/regression PASS, 73/73 PostgreSQL core PASS, production build PASS, 13/13 targeted 3.4.0 contract PASS, 6/6 targeted authenticated desktop/mobile Playwright PASS, and a focused responsive Flight Entry smoke **1/1 PASS** covering desktop 1440, iPad landscape, iPad portrait and mobile 390 in light + dark. GitHub CI is intentionally NOT RUN under the local-first policy.
- Switched repository verification to local-first release gating; GitHub Verify and Browser Smoke are now manual-only diagnostics rather than automatic PR/release requirements.
- Simplified the GPS import hierarchy: clean single-flight track review collapses by default, multi-flight/ambiguous/warned track review stays surfaced, and redundant clean-quality status copy was removed.
- Reduced primary GPS Flight context to aircraft/regulatory basis/role/applicable operation-engine; Billing and Cost share now live in a separate collapsed Costs disclosure while invalid stored billing still blocks save.
- Replaced generic GPS reviewed-state UX with deterministic evidence readiness plus targeted GPS-quality acknowledgement; incomplete imports navigate to the first unresolved flight card.
- Multi-flight GPS remains draft-only and atomic; direct batch certification is not introduced by these changes.
- Added explicit same-page **Save draft** and **Save & certify flight** completion for eligible single Manual and GPS entries. Certification always re-reads the persisted row and reuses the existing v8 compliance/hash authority. Flight-detail readiness/blocker UI now uses that same category-aware certification compliance contract instead of the old Part-FCL-only blocker view.
- Added compact pre-certification summaries for the evidence being sealed, draft fallback messaging when certification is blocked/deferred, and draft-first implicit/Enter-key behavior. The completion summary was then flattened to four concise evidence groups instead of another nested card grid.
- Updated authenticated browser coverage for the removed generic GPS review checkbox and added direct Manual/GPS certification, Enter-to-draft, multi-flight draft-only, and targeted GPS-quality acknowledgement acceptance cases.

### Documentation / versioning governance
- Standardized future product releases and ROADMAP targets on numeric `MAJOR.MINOR.PATCH` versions; 3.4.0 is now the first canonical unified production release after the one-time reconciliation jump from 2.7.0.
- New implementation phases use numeric Phase 1 / Phase 2 / … naming rather than new E/F/B/SP/M milestone families.
- Database schema, certification payload and backup-format versions remain independent technical counters.
- Added the 3.4.0 design/review-reconciliation contract and numeric forward release sequence.
- PR #240 merged as `76b57c5674ffcc8c62bfbe73c59974cfde341a7a`; production deployment `dpl_3Zcyq7QmdSGPj1AcSHe2gj2Rn29r` is READY on that exact SHA and carries `fly-tally.com`.
- Post-deploy runtime logs show successful 200 responses across authenticated dashboard/flight routes, and the checked runtime-error window contained no grouped errors.
- Production DB remains schema v19 and certification payload remains v8; 3.4.0 introduced no schema migration or historical flight/certification rewrite.

## Legacy unversioned development / production history — through 4 October 2026

### Flight Entry E2 — production verified
- Hardened advisory take-off anomaly locality around corrupt GPS transitions while preserving discontinuity warnings and editable GPS-derived values.
- Added nullable aircraft `default_engine_type = SE | ME | NULL` with no historical backfill; unambiguous catalogue engine count may suggest a value but does not become authority.
- Extended explicit SERA Day/Night handling to supported ULL GPS review, added conservative GPS Night-time suggestion, kept IFR always pilot-entered, and made FCL.060 PF movement evidence optional/fail-closed.
- Final PR #238 CI passed: Verify #1141 — TypeScript PASS, **1208/1208** unit/regression, PostgreSQL **86/86**; Browser #514 — production build PASS, **84/84** with 2 intentional skips.
- Production v19 preflight proved exact v1–v18/no partial state; v19 migration committed successfully; postflight proved nullable/no-default engine column, validated NULL/SE/ME constraint, **0** backfilled defaults, unchanged baseline data counts and exact registry v1–v19.
- PR #238 merged as `ba2b4324f1f9ae84161ec86e82fc13d268938160`; production deployment `dpl_FsVYmDgJ2b3KNx4Yhd9jPsLJkvYc` is READY on that SHA, aliases `fly-tally.com` with no alias error, and immediate runtime-error check found none.
- No historical flight, certification, audit, recovery or aircraft-default backfill mutation was performed.


### Development workflow governance
- Adopted a risk-based verification cadence in `DEVELOPMENT.md`: targeted tests during iteration, subsystem-specific evidence at milestones, one complete local release gate for the final candidate, independent PR CI, and production-only preflight/postflight/smoke during closeout.
- Heavy PostgreSQL, authenticated browser and scale suites are no longer repeated after every small edit by default. Documentation/stale-source-guard corrections after an already-valid full gate require targeted re-verification unless they change runtime, persistence/schema, auth/security, certification/recency, or performance-critical behaviour.
- This is a development-process change only; product scope, ROADMAP priority and FEATURES capability inventory are unchanged.


### Flight Entry Follow-up E1 — discovery/design
- Production-use follow-up audit opened after Flight Entry Workflow 3.0 production closeout.
- Confirmed Manual New currently uses a generic SP fallback for `operation_type`, while GPS intentionally requires explicit SP/MP and clears the value on aircraft change.
- Confirmed aircraft profiles already persist default Role/billing but have no Operation default.
- Confirmed GPS Common details currently submit `Task = GPS import`.
- Confirmed `task` is included in the flight certification payload from certification v1 onward; certified rows therefore cannot be bulk-cleared by raw SQL without invalidating audit/integrity semantics.
- Confirmed GPS review already has detected T&G/final-landing event indices with UTC timestamps and track coordinates; the airport catalogue also has worldwide lat/lon/country.
- Confirmed Intelligent Logbook continuation/return assistance is portalled inside individual Route field labels, explaining the observed Departure/Arrival misalignment.
- Added E1 design and independent-review handoff.
- Independent review returned **APPROVE WITH CHANGES**. Accepted: certified Task correction contract, explicit Operation propagation/validation, route a11y, event-coordinate precedence and jurisdiction/provenance copy. Rejected one reviewer premise after authoritative verification: civil twilight remains the geometric solar-centre -6° boundary; sunrise/sunset refraction/solar-disc offset is not applied to civil twilight.
- E1.1 implementation: Intelligent `Continue from…` / `Return to…` suggestions now render in a dedicated `aria-live="polite"` full-width row below both Route fields instead of inside one label; the action remains an explicit keyboard-focusable button.
- E1.1 implementation: GPS Common details no longer expose or default `Task = GPS import`; new GPS imports submit an empty Task. Manual/Edit Task remains unchanged. Historical rows were **not** mutated.
- Added focused source contracts and authenticated browser route-alignment coverage. E1.1 local verification: targeted **30/30 PASS**, TypeScript PASS, production build PASS and authenticated browser **3/3 PASS**. E1.1 is DONE / LOCAL VERIFIED.
- E1.2 implementation staged schema v18 `aircraft.default_operation_type` as nullable `SP | MP | NULL` with a database CHECK constraint and **no aircraft-profile backfill**.
- Aircraft Add/Edit and Quick Add now expose optional Default operation; persistence validates and verifies the saved value. New Manual/GPS flight entry receives the profile default only as a prefill and the per-flight Operation remains editable.
- Manual New no longer silently normalizes a missing applicable Operation to SP: an incomplete draft may preserve `operation_type=''`, while existing FCL.050 certification remains fail-closed unless SP/MP is explicitly recorded. The existing `flights.operation_type` column and certification payload/version are unchanged.
- GPS still requires an explicit resolved SP/MP before Save; a profile default may preselect the control but does not bypass the server requirement.
- Aircraft sharing carries the default as part of optional Flight defaults. Legacy pending shares that predate the field preserve an existing recipient default rather than silently clearing it; a new share with an explicitly blank default can clear it to NULL when Flight defaults are imported.
- Account backup/restore remains exact through schema-aware `SELECT *` + `json_populate_record` after migration v18. Unknown imported defaults fail closed via parser/database constraint.
- Added focused E1.2 source/domain tests, PostgreSQL migration acceptance and authenticated Manual/GPS browser proof. Local verification completed: targeted **54/54 PASS**, focused migration regression **5/5 PASS**, TypeScript PASS, PostgreSQL acceptance **2/2 PASS**, production build PASS and authenticated browser **4/4 PASS**. Browser verification also exposed a pre-existing branch regression in migration 17 (`AS $` instead of `AS $$`); the dollar quote was restored and a source regression guard added. E1.2 is **DONE / LOCAL VERIFIED**. Production migration v18 remains **NOT APPLIED**.
- E1.3 discovery mapped the existing GPS evidence path: T&G and final landing already have exact track indices, timestamps and coordinates; timezone-less track timestamps already fail closed. Draft implementation uses geometric solar-centre altitude at the SERA -6° boundary, requires every detected landing event to classify before suggesting an aggregate split, limits first-release auto-prefill to the EASA/SERA path, and tracks landing split provenance explicitly as UNSET/SUGGESTED/MANUAL so unrelated UI state cannot overwrite pilot edits. Added dedicated read-only independent-review handoff before implementation.
- E1.3 independent review returned **APPROVE WITH CHANGES**. Reconciled contract now adds a conservative calculation-confidence guard around the unchanged -6° SERA boundary, bounds the initial NOAA/Meeus implementation to its documented support envelope, requires complete landing-event classification, keeps applicability as an account/logbook setting rather than aircraft identity, keeps suggestion provenance ephemeral, resets review evidence on split changes, and requires accessible provenance association.
- E1.3 core implementation added a pure fail-closed geometric solar-altitude classifier and landing-event aggregate. It uses each exact T&G/final landing point, rejects ambiguous timestamps, invalid coordinates, unsupported year/latitude, near-boundary confidence cases, partial classification and event-count mismatches. Added focused ordinary-latitude, equatorial, supported high-latitude, envelope, confidence-guard and aggregate tests. Core verification: targeted **24/24 PASS** and TypeScript PASS.
- E1.3 wiring staged account-level `night_definition` (`MANUAL` default/fail-closed, `SERA` opt-in) in existing settings JSON, passes it into GPS review, prefills only EASA `DAY_NIGHT` reviews with available event-level suggestions, tracks review provenance ephemerally as `UNSET/SUGGESTED/MANUAL`, clears a suggested split when the reviewed landing total changes, preserves direct pilot edits across unrelated state changes, and associates visible provenance with both Day/Night inputs. No schema/certification/sharing/recency change. Local verification completed: focused wiring + GPS regression **38/38 PASS**, TypeScript PASS, production build PASS and authenticated browser **5/5 PASS**. E1.3 is **DONE / LOCAL VERIFIED**.
- E1.4 discovery removed the residual server fallback that could synthesize `Task = GPS import`; focused source/certification/census tests previously reached **15/15 PASS**, TypeScript PASS, and the local SELECT-only census completed through **ROLLBACK** after browser-fixture schema alignment. Production target proof then confirmed `neondb`, read-only ON, schema v17 and required history tables. The production census found **14 exact live rows across 3 accounts, all 14 currently certified**, with **0 ordinary draft candidates**, plus **4 certified revision snapshots**, **2 deleted-flight recovery copies** and **51 audit events** carrying the legacy value. Independent review returned **APPROVE WITH CHANGES** and was reconciled: no automated historical mutation; pilot correction only through the existing owner-scoped correction/re-certification workflow; additive exact-match legacy UI annotation without changing export/print/certification data. Added a PostgreSQL correction-history acceptance case and presentation/export/hash/ownership guards. Focused E1.4/E1.1/certification tests are **20/20 PASS**, TypeScript PASS, PostgreSQL certification/correction acceptance is **5/5 PASS** on the local `flytally_browser` database, the production build is PASS (Next.js 16.3.8; 41/41 static pages generated), and targeted authenticated Playwright owner/shared legacy annotation coverage is **1/1 PASS**. E1.4 is therefore **DONE / LOCAL VERIFIED**. No production historical Task value was mutated.
- E1.5 closeout opened after E1.4 local verification. Added a dedicated production-closeout design and independent migration-review handoff. Current proposed order is full local release gate → PR/CI → fail-closed production v17 preflight/recovery point → explicit additive v18 migration → postflight verification → merge/deploy/smoke. No E1.5 production write, migration, merge or deploy has been executed yet. Independent review returned **APPROVE WITH CHANGES**. Reconciliation proved current production main v17 ignores future registry versions above its advertised schema, automatic feature-branch Vercel deployments are canceled while CI uses isolated PostgreSQL services, and relevant old-app aircraft consumers tolerate the additive nullable column. Added fail-closed production v18 preflight/migration/postflight tooling plus source-contract guards. Focused E1.5/E1.2/migration-plan sanity verification completed **16/16 PASS**. Full local release verification then produced TypeScript PASS and **1193/1198** unit/regression tests with five failures. Repository reconciliation classified all five as stale regression/document expectations, not runtime failures: three old unconditional `SP` source assertions were superseded by E1.2 nullable Operation-default semantics, the B1A aircraft-share assertion was superseded by the combined billing/Operation fail-closed default guard, and the v3.0 roadmap assertion still expected Workflow 3.0 to be ACTIVE after its production closeout. Those guards and current roadmap summary were reconciled; the targeted remediation pack passed **26/26**, complete unit/regression passed **1198/1198**, TypeScript PASS, and full PostgreSQL acceptance passed **84/84** including 10k/50k/100k scale coverage plus E1.2 migration and E1.4 certified-history correction checks. Production Next.js 16.3.8 build then passed with **41/41** static pages generated. The first full authenticated desktop/mobile Playwright run completed **82 passed / 2 skipped / 1 failed / 1 flaky**. Reconciliation found no runtime defect: the single failure came from E1.4 fixture residue left by the desktop project, which made the mobile core-shell `OK-E2E` row locator resolve both the baseline draft and certified legacy fixture; the flaky F3.4 case raced a controlled `<details>` close against the invalid-profile auto-open effect and passed on retry. Browser harness remediation now adds `finally` cleanup for E1.4 fixture rows, pins the core-shell assertion to the deterministic baseline flight, and tests invalid-profile auto-open from a fresh closed page. Added a source guard for E1.4 cross-project cleanup. Remediation verification then passed **6/6** source tests and **4/4** targeted Playwright checks across desktop + mobile with zero fail/flaky. The authoritative complete authenticated browser rerun, executed with the same single-worker discipline as CI, passed **84/84** with **2 intentional skips** and zero fail/flaky. A separate local run using Playwright's default four workers produced cross-test fixture collisions because both projects mutate the same isolated `flytally_browser` database; this was classified as an invalid harness run rather than a product regression. To prevent recurrence, `playwright.config.mjs` now pins `workers:1` for local and CI execution, v367 guards the serialization contract, and DEVELOPMENT documents the canonical browser command. That harness-only change is now verified by the E1.5 source-contract suite **7/7 PASS** and a config-driven desktop/mobile core-shell smoke **2/2 PASS**, which reported `using 1 worker` without a CLI worker override. The first canonical exact-head `npm run verify` then reached the unit/regression stage and failed **2/1200** only because older v3.2 source guards still asserted the superseded generic `OK-E2E` row locator and the previous CI-only worker expression. The worker-serialization guard is reconciled to unconditional `workers:1`. A first targeted v3.2 rerun then showed the old generic OK-E2E locator assertion had not actually been replaced; that remaining stale source guard is now corrected to the deterministic baseline-row locator. Runtime behavior is unchanged. Final targeted v3.2 verification then passed **5/5**. Canonical exact-head `npm run verify` passed completely: TypeScript PASS, **1200/1200** unit/regression tests, and production Next.js 16.3.8 build PASS with **41/41** static pages. Combined with the earlier complete PostgreSQL **84/84 PASS** and authoritative serialized authenticated Playwright **84/84 PASS** with **2 intentional skips** and zero fail/flaky, the E1.5 local release gate is closed. PR #237 `[full-ci]` then ran on GitHub: Browser smoke passed **84/84** with **2 intentional skips** using one worker, and PostgreSQL acceptance passed. The Fast application gate failed only one unit/regression source contract (**1199/1200 PASS**) because `v300-navigation-hierarchy` still expected the superseded exact `E1.5 ACTIVE` roadmap heading after documentation advanced to PR/CI. TypeScript passed and no runtime/browser/database defect was exposed. That guard is now stage-tolerant across E1.5 closeout transitions; CI rerun is required before production work. No production write, v18 migration, merge or deploy has been executed.

### Flight Entry Workflow 3.0 — F6 browser/responsive/production closeout
- Activated the final F6 acceptance phase after F5 completed local verification.
- Added a shared required presentation matrix covering 1440 desktop, iPad landscape, iPad portrait, 390 mobile, 320 compact mobile and a 720 × 450 CSS viewport representing 1440 × 900 at 200% browser reflow; every state runs in Light + Dark and checks document-level horizontal overflow.
- Added authenticated Manual coverage for PIC, DUAL, Safety Pilot Manual, Safety Pilot Connection, SPIC and PICUS.
- Added authenticated GPS single-flight coverage for the strict implemented role allowlist PIC / DUAL / SAFETY PILOT, including Manual + connected Actual-PIC modes.
- Added authenticated GPS multi-part coverage for inherited common DUAL plus complete connected Safety Pilot per-flight override and Reset-to-common visibility.
- Added Manual + GPS invalid-profile recovery coverage across the full presentation matrix.
- Added focused source contract `tests/v360-flight-entry-f6-closeout.test.ts` and closeout design `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F6_CLOSEOUT.md`.
- Runtime/parser/normalizer/persistence/schema/certification/recency changes: **none**. Local F6 verification completed with focused closeout contract **6/6 PASS**, authenticated F6 matrix **4/4 PASS**, and full authenticated Playwright **72 passed / 2 skipped / 0 failed** across desktop + mobile projects. PR #235 then passed Fast application gate, PostgreSQL acceptance, Chromium desktop + mobile, Classify CI risk and Vercel Preview Comments; it squash-merged to `main` as `fb0bbb3da5d3c0be36ecd3190b1840977edbd252`. Vercel production deployment `dpl_GM9nQX2gBwbn4GgzEy7YrJPnmR4F` is READY for that exact SHA, aliases `fly-tally.com` without alias error, and production smoke returned HTTP 200 from the exact deployment for `/`, `/login` and `/flights/new` with unauthenticated protected routing resolving to Login as designed. Immediate 30-minute runtime-error check found no errors. Flight Entry Workflow 3.0 F0–F6 is **DONE / PRODUCTION VERIFIED**. DB/schema migration N/A; certification version/hash unchanged; no historical rewrite.

### Flight Entry Workflow 3.0 — F5 Primary UX discovery/design
- Reconstructed the post-F4 production state from `main@5281d61fe2e7f38a3425ac0189007b46c68601b2` and reconciled roadmap drift: F0–F4 are production verified, while F5 and F6 remain outstanding milestones.
- Activated F5 on branch `feat/flight-entry-f5-primary-ux`.
- Source audit confirms the common Manual PIC hierarchy is already largely aligned with the frozen B1–B5 simplicity model: Date/Registration/Role, Route and UTC timeline are visible; landing/PF evidence, additional crew, aircraft context and Optional details use progressive disclosure.
- Draft F5 direction is intentionally narrow: remove duplicated workflow/helper copy rather than redesign flight semantics or invent new defaults.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F5_PRIMARY_UX_DESIGN.md` and `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F5_REVIEW_HANDOFF.md`.
- Runtime/schema/certification changes during discovery: **none**.
- Independent review returned **APPROVE WITH CHANGES** and was reconciled against the repository before implementation.
- Repo verification corrected the review scope: `FlightForm` is shared by Manual New + Manual Edit; GPS uses `KmlImportForm`; current Dashboard “Add flight” routes to New Flight rather than a separate Quick Add flight form.
- F5.1 removes the redundant long New Flight header workflow paragraph while preserving the mode chooser, GPS contextual instruction, `Save & review` and the action-surface draft/review consequence.
- F5.2 keeps Registration `Manage aircraft` because the valid collapsed Aircraft context has no equivalent manage link; unresolved profile recovery remains unchanged.
- F5.2 retains Role provenance as concise New-only `Aircraft default`, and removes the misleading cue from Edit/SNAPSHOT.
- F5.2 removes the generic BLOCK/AIR “Calculated automatically” helper only for New Flight when both values are resolved; BFCL authority copy, incomplete-state instruction, Edit helper behavior and the `aria-live` value surface remain.
- Added focused F5 source contracts and reconciled the historical v1.58 Role-provenance test. Verification: **NOT RUN**.
- Added two focused authenticated F5 browser cases: common Manual PIC exact persistent-control/helper allowlist across desktop/iPad/mobile, and PIC→DUAL contextual identity with the Role-default cue removed.
- Verification evidence: F5 focused/source batch **46/46 PASS**, TypeScript PASS and production build PASS.
- First full regression reached **1150/1151 PASS**; the only failure was the historical U4 source assertion still requiring the removed header sentence. It has been reconciled to the retained action-surface draft/review cue without runtime changes.
- First F5 browser run reached **1/2 PASS**; the common-PIC allowlist correctly encountered the existing contextual intelligent continuation suggestion (`Continue from LKPR…`). The F5 allowlist is now scoped to persistent/core helpers and controls while explicitly preserving/asserting contextual `data-intelligent-review` assistance. No runtime change.
- Final verification complete: focused reconciliation **16/16 PASS**, full unit/regression **1151/1151 PASS**, production build PASS, and authenticated F5.3 browser **2/2 PASS**. The browser proof preserves contextual Intelligent Logbook continuation assistance while keeping the persistent/core helper allowlist explicit. F5 is **DONE / LOCAL VERIFIED**. No DB/schema/certification change; deploy belongs to F6 closeout.

### Flight Entry Workflow 3.0 — F4 GPS inheritance design/review gate
- Completed repository discovery for the frozen F4 multi-part GPS inheritance milestone; no runtime behavior changed.
- Confirmed GPS remains intentionally PIC-only at both UI and server role gate, per-part Review state currently contains no Role/Crew context, and every reviewed part already passes through the shared `gpsFlightCandidate() → normalizeFlightDraft()` semantic boundary.
- Confirmed existing atomic import prepares and normalizes every part before one duplicate-safe transaction; F4 should extend this boundary rather than replace it.
- Confirmed Safety Pilot cannot be enabled by UI expansion alone: GPS must preserve Manual/accepted-Connection Actual-PIC authority, account-ID Connection recheck, display-name snapshot and one atomic connected-crew child row per resulting source flight.
- Drafted one common complete Role/Crew context plus all-or-nothing whole-part overrides; field-level inheritance, per-part aircraft identity and inferred crew remain prohibited.
- Proposed fail-closed split behavior clears part Role/Crew overrides when split structure changes instead of guessing which new segment owns old crew evidence.
- Added F4 design and independent-review handoff. Runtime/schema/certification: unchanged.
- Reconciled the independent review against current code: GPS already persists commander/instructor/role/verification name/reference from normalized per-part input; duplicate fingerprint excludes Role/Crew; Safety Pilot remains intentionally unwired from GPS.
- Staged F4.0 characterization coverage locking persistence-column parity, duplicate identity, temporary PIC-only scope, Safety Pilot non-wiring and shared DUAL/SPIC/PICUS Save requirements. No runtime behavior changed.
- Frozen implementation order: common Role/Crew → whole-part overrides → Safety Pilot. One product decision remains before enabling SPIC/PICUS: whether a common countersignature reference may apply to multiple split flight records.
- F4.0 local verification completed: targeted 5/5 PASS and full unit/regression 1124/1124 PASS.
- Implemented F4.1 common GPS Role/Crew for PIC + DUAL only: strict server resolution after aircraft authority, shared EASA DUAL Instructor/PIC validation, candidate propagation into the shared normalizer, controlled common UI, and inherited-review invalidation on common Role changes. SPIC/PICUS and Safety Pilot remain unavailable.
- F4.1 local closeout PASS: targeted cross-path tests **55/55**, TypeScript PASS, full unit/regression **1129/1129**, production build PASS, and authenticated desktop Chromium **2/2 PASS** against the disposable PostgreSQL browser DB. The browser proof covers PIC/DUAL role-surface behavior, common DUAL review invalidation, required Instructor/PIC gating, successful Save, and persisted normalized `DUAL + Instructor` values. The browser-only bootstrap now creates the minimal `airports` relation needed by GPS airport detection. No production DB/schema/certification change.
- Implemented F4.2 whole-part GPS Role/Crew overrides for the currently supported PIC + DUAL scope. Each split submits explicit `INHERIT` or complete `OVERRIDE`; the server validates envelope shape/count, rejects unknown/duplicate/stale fields and per-flight common-context drift, resolves each part without field-level fallback, and passes the fully resolved Role/Crew context through the existing GPS candidate/normalizer path before atomic persistence. The review UI supports per-flight override, deterministic Reset to common, inherited-only invalidation on common Role changes, and automatic override clearing with a visible notice when split boundaries change. Added focused F4.2 unit/source-contract coverage in `tests/v357-flight-entry-f42-whole-part-role-crew.test.ts`. F4.2 local closeout PASS: focused cross-path batch **67/67 PASS**, full unit/regression **1134/1134 PASS**, production build PASS including TypeScript, and authenticated desktop Chromium **4/4 PASS** against the isolated local PostgreSQL browser DB. Browser proof covers mixed INHERIT/OVERRIDE persistence, inherited-only invalidation, deterministic Reset to common, split-boundary override clearing with a visible notice, and persisted per-flight PIC/DUAL Role/Crew. No production DB/schema/certification change.
- Implemented F4.3 GPS Safety Pilot core while preserving Manual Actual-PIC authority semantics. GPS role scope now adds only SAFETY PILOT; common and whole-part overrides support explicit Manual Actual PIC text or accepted-Connection account ID without display-name matching. Extracted a reusable lower-level Safety Pilot resolver while keeping the Manual FormData wrapper, server-snapshot current connected display name into `commander`, propagate connected account ID separately, and recheck accepted Connection state in the atomic GPS write. Each connected Safety Pilot flight creates its own `flight_connected_crew` row in the same transaction as flight + track; a zero parent/track/required-child write forces rollback of the complete N-part transaction. Added F4.3 focused contract tests, isolated PostgreSQL atomicity coverage and advanced the browser role-surface expectation. Verification on the runtime-equivalent F4.3 head: focused F1.4/F4.3 **12/12 PASS**, targeted cross-path **80/80 PASS**, isolated PostgreSQL Manual-resolver + GPS Safety Pilot **5/5 PASS**, TypeScript PASS, and production build PASS. The PostgreSQL division-by-zero in the rollback test is intentional fail-closed evidence. The first full-suite run exposed 6 stale source-contract assertions only; these were reconciled in `safety-pilot-pic-sp2`, F0.0, F0.1 and F2.5 tests without runtime changes. Final reconciliation **9/9 PASS**, TypeScript PASS, and final full regression **1141/1141 PASS**. Production build remains PASS on the runtime-equivalent head. F4.3 local closeout completed. The first authenticated browser attempt exposed a localhost-only transaction-adapter parser defect: `track_insert` was misidentified as a top-level `INSERT` token. The adapter now requires a left identifier boundary before command recognition and has a focused U6 regression test. Final verification after rebuild: adapter **4/4 PASS**, TypeScript PASS, full unit/regression **1142/1142 PASS**, production build PASS, and authenticated desktop Chromium F4.3 **3/3 PASS**. Browser proof covers common Manual persistence without account link, common connected account-ID persistence with authoritative server display-name snapshot + one `flight_connected_crew` PIC row, and revoked per-flight connected override fail-closed behavior with zero partial split persistence. Earlier F4.3 evidence remains targeted cross-path **80/80 PASS** and isolated PostgreSQL **5/5 PASS**. No DB/schema/certification change; deploy NOT RUN.
- Started F4.4 closeout. Added one authenticated responsive GPS Role/Crew override matrix covering desktop 1280, iPad landscape 1024, iPad portrait 768, mobile 390 and mobile 320 under light + dark. The staged state uses inherited DUAL plus a complete connected Safety Pilot per-flight override and verifies stable override controls/values plus no horizontal overflow. No application runtime behavior changed. SPIC/PICUS remain fail-closed pending the separate countersignature-reference product decision. Responsive browser closeout is **1/1 PASS** on authenticated desktop Chromium while internally exercising 5 viewport sizes × light/dark with stable inherited DUAL and connected Safety Pilot override state and zero horizontal overflow. F4.4 is now production-closed: PR #233 squash-merged to `main` as `252bcb8eb0258603c1164c5e19bfdcf25bc0d9dd`; Vercel deployment `dpl_3Jh1ghZ8wfkZRE5w3ZN83gxasnzd` is READY on that SHA and aliases `fly-tally.com`; production smoke returned HTTP 200 for `/`, `/login` and `/flights/new`, with protected unauthenticated entry resolving to Login as expected; immediate 30-minute runtime-error check found no errors. F4 is DONE / PRODUCTION VERIFIED. No DB/schema/certification change. No DB/schema/certification change.


### Flight Entry Workflow 3.0 — F3.5 closeout and F3 production integration
- Reconciled the F3.5 closeout plan against an independent second-AI review. Verdict: **APPROVE WITH CHANGES**; no confirmed correctness defect, but action/persistence proof is required for crafted authority drift and historical SNAPSHOT boundaries.
- Froze the minimum closeout scope: no runtime change unless a test proves a bypass or stale-profile consumer; no generic historical-context override; no DB migration; GPS remains PIC-only.
- Source-audited downstream consumers before adding duplicate tests: CSV/XLS export and Statistics derive regulatory context from stored `flights`; Trash serializes/restores raw flight context; Print reads F3 evidence/category/class/type from `flights` and consults current Aircraft only for ICAO type-code presentation; existing certification/shared/backup/restore/recency suites remain the primary invariance evidence.
- Deferred as non-blocking unless evidence changes: the microscopic PROFILE read→flight-write race, explicit historical-context correction UX, wider browser matrix beyond already-verified F3.4 states, and any new schema.
- Added focused source-contract coverage plus authenticated browser/PostgreSQL fixtures for historical SNAPSHOT, crafted authority drift, submit-time PROFILE re-resolution, TMG/OTHER A+, Balloon ownership and Quick Add → immediate Save. Browser-fixture schema was aligned with current aircraft mutation columns and optional untracked flight billing; these are test-only changes.
- **Local verification:** final unit/regression **1119/1119 PASS**, 0 fail, 0 skipped; browser bootstrap PASS; targeted authenticated desktop Chromium **4/4 PASS**. PostgreSQL core **66/66 PASS**, TypeScript PASS and production build PASS were already established on the runtime-identical F3.5 branch before the final test-only fixture/assertion refinements.
- **Runtime/schema/certification:** no application-runtime change in F3.5, no DB migration, certification v1–v8 unchanged.
- **Integration/deploy:** F3 stack was fast-forwarded to `main`; rollback anchor `chore/pre-f3-integration-anchor` preserves pre-F3 main. Vercel initially ignored the docs-only closeout commit, so an empty tree-identical commit `a4b1c626d487aad86ef3e2de887df50a0a2b9248` triggered the intended production build without changing runtime contents. Deployment `dpl_Dn3PAymjG7aCds9xsw18shzkYM4a` is READY, aliases `fly-tally.com` with no alias error, public smoke returned HTTP 200, and no runtime errors were reported in the immediate 30-minute post-deploy check. GitHub Actions and PR were intentionally not run. F4 is next.


### Flight Entry Workflow 3.0 — F3.4 compact aircraft-context UX (locally verified, not yet merged/deployed)
- Replaced routine Manual Logbook/Class/Aircraft type editors with one compact **Aircraft context** surface backed by the F3 authority model.
- PROFILE entry submits server-supported profile-owned evidence, class, aircraft type and Balloon class/group as hidden authority fields; only genuine TMG/OTHER regulatory context from `allowedFlightContexts(profile)` remains selectable.
- Same-registration Edit presents **Stored flight context** and submits the stored SNAPSHOT tuple instead of refreshing it from the mutable current profile. Legacy rows with blank stored `regulatory_category` remain blank on submission and are described without invented backfill.
- Invalid PROFILE state is now part of the Manual completion blocker list and links to Aircraft configuration in a new tab/window so the current draft is preserved.
- GPS Common details now uses the same compact profile-context presentation and removes disabled duplicate Logbook/Class/Aircraft type controls while preserving the common TMG/OTHER selector.
- Operation/Engine, Balloon FREE/TETHERED, sailplane launch evidence and Role/Crew remain explicit flight-specific inputs.
- Added focused F3.4 source/contract coverage and reconciled earlier B3/B5/F3 characterization assertions with the superseding compact-authority UX.
- Browser fixture was aligned with the existing F3 authority provenance columns and now includes an explicit TMG fixture for multi-context acceptance; this is test-fixture-only and does not alter application schema.
- **Local verification on `e305f3ef3985d371a385a0e7231ec42d8a6d135e`:** TypeScript PASS; full unit/regression **1110/1110 PASS**, 0 fail, 0 skip; production `next build` PASS; disposable localhost browser DB bootstrap PASS; targeted authenticated desktop-Chromium suite **5/5 PASS**, including Manual/GPS compact context, invalid PROFILE blocker, TMG A+ choice, GPS-save SNAPSHOT reopen and the responsive light/dark RoleCrew/context matrix.
- **CI/PR/deploy:** NOT RUN intentionally for this local closeout; no merge or production deployment is claimed.
- **Schema/certification:** no migration and no certification v1-v8 change.


### Flight Entry Workflow 3.0 — F3.3 server enforcement (locally verified, not yet merged/deployed)
- Wired Manual New and registration-change saves to server-side owned-profile authority using the shared F3 resolver; submitted aircraft context must be a member of the profile's allowed context set, and persistence now uses the canonical server-authorized context rather than the raw normalized request values.
- Wired same-registration Edit to server-derived SNAPSHOT authority; unchanged historical context is persisted from the stored snapshot without consulting the mutable current profile. Legacy blank regulatory-category rows are preserved rather than silently upgraded by the current UI's derived presentation value.
- Routed GPS through the same shared PROFILE authority while keeping its active-aircraft selection boundary and PIC-only Role scope.
- Added one common GPS TMG/OTHER regulatory-context choice and server validation against `allowedFlightContexts(profile)`; no full evidence/class override was introduced.
- Propagated Part-FCL credit provenance into entry/profile authority validation so malformed provenance fails closed rather than being dropped at the F3 boundary.
- Added focused F3.3 unit/source-contract coverage and retired stale F3.0/F3.2/F1.3 assertions that conflicted with the now-authoritative persistence boundary.
- Hardened the local PostgreSQL acceptance/browser harness for Windows: connection URLs are passed with explicit `-d`, SQL is streamed through UTF-8 stdin, and CRLF query output is normalized before assertions. The harness remains localhost-only.
- **Local verification:** final branch head `065896d3c9aa75fee8c2c0c7cc7a2f6abc20e52a` — full unit/regression **1102/1102 PASS**. On runtime-identical head `3644a85d6da5e01a96c6869b9537c114d395e299`: TypeScript PASS, PostgreSQL core **66/66 PASS**, production `next build` PASS. The only change after that runtime verification was a stale source-contract test assertion aligned to canonical F3 authority persistence.
- **CI/PR/deploy:** NOT RUN intentionally for this local closeout; no claim of merge or production deployment.
- **Schema/certification:** no migration and no certification v1-v8 change.


### Flight Entry Workflow 3.0 — F3.2 authority resolver
- Added the pure shared aircraft-context authority resolver and its focused unit matrix.
- The resolver keeps evidence/class, Balloon class/group and aircraft type profile-owned, while allowing only the frozen TMG/OTHER multi-context categories.
- Added PROFILE/SNAPSHOT authority derivation from stored versus final normalized registration and raw SNAPSHOT comparison that preserves legacy blank category values.
- F3.2 remains intentionally unwired from Manual/GPS mutations; F3.3 owns enforcement.
- PR #229 merged as `abc66ae13cfc8a3af7f6ee21f19ab5c8ab63bc73`; Verify #1097 PASS, PostgreSQL 66/66; Browser #470 PASS including production build.
- Production deployment is READY on the exact merge SHA with the `fly-tally.com` alias and no alias error.
- DB migration/schema: N/A.

### Flight Entry Workflow 3.0 — F3.1 production census
- Completed the required read-only aircraft-context census before runtime enforcement.
- Current profiles pass the canonical validation gate; no pre-enforcement bulk repair or migration is required.
- Historical flight/profile differences were classified as legacy blank-category snapshots plus one older stored regulatory snapshot against a later-updated current profile; no explicit nonblank category conflict was found.
- Historical aircraft identity differences remain SNAPSHOT evidence and are not refresh targets.
- No current production TMG/OTHER/Balloon population was available to validate multi-context frequency; focused contract tests remain required.
- A+ remains frozen and F3.2 pure resolver work is next.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F31_PRODUCTION_CENSUS.md` and updated ROADMAP/FEATURES/F3 design.
- **Runtime/schema/certification/deploy:** N/A; no production data was mutated.

### Flight Entry Workflow 3.0 — F3 independent-review reconciliation
- Reconciled the F3 aircraft-context design against the independent review and current repository contracts before any runtime enforcement.
- Superseded the draft full regulatory override (Option B) with **A+**: evidence/class remain profile-owned; explicit flight-level choice is limited to genuine profile-supported TMG/OTHER multi-context semantics plus deliberate same-registration historical correction.
- Froze server-derived PROFILE/SNAPSHOT authority with no generic client-sent override-authority flag; PROFILE drift must reject, while unchanged SNAPSHOT context must remain historical and must not be revalidated against today's stricter profile validator.
- Froze Manual New/registration-change authority as **owned + canonically valid** profile, allowing inactive owned profiles to remain available for explicit historical back-fill; GPS retains its existing active-owned-profile selection boundary.
- Froze aircraft identity/type and Balloon class/group as profile/snapshot-owned; Balloon FREE/TETHERED remains flight-specific.
- Kept narrow Manual/GPS convergence in F3: the common resolver will expose the same whole-session TMG/OTHER choice where a profile has multiple allowed contexts; GPS Role/Crew expansion remains F4.
- Reordered F3 so **F3.1 is a read-only production census** before resolver/enforcement implementation. The census may not repair, normalize, backfill or invent production evidence.
- **Runtime/schema/certification:** no change in this reconciliation step.

### Flight Entry Workflow 3.0 — F3.0 aircraft-context discovery / review
- Characterized aircraft-context authority across Manual New/Edit, GPS import, canonical aircraft-profile validation and historical identity snapshots.
- Confirmed Manual currently applies profile defaults client-side but create/update do not re-resolve the active profile, while GPS already re-queries and validates the active profile server-side.
- Confirmed Manual invalid-profile state is visible as **Needs configuration** but is not itself an action-level profile gate.
- Confirmed same-registration Edit preserves stored context; registration change applies current profile/identity snapshot semantics.
- Added F3 design, independent-review handoff and v349 characterization coverage for valid ULL/EASA, TMG/OTHER multi-context profiles, Manual/GPS authority divergence and historical snapshot boundaries.
- Draft authority model is PROFILE / SNAPSHOT / explicit OVERRIDE; override breadth and GPS timing are review-gated.
- **Verification:** PR #225 merged as `4e42dbf7fd095aa768e404500b141510386a18c5`; Verify FlyTally web #1096 PASS — **1084/1084** unit/regression and PostgreSQL **66/66**. Browser/deploy N/A because F3.0 is docs + characterization only.
- **Runtime/schema/certification:** no change in F3.0.

### Flight Entry Workflow 3.0 — F2.4 producer-consumer audit / review gate
- Audited Role/Crew producers and consumers across Manual normalization, Safety Pilot linkage, Certification, explicit instructor verification, shared-flight materialization, print/read-only output, CSV/XLS export, audit, backup/restore, recency and GPS boundaries.
- Confirmed a remaining Certification-time DUAL/SPIC/PICUS display-name → account inference path; the repository already has an explicit account-ID post-certification request flow that can replace it.
- Confirmed `instructor` is overloaded with aircraft differences/familiarisation training evidence and `verification_*` is overloaded with generic endorsement evidence; broad Role-only clearing remains unsafe.
- Identified one unresolved semantic mismatch: current PIC-name output lets stored commander override account self identity on self-PIC roles even though the frozen RoleCrew contract says self is authoritative.
- Added the F2.4 audit and an independent-review handoff; no runtime, schema, certification-version, recency or historical-data change yet.
- **Verification:** documentation/repository analysis only; runtime tests not applicable to this analysis commit.
- **F2.4A runtime:** removed Certification-time DUAL/SPIC/PICUS display-name → account matching and the implicit verification request side effect; explicit `instructor_id` account selection remains the only account-bound request path.
- Updated Crew Verification copy so typed names are described as stored flight evidence, not account bindings or automatic request triggers.
- Added source-contract and authenticated browser coverage proving a certified matching typed name remains unbound and only an explicit connected-account request control is offered.
- **Final verification:** Verify FlyTally web #1089 PASS — TypeScript PASS, full unit/regression **1052/1052**, PostgreSQL acceptance **66/66**; Browser smoke #465 PASS — production build PASS, Chromium **34 passed / 2 skipped**.
- PR #212 merged as `06b50d911e0cedcafbd5f10bea41868098f8d8b0`.
- Production deployment `dpl_DP43Y79vK4Kny2L86Wuw5VCjAoHH` is READY for that exact merge SHA, aliases `fly-tally.com`, and reports no alias error.
- **DB/schema:** N/A. Certification v1–v8, certified rows, Safety Pilot F2.3, shared materialization and GPS PIC-only boundaries are unchanged.
- **F2.4B discovery:** confirmed that self-PIC `commander` can be intentional rather than stale: Manual UI exposes optional Commander/PIC for non-DUAL roles and shared PIC materialization writes participant/source commander snapshots onto recipient `PIC` rows. The earlier draft preference to make SELF always override stored commander is therefore no longer considered safe without independent review.
- Added a focused F2.4B independent-review handoff. No runtime, schema, certification-output or persisted-data change in this discovery step.
- Added F2.4B characterization coverage for self-PIC fallback/explicit commander precedence, Manual commander availability, shared PIC commander snapshot production and raw integrity/export visibility. PR #215 merged as `064be0862b9506e472545eb16491b21019a90a50`; Verify FlyTally web #1090 PASS — TypeScript PASS, **1057/1057** unit/regression, PostgreSQL **66/66**. No runtime behavior or schema change.
- **F2.4B B1 runtime:** split the RoleCrew contract into role-level PIC identity (`rolePicIdentitySource`) and backward-compatible display precedence (`picDisplayPrecedence`); self-PIC `commander` is modeled as optional evidence rather than falsely `not_applicable`. `pilotInCommandName()` delegates to the shared pure resolver while preserving previous results.
- **Final verification:** Verify FlyTally web #1091 PASS — TypeScript PASS, full unit/regression **1058/1058**, PostgreSQL acceptance **66/66**; Browser smoke #466 PASS — production build PASS, Chromium **34 passed / 2 skipped**.
- PR #217 merged as `6f1b33745d8b5c352d0d3331ea4891bb9f8d9f58`.
- Production deployment `dpl_4MfDPVYDhR3ibgQ7uHoeUAagQkQW` is READY for that exact merge SHA, aliases `fly-tally.com` with no alias error, and the production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A. No destructive canonicalization, certification payload/version change, certified-history rewrite, shared-materialization change or GPS role expansion.
- **F2.4B B2 semantic closeout:** intentionally performs no destructive canonicalization. Cross-role regression coverage preserves commander/instructor/verification evidence for DUAL, SPIC and PIC contexts, including generic training/endorsement evidence. Current commander-over-SELF display precedence remains frozen for F2; any future change requires an explicit reopened decision rather than silent reinterpretation.
- PR #219 merged as `1c0ecf7be2e18feba7e583039ed5c27919dcdd42`; Verify FlyTally web #1092 PASS — TypeScript PASS, **1059/1059** unit/regression, PostgreSQL **66/66**. Browser rerun was not required because this closeout changed tests/docs only; runtime behavior remained the already production-verified B1 implementation.
- **F2.4C cross-path characterization:** added coverage spanning Manual RoleCrew preservation, Certification/request separation, exact revision/hash verification evidence, shared-flight materialization, print/read-only/CSV/XLS, audit/backup, recency evidence, Safety Pilot F2.3 and GPS PIC-only. Extended authenticated browser coverage to expose both explicit connected-account and in-person verifier paths without implicit binding.
- **Final verification:** Verify FlyTally web #1094 PASS — TypeScript PASS, full unit/regression **1068/1068**, PostgreSQL acceptance **66/66**; Browser smoke #468 PASS — production build PASS, Chromium **34 passed / 2 skipped**.
- PR #221 merged as `84b5f5362f03ef1959956fba91584059a36c2db5`.
- **Runtime/schema/deploy:** no runtime or schema behavior changed; production deployment N/A.
- **F2.5 final regression + F2 closeout:** added exhaustive RoleCrew matrix/crafted Save coverage, v1–v8 certification compatibility checks, explicit invitation boundary checks, auxiliary-role non-creditability/GPS PIC-only guards, and responsive authenticated browser coverage for PIC/DUAL/SPIC/PICUS/CO-PILOT/Safety Pilot across desktop, iPad landscape/portrait and mobile in light + dark.
- **Final verification:** Verify FlyTally web #1095 PASS — TypeScript PASS, full unit/regression **1077/1077**, PostgreSQL acceptance **66/66**; Browser smoke #469 PASS — production build PASS, Chromium **36 passed / 2 skipped**.
- PR #223 merged as `bc187e307958054efa2e32db316b06139d10df6e`.
- Production deployment `dpl_GFWksQDdFMoSr9qyvQYgiCBd2ShJ` is READY for exact merge SHA `bc187e307958054efa2e32db316b06139d10df6e`, aliases `fly-tally.com` with no alias error, and the production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A. F2 closes without destructive RoleCrew canonicalization, certification-version change, historical rewrite or GPS role expansion.

### Flight Entry Workflow 3.0 — F2.3 Safety Pilot resolver convergence
- Added one server-owned `resolveSafetyPilotPicForSave()` path used by both Manual create and update.
- Manual Safety Pilot mode preserves the normalized commander and fails closed for a blank EASA Actual PIC; connected mode validates a positive non-self account ID, requires a currently accepted Connection and ignores client commander text.
- Connected mode snapshots the current server `users.display_name` as the historical commander; no account identity is inferred from names.
- Create/update persist the shared resolver output and also recheck accepted Connection state inside the parent write predicate to prevent a revoked Connection from producing a parent or child mutation.
- `flight_connected_crew` remains separate metadata and is inserted/updated/deleted only when the parent create/update succeeds.
- A zero-row connected write is reclassified through the same resolver so a concurrent revocation returns the existing Connection-specific error instead of silently degrading.
- Added focused source regression coverage, PostgreSQL acceptance for the production resolver query, and authenticated browser coverage for display-name resnapshot on create/update plus revoked-Connection Save rejection.
- GPS remains PIC-only; certification payload versions v1–v8 and collaboration/materialization semantics are unchanged.
- **Final verification:** Verify FlyTally web #1077 PASS — TypeScript PASS, full unit/regression **1048/1048**, PostgreSQL acceptance **66/66**; Browser smoke #453 PASS — production build PASS, Chromium **32 passed / 2 skipped**.
- PR #209 merged as `d90215f88514e953e062980798954c497ca76be7`.
- Production deployment `dpl_84eHWKabeoy8DqgGuM6rDATjTTjR` is READY for that exact merge SHA, aliases `fly-tally.com` with no alias error, and the public production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A.

### Flight Entry Workflow 3.0 — F2.2 Manual inline Role/Crew UX
- Moved role-defining DUAL Instructor/PIC, Safety Pilot Actual PIC, and SPIC/PICUS supervision/countersignature controls directly into Flight essentials immediately after Role.
- Manual applicability and required cues now consume the shared `roleCrewSpec(role,evidence)` contract introduced in F2.1.
- Added completion blockers and direct focus targets for EASA DUAL Instructor/PIC and SPIC/PICUS supervisor/countersignature fields, alongside the existing Safety Pilot Actual PIC blocker.
- Kept generic Commander/PIC + Instructor inputs available under a separate optional **Additional crew details** disclosure; no destructive field cleanup or persistence canonicalization is introduced.
- Preserved local instructor/supervision form state across role switches before Save.
- Safety Pilot connection authority remains server/action-owned; GPS remains PIC-only; certification payload versions v1–v8 are unchanged.
- Added focused F2.2 source/UX regression coverage and reconciled B3/B5 characterization tests.
- Added authenticated Chromium coverage proving DUAL and SPIC/PICUS inline fields are required under EASA and retain unsaved values across Role switches.
- **Final verification:** Verify FlyTally web #1075 PASS — TypeScript PASS, full unit/regression **1042/1042**, PostgreSQL acceptance **63/63**; Browser smoke #451 PASS — production build PASS, Chromium **30 passed / 2 skipped**.
- PR #207 merged as `205483eda15f82770c1000c0a91fa4df92177fcd`.
- Production deployment `dpl_9v8FjPuj8F2jAuH4TAVNfHrM4eAE` is READY for that exact merge SHA, aliases `fly-tally.com` with no alias error, and the public production root returned HTTP 200 from that deployment.
- **DB/schema:** N/A.

### Flight Entry Workflow 3.0 — F2.1 RoleCrew validation
- Added a pure `roleCrewSpec(role,evidence)` contract describing role-specific Save requirements and PIC-identity source semantics without DB/account dependencies.
- Routed EASA DUAL and SPIC/PICUS Save validation through the shared RoleCrew contract.
- EASA DUAL now fails closed server-side when Instructor/PIC is missing instead of relying on HTML required + later Certification.
- Preserved CO-PILOT/CRCP/PAX/OBSERVER Save-optional commander behavior and existing ULL behavior.
- Safety Pilot remains action/resolver-authoritative in F2.1; accepted-Connection resolution is not moved into the pure normalizer.
- No destructive commander/instructor/verification sanitization is introduced in F2.1; overloaded training/endorsement evidence remains intact for later F2.4 reconciliation.
- GPS remains PIC-only; certification payload versions v1–v8 are unchanged.
- Added targeted RoleCrew unit/integration coverage for the frozen matrix and non-sanitization boundary.
- **Final verification:** Verify FlyTally web #1065 PASS (TypeScript, full unit/regression, PostgreSQL acceptance); Browser smoke #441 PASS including production build and real Chromium smoke.
- PR #204 merged as `0f00a3c256843dd24b84a801f6b1e0cae60771d5`.
- Production deployment `dpl_Dd3wzaNm51qBVKDBzRMFHF7cEgfP` reached READY for that exact SHA; `fly-tally.com` is aliased with no alias error and returned HTTP 200.
- **DB/schema:** N/A.

### Flight Entry Workflow 3.0 — F2 Role/Crew review reconciliation
- Independent review returned **APPROVE WITH CHANGES** and was reconciled against current repository consumers/producers.
- Frozen CO-PILOT/CRCP commander as Save-optional with the current Certification PIC-name gate unchanged; PAX/OBSERVER Save behavior also remains unchanged.
- Rejected the proposed new self-PIC commander requirement because the F0 contract and `pilotInCommandName()` explicitly support account-derived self identity with blank stored commander.
- Found that broad Role-only sanitization is unsafe: `instructor` also gates Aircraft Differences/Familiarisation purpose evidence and `verification_*` feeds general endorsement warnings.
- Found an existing DUAL/SPIC/PICUS certification auto-request path that matches typed names to connected accounts; this conflicts with the frozen no-name-inference rule and is deferred to explicit F2 reconciliation.
- Narrowed F2.1 to a pure RoleCrew requirement contract + server validation only. Destructive evidence-aware sanitization moves to F2.4.
- GPS is frozen PIC-only through F2; F4 owns Role/Crew inheritance/overrides.
- **Runtime/schema behavior:** unchanged by this reconciliation.

### Flight Entry Workflow 3.0 — F2 Role/Crew design
- Added a repository-backed F2 Role/Crew design draft after F1 production closeout.
- Characterized the current split boundaries: EASA DUAL is UI/certification-required but not yet server Save-required; Safety Pilot Actual PIC is action-level with accepted-Connection recheck; SPIC/PICUS supervision is already server Save-required.
- Proposed one source-agnostic `roleCrewSpec(role,evidence)` contract plus canonical role-owned-field sanitization.
- Kept connected-account resolution outside the pure normalizer and preserved the historical-text vs account-link distinction.
- Kept GPS PIC-only during design; F4 remains owner of per-part RoleCrew overrides.
- Prepared an independent review handoff covering CO-PILOT/CRCP Save policy, self-PIC crew fields, legacy draft sanitization, Safety Pilot connection architecture and GPS role promotion.
- **Runtime/schema behavior:** unchanged; F2 implementation has not started.

### Flight Entry Workflow 3.0 — F1.4 shared GPS normalization
- Routed every reviewed GPS PIC part through `gpsFlightCandidate() → normalizeFlightDraft() → FlightInput` before any flight persistence.
- GPS flight INSERT semantics now consume the same normalized `FlightInput` contract as Manual entry instead of recomputing role credit, billing, operation/engine and other flight semantics independently.
- Kept GPS track coordinates/provenance, date-effective price lookup, duplicate fingerprinting, sorted advisory locks and the atomic N-part transaction outside the semantic normalizer.
- Preserved F0.1 fail-closed aircraft context, F1.5 explicit Operation/Engine and F1.6 explicit source-evidence review; GPS remains PIC-only.
- Added Manual/GPS equivalent-EASA-PIC semantic equivalence coverage plus authenticated browser persistence coverage.
- Reconciled the isolated browser `flight_tracks` fixture with the runtime `overview_version` column and made the mutation test deterministic/cleanup-safe.
- Final PR-head verification before docs closeout: Verify #1055 PASS; TypeScript PASS; full unit/regression **1030/1030**; PostgreSQL acceptance **63/63**; Browser smoke #431 **28 passed / 2 skipped**; production build PASS.
- F1.4 merged as PR #200 on `main@5c2af689c74e209358d22eebf05c3f4120a4224f`.
- Production deployment `dpl_8NaCnff1TcP6DRkXSwUKmEq9dHiR` reached READY for that exact main SHA and is aliased to `fly-tally.com` with no alias error.
- DB schema/migration: N/A for F1.4; F1.0 migration v17 remains the only schema prerequisite in F1.
- F1 shared semantic normalization is therefore **DONE / production-verified**; F2 Role/Crew parity is next.
- Superseded parallel PRs #196 and #198 were closed without merge.

### Flight Entry Workflow 3.0 — F1.6 GPS source fidelity
- Added category-driven GPS review requirements instead of inferring regulatory evidence from generic movement.
- Reviewed landing totals must be explicitly classified day/night where the current domain distinguishes them; non-TMG sailplane keeps the existing total-landing compatibility model.
- Part-FCL/ULL PF movement credit now requires an explicit Yes/No pilot decision; positive PF evidence requires explicit day/night take-off and approach counts.
- Part-SFCL TMG and Part-BFCL take-offs require explicit day/night counts; non-TMG sailplane requires explicit launch method/count.
- Added optional reviewed Night/IFR fields for standard-time categories; track motion does not infer either value.
- GPS candidate adapters now resolve these source-sensitive fields only from explicit reviewed input, while unresolved/missing required facts remain fail-closed.
- Current GPS persistence stores the reviewed source-fidelity fields in preparation for F1.4 shared-normalizer convergence.
- Added source/domain and authenticated browser coverage for the new review boundary.
- DB schema/migration: N/A.
- Verification: final Verify FlyTally web #1031 PASS; TypeScript PASS; full unit/regression **1025/1025**; PostgreSQL acceptance **63/63**; Browser smoke #407 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A. The first #1030 run failed only because an F0.1 source-characterization assertion still expected the pre-F1.6 readiness expression; the assertion was reconciled without runtime changes.

### Flight Entry Workflow 3.0 — F1.5 explicit GPS Operation / Engine
- Reordered F1 execution because the shared normalizer correctly treats unresolved Operation/Engine as a blocking semantic state; routing GPS through it before explicit source input would either fail every applicable import or reintroduce guessed defaults.
- Added common GPS **Operation (SP/MP)** and **Engine (SE/ME)** controls for categories where the canonical capability contract exposes those semantics.
- Aircraft/registration changes clear both selections so values cannot leak across aircraft profiles.
- Server-side GPS import now revalidates Operation/Engine and persists the explicit reviewed values rather than silently forcing `SP` and class-derived Engine.
- Non-applicable category branches retain compatibility storage values only and do not present them as regulatory evidence.
- GPS remains PIC-only; shared normalizer routing, sailplane/movement/day-night/Night/IFR convergence remain outside this batch.
- **Verification:** Verify FlyTally web #1024 PASS; TypeScript PASS; full unit/regression **1019/1019**; PostgreSQL acceptance **63/63**; Browser smoke #400 **26 passed / 2 skipped**; production build PASS.
- **DB schema/migration:** N/A.

### Flight Entry Workflow 3.0 — F1.3 Manual persistence proof
- Added source-contract coverage proving Manual create and update remain behind the `parseFlightInput(FormData)` compatibility boundary after F1.2.
- Verified flight semantic columns are persisted from normalized `FlightInput` values rather than re-read independently from FormData.
- Preserved airport canonicalization, rate resolution, duplicate fingerprint/advisory locking and edit lock guards as persistence concerns.
- Preserved expenses as separately validated child rows and connected Actual-PIC account linkage as collaboration metadata outside the pure normalizer.
- Confirmed GPS remains on its specialized path for F1.4.
- Verification: Verify FlyTally web #1013 PASS; TypeScript PASS; full unit/regression **1014/1014**; PostgreSQL acceptance **63/63**; Browser N/A because no runtime/UI behavior changed; DB schema/migration N/A.
- Next: **F1.4 GPS semantic adapter / persistence convergence**.

### Flight Entry Workflow 3.0 — F1.2 pure normalizer
- Extracted `normalizeFlightDraft(candidate)` as the source-agnostic pure semantic normalizer for flight draft data.
- Converted `parseFlightInput(FormData)` into the compatibility wrapper `FormData → manualFlightCandidate() → normalizeFlightDraft()`.
- Kept DB/auth lookup, expenses, connected-crew validation, persistence and GPS track handling outside the pure normalizer.
- Explicit unresolved candidate authority now returns a domain error instead of being coerced into an implicit value.
- Preserved existing Manual semantics across EASA/ULL validation, category mapping, sailplane/BFCL evidence, structured movements, SPIC/PICUS supervision, professional context, purpose/task and role-derived function time.
- GPS import is not routed through shared normalization yet; its persistence behavior remains unchanged in F1.2.
- Verification: Verify FlyTally web #1007 PASS; TypeScript PASS; full unit/regression **1006/1006**; PostgreSQL acceptance **63/63**; Browser smoke #388 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A.
- Earlier #1003/#1006 failures were stale/source-test maintenance and a test syntax error encountered during the refactor, not accepted runtime regressions.
- Next: **F1.3 Manual wrapper regression / persistence proof**.

### Flight Entry Workflow 3.0 — F1.1 candidate/source adapters
- Added a typed `FlightDraftCandidate` characterization layer with explicit unresolved semantic state and compact provenance metadata.
- Added Manual FormData extraction preserving the presence-sensitive fields that current `parseFlightInput()` depends on.
- Added GPS reviewed-part extraction that carries canonical aircraft-profile context when available but does not infer unresolved Operation/Engine, day/night movement, Part-FCL PF/approach, sailplane launch, night or IFR evidence.
- Future explicit common GPS Operation/Engine values are supported by the candidate contract without class-derived defaults.
- The new adapters are not wired into current Manual/GPS mutation runtime yet; persisted flight semantics remain unchanged in F1.1.
- Verification: Verify FlyTally web #998 PASS; TypeScript PASS; full unit/regression **998/998**; PostgreSQL acceptance **63/63**; Browser smoke #379 **26 passed / 2 skipped**; production build PASS; DB schema/migration N/A.
- Next: **F1.2 pure normalizer extraction** with `parseFlightInput(FormData)` retained as the compatibility boundary.

### Flight Entry Workflow 3.0 — F1.0 historical aircraft identity preservation
- Added base database migration **v17 — historical flight aircraft identity preservation**.
- Replaced the v6 aircraft-identity trigger behavior without rewriting the already-applied v6 migration.
- Ordinary Manual/GPS-style INSERTs with an empty make/model/variant tuple still snapshot the current matching aircraft profile.
- INSERTs carrying any explicit make/model/variant member now preserve the supplied tuple atomically instead of mixing or overwriting it from mutable current profile state.
- Registration-changing UPDATEs still snapshot identity for the new registration.
- Same-registration UPDATEs no longer refresh historical identity from mutable current profile state.
- Exact backup restore remains compatible with its existing two-stage flow: staged empty identity insert followed by explicit identity restore.
- Added source-contract coverage plus PostgreSQL acceptance for existing certified rows, ordinary inserts, conflicting recipient profiles, partial explicit tuples, same-registration updates, actual registration changes, restore-style second-stage writes and idempotent reapplication.
- **Historical rows:** no existing flight is rewritten or guessed/backfilled by this migration.
- **Certification:** no certification payload/hash/version change.
- **Verification:** final PR head: Verify FlyTally web #997 PASS; TypeScript PASS; full unit/regression **992/992**; PostgreSQL acceptance **76/76**; Browser smoke #378 **26 passed / 2 skipped** across desktop/mobile; production build PASS. Early #987/#989/#371 failures exposed only migration/test-harness defects (PL/pgSQL delimiter, stale v16 fixture extraction, and browser fixture schema drift); each was corrected and the final gates passed.
- **Production:** PR #191 merged as `e7361dbe3e55fbba721ec01c2bffd5c885452c12`; Vercel deployment `dpl_EiEU6pWp95nQuNRGwGVTgtLrgSJn` is READY on `fly-tally.com`. Production Neon records migration v17 `historical flight aircraft identity preservation` applied at 2026-10-01 06:47:01 UTC; the live function/trigger definition was read back and matches the reviewed v17 behavior.

### Flight Entry Workflow 3.0 — F1 design / independent review
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_DESIGN.md` with the proposed source-adapter → typed candidate → pure normalizer → `FlightInput` architecture.
- Kept `parseFlightInput(FormData)` as the proposed compatibility wrapper to minimize Manual blast radius.
- Explicitly kept GPS tracks, expenses, connected crew, certification lifecycle and participation/verifications outside the canonical flight semantic payload.
- Split the proposed implementation into F1.1–F1.6 so Manual regression equivalence is proven before GPS is routed through shared normalization.
- Raised Operation/Engine as a blocking correctness question because current GPS silently stores SP plus class-derived engine, which is not sufficient source evidence for every FCL-style flight.
- Carried the shared-flight identity-trigger issue forward as a migration/integrity design question; no migration has been written.
- Added `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_REVIEW_HANDOFF.md` for independent read-only review before runtime implementation.
- Independent review returned **APPROVE WITH CHANGES** and was reconciled into the F1 design: F1.0 trigger hotfix first; explicit EASA GPS Operation/Engine before F1 release; unresolved source evidence remains fail-closed; F2 retains Role/Crew ownership.
- **Runtime/schema behavior:** unchanged in this design PR; F1 runtime code has not started.

### Flight Entry Workflow 3.0 — F0 field / consumer contract inventory
- Added the authoritative repository-backed Manual/GPS/Edit/Certification/consumer matrix at `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md`.
- Recorded the current Manual canonical parser boundary versus the remaining GPS direct semantic INSERT path.
- Classified Save requirements separately from Certification requirements, including the existing DUAL UI/server Save-boundary mismatch.
- Recorded certification-hash v1–v8 coverage and explicitly classified non-hashed child/commercial/collaboration data.
- Recorded draft-visible Dashboard/Statistics/Export/Print behavior versus certified-only canonical Recency and certified-source Sharing.
- Recorded GPS parity gaps for sailplane launch evidence, PF movements/approaches, day/night fidelity, night/IFR, professional context, purpose, expenses and non-PIC Role/Crew.
- Identified a cross-workstream historical-identity risk for review: shared-flight INSERT supplies certified source make/model/variant while the v6 flight INSERT trigger can overwrite those fields from recipient current-profile state.
- Recorded CSV/XLS output completeness gaps without changing stored semantics.
- Added source-contract tests to keep the F0 findings explicit before F1 refactors them.
- **Runtime/schema behavior:** unchanged by F0 analysis.
- **Verification:** Verify FlyTally web #982 PASS; TypeScript PASS; full unit/regression **988/988**; PostgreSQL acceptance **55/55**; browser N/A; DB schema/migration N/A. The first #981 attempt exposed only an outdated test assertion for the existing v8 certification hash call and was corrected without runtime changes.

### Flight Entry Workflow 3.0 — F0.1 GPS fail-closed integrity hotfix
- Removed GPS UI/server fallbacks that could silently turn missing aircraft class/logbook context into `ULL`.
- GPS now resolves the selected active aircraft through the same fail-closed aircraft-profile validation used by New Flight defaults; malformed/unavailable context returns **Needs configuration** instead of invented regulatory identity.
- GPS no longer trusts submitted aircraft class/logbook/type as authoritative identity: the active selected aircraft profile is resolved server-side and submitted class/logbook must match that canonical context.
- Interim GPS Role support is intentionally narrowed to **PIC only**; DUAL, Safety Pilot, INSTRUCTOR/legacy `INSTRUKTOR`, Co-pilot, PAX, Observer and crafted unknown roles fail closed until the shared Role/Crew milestone provides complete semantics.
- Removed the visual-review-only hard-coded `ULL` provenance placeholder.
- Preserved existing GPS split/review, duplicate fingerprint, advisory-lock and single-transaction flight/track persistence behavior.
- Added F0.1 domain/source regression coverage plus authenticated browser fixtures for valid EASA/SEP, valid explicit ULL and malformed EASA aircraft context.
- No database schema/migration, certification hash/version, recency rule, historical backfill or broad UI redesign is introduced.
- **Verification status:** PASS on final runtime head before docs closeout — Verify FlyTally web #979: TypeScript PASS, full unit/regression **979/979**, PostgreSQL acceptance **55/55**; Browser smoke #366: production build PASS, authenticated Chromium desktop/mobile **26 passed / 2 skipped**.

### Flight Entry Workflow 3.0 — F0.0 characterization
- Added a characterization-only baseline for the current GPS flight-entry/write path; no runtime behavior changes in this milestone.
- Confirmed UI and server fail-open `ULL` fallbacks, direct GPS flight persistence outside `parseFlightInput()`, empty GPS commander/instructor persistence and draft consumption by Dashboard/Statistics/Export/Print while recency remains certified-only.
- Confirmed the GPS INSTRUCTOR option currently submits non-canonical stored value `INSTRUKTOR`, which receives zero function-time allocation; F0.1 therefore uses **PIC only** as the smallest proven coherent interim GPS role set.
- Added source regression coverage for the current defect/baseline, role mismatch, Manual save-boundary differences, duplicate/advisory-lock transaction behavior and downstream draft-consumer boundary.
- Detailed evidence: `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F00_CHARACTERIZATION.md`.
- **Verification status:** DONE — Verify FlyTally web #970 PASS; TypeScript PASS; full unit/regression 971/971 PASS; PostgreSQL acceptance 55/55 PASS. No runtime/schema/deployment change.

### Flight Entry Workflow 3.0 — planning/design freeze
- Added the frozen `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md` contract after Claude Round 1, DeepSeek Round 2 and repository reconciliation.
- Reprioritized the roadmap so the confirmed GPS invalid-profile → `ULL` fail-open defect is addressed before Multi-aircraft M2B.
- Frozen direction: one canonical Manual/GPS semantic normalization boundary; GPS as source/provenance rather than a second flight model; source-agnostic Role/Crew semantics; atomic multi-part persistence; no guessed historical repair.
- Frozen EASA entry behavior: DUAL Instructor/PIC, Safety Pilot Actual PIC and SPIC/PICUS supervision evidence must be immediately reachable and Save-required; certification remains the authority for later certification completeness.
- Recorded the repository-backed consumer boundary: recency is certified-only, while Dashboard/Statistics and Export/Print can consume draft records, increasing the importance of correct evidence/class identity at first Save.
- Defined F0.0 as characterization-only and F0.1 as the minimal GPS fail-closed production hotfix before broader domain/UX convergence.
- This planning change does **not** modify runtime, schema, certification hash/version, recency calculations, GPS persistence or production deployment.

### New Flight intelligent review — form-scope hotfix
- Bound `IntelligentFlightEntryPanel` explicitly to the canonical manual `FlightForm` instead of selecting the first `.flight-form` mounted on the page.
- Prevented manual-entry history/profile advisories from being portaled into the simultaneously mounted GPS import form.
- Deferred intelligent-review FormData resync to the next animation frame after input/change so React-controlled aircraft profile fields are read after their coordinated update rather than from an intermediate DOM state.
- Added source regression coverage plus an authenticated browser reproduction with three recent EASA/SEP records proving a GPS-selected EASA/SEP aircraft does not receive a stale ULL history warning.
- GPS import save/parsing, aircraft profile data, historical flights, certification, recency, billing and persistence semantics are unchanged.

This section tracks changes intended for the next named release. An entry is production-complete only after the corresponding change has been merged to `main`.

### New Flight UI/UX Simplicity — B5 responsive + accessibility closeout
- Delayed ordinary required-field error styling until an explicit save attempt while keeping genuine selected-profile configuration failures immediately visible.
- Converted the existing missing-field summary into focusable blocker navigation that opens the owning native disclosure before focusing its control.
- Preserved native details/summary semantics without redundant ARIA state.
- Restored collapsed evidence summaries on narrow mobile, added earlier iPad/zoom grid reflow and disabled sticky New Flight actions where touch keyboards or very small/short viewports could cause overlap.
- Added coarse-pointer 44px targets and forced-colors treatment for blocker controls.
- Switched the small Flight-experience Change cue to the normal link token; measured canonical New Flight muted/link colors meet WCAG AA normal-text contrast on dark/light panel surfaces.
- Final authenticated screenshot review exposed Flight experience empty-state title/explanation concatenation at 320px/200% reflow; PR #182 fixed it with contextual spacing while preserving the canonical `empty-state` design-system contract.
- No parser, persistence schema, certification payload/hash, recency, collaboration, billing or UTC semantics changed.
- **Verification status:** DONE. PR #179 automated gate PASS; PR #182 Verify FlyTally web #955 PASS and Browser smoke #349 PASS. Final isolated authenticated Browser smoke #352 PASSed with 23 browser tests passed / 3 skipped and produced 132/132 New Flight screenshots (11 states × 6 viewports × light/dark); all 132 matrix records reported 0 px horizontal overflow. Production commit `45a97aacec50e9e7b20d676afd4493c2e896c1fe` is READY on Vercel and aliased to `fly-tally.com`. PostgreSQL schema/migration N/A for the presentation-only closeout.

### New Flight UI/UX Simplicity — B4 optional details + helper-copy triage
- Consolidated Training purpose/Task, Night/IFR, Professional context, Costs/expenses and Notes under one native **Optional details** disclosure.
- Populated Edit records now auto-open Optional details and summarize which optional domains already contain stored/current data.
- Moved Night/IFR duration inputs out of Flight experience while preserving the same form/parser contract and surfacing historical stored values for correction.
- Kept malformed billing fail-closed and auto-opened the containing Optional details disclosure.
- Added embedded Professional context presentation while preserving its existing applicability and hidden-input behavior.
- Removed or compacted repeated aircraft-profile, generic role, cost and Task helper prose while keeping validation, Connection and signed-evidence consequences visible.
- No parser, persistence schema, certification payload/hash, recency, collaboration, billing or UTC semantics changed.
- **Verification status:** merge-ready — TypeScript PASS, reconciled targeted contracts 34/34 PASS, full unit/regression 954/954 PASS, production build PASS on the runtime-equivalent B4 head. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B3 profile + role context
- Aircraft & logbook collapsed summary now exposes actual evidence/logbook, regulatory category, aircraft class and applicable operation/engine context instead of relying on a generic category description.
- Preserved selected-profile origin on new entry while avoiding re-deriving Edit snapshot provenance from mutable current aircraft profiles.
- Invalid or unresolved selected-aircraft context forces the profile disclosure open.
- Replaced **Crew & training** with role-driven **Role details**; DUAL, Safety Pilot, SPIC and PICUS required evidence auto-opens in one contextual area.
- Moved structured Training purpose and Task/exercise into **Optional details** while keeping FlightPurposePicker hidden submission semantics unchanged.
- No parser, persistence schema, certification payload/hash, recency, collaboration, UTC or billing semantics changed.
- **Verification status:** merge-ready — TypeScript PASS and production build PASS; reconciled targeted contracts 22/22 PASS; full unit/regression 946/946 PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B2 essentials + movement evidence
- Reordered the always-visible essentials to Date → Registration → Role, followed by grouped Route and one chronological UTC timeline.
- Kept Departure/Arrival and all time fields optional for draft save; certification remains the authority for route/time completeness.
- Preserved live BLOCK/AIR calculation and the `—` unavailable state without inventing `0:00`.
- Flight experience summary now exposes the actual landing/PF evidence-bearing preset state, with a visible Change cue while keeping detailed movement controls behind the same native disclosure.
- Reduced repeated manual-entry intro copy and made Add aircraft contextual when the pilot already has aircraft.
- Added responsive B2 layout rules for desktop, iPad-width and narrow mobile time grids.
- No parser, persistence schema, certification payload/hash, recency or billing semantics changed.
- **Verification status:** merge-ready — local TypeScript PASS, targeted B2/affected historical contracts 47/47 PASS, full unit/regression 940/940 PASS, production build PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to cumulative live New Flight verification and is not reported as PASS.

### New Flight UI/UX Simplicity — B1B completion semantics
- Removed the duplicated inline **Review before save** card and the second `Ready to save` completion state from New Flight.
- New Flight keeps one form-level blocker/consequence surface and one primary **Save & review** action; Edit keeps **Save changes**.
- Removed initial **Save and add another** and moved **Add another flight** to the successful saved-review handoff.
- Relocated selected-aircraft/profile origin and unsaved-change context instead of discarding unique information from the removed review card.
- Preserved the existing `/flights/<id>?tab=logbook&saved=1` review-first handoff, draft-save semantics, certification blockers and PendingActionButton duplicate-submit protection.
- No schema, certification payload/hash, recency, UTC or optional-cost semantics changed.
- **Verification status:** merge-ready — local TypeScript PASS and production build PASS; reconciled targeted B1B/historical contracts 34/34 PASS; full unit/regression 934/934 PASS. PostgreSQL N/A; authenticated UI smoke remains deferred to the later live cumulative New Flight redesign check and is not reported as PASS.

### New Flight UI/UX Simplicity — B1A optional Costs
- Added an explicit optional billing parser/serializer so blank billing means **Not tracked** instead of silently becoming BLOCK.
- New Flight and GPS import can save otherwise-valid records without aircraft-cost tracking; populated malformed billing still fails closed.
- Aircraft profile defaults now support explicit no-billing configuration while preserving configured BLOCK/AIR + share values.
- Untracked flights do not resolve or snapshot an aircraft hourly rate, and dashboard/list cost aggregates treat them as zero cost contribution instead of implicit BLOCK.
- Aircraft sharing preserves no-billing defaults and rejects/surfaces malformed populated billing rather than silently clearing or repairing it.
- Read-only billing labels distinguish **Not tracked** from malformed persisted billing (**Unavailable**).
- Legacy billing helpers remain compatible for untouched historical callers; certification, recency, UTC and crew-credit contracts are unchanged.
- **Verification status:** merge-ready — TypeScript PASS; targeted B1A 35/35 PASS; stale-contract rerun 55/55 PASS; full unit/regression 928/928 PASS; production build PASS; read-only production DB metadata confirms both billing columns are nullable text with legacy BLOCK defaults and no billing CHECK constraints, so no migration is required. Protected Preview was READY but authenticated smoke is explicitly deferred to a live post-merge check because Preview has no DATABASE_URL; the deferred check is not reported as PASS.


### New Flight UI/UX Simplicity — B0.5 integrity baseline
- Added a fail-closed selected-aircraft profile-default resolver that reuses the canonical M1 validator and rejects defaults when validation would repair or replace the stored evidence/class.
- Valid ULL profiles remain ULL; invalid/missing legacy profile context now surfaces as **Needs configuration** instead of silently falling back to ULL.
- Preserved stored same-aircraft Edit snapshots; changing to another aircraft and back restores the original stored aircraft-dependent snapshot instead of leaving mixed temporary-profile state.
- Added a complete golden EASA SEP PIC `parseFlightInput()` payload baseline plus source coverage proving manual Create and Update continue through the same canonical parser.
- Recorded the approved Role / normal landing / PF preset policy and scenario-specific decision-density baseline for later UX comparison.
- No schema, certification hash/version, recency calculation, connection/PIC materialization or UTC semantics changed.
- **Verification status:** PASS — targeted B0.5/M1/manual-entry/input suite 26/26, full suite 916/916, production build PASS; TypeScript PASS on the runtime-equivalent head and again inside the final production build. PostgreSQL N/A; dedicated browser matrix deferred by design to the presentation batches because B0.5 does not alter the normal validated-aircraft fixture path.


### General PIC invitation across source roles
- Generalized explicit post-certification `PIC` invitation beyond Safety Pilot to every recognized canonical stored source role.
- Added schema migration v16 with invite-time PIC commander provenance (`CERTIFIED_SOURCE_COMMANDER` vs `RECIPIENT_ACCOUNT`) and one-active-PIC-per-source-revision protection.
- Preserved the dedicated Safety Pilot Actual-PIC workflow and certified source commander semantics.
- Added generic PIC sharing through Crew & logbook sharing, with accepted-Connection, exact revision/hash, owner and re-share guards.
- Generic PIC materialization uses recipient account commander semantics and carries the complete certified event data while recalculating recipient role/credit as PIC.
- Added source/unit and PostgreSQL acceptance coverage for provenance, migration constraints, generic INSTRUCTOR→PIC materialization, movement/night/IFR copy, duplicate/reinvite and active-PIC guards.
- **Verification status:** local TypeScript PASS; 909/909 unit/regression PASS; production Next.js build PASS; PostgreSQL full acceptance 66/66 PASS across 24 integration files; authenticated Chromium desktop/mobile 22/22 PASS; migration v16 validated, applied to production Neon after explicit approval, and post-verified.
- PR #169 merged as `a51e8bb13f702c9a04337bff19755ad614ccfcc1`. Vercel production deployment `dpl_9ba1sxfaZ1yyBVPFwcBdF3S9B8W3` reached READY and the canonical public endpoint returned HTTP 200.

### Safety Pilot ↔ PIC lifecycle closeout — SP5
- Added release-level lifecycle coverage for certified-source corrections, pending invitation supersession, cancellation, decline and PIC reinvitation.
- Verified source correction preserves the connected-PIC link and does not rewrite already materialized recipient-owned records.
- Verified PIC reinvite may reopen declined/cancelled requests but cannot reset accepted/materialized participation.
- Kept certification payload/version unchanged and introduced no new schema migration.
- Extended authenticated browser coverage through cancel → reinvite → pending → cancel and revoked-Connection fail-closed behavior.
- Verification: 900/900 unit/regression PASS; PostgreSQL core 48/48 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS; production build PASS.
- Existing migration v15 remains the production-verified prerequisite; SP5 itself has no database migration.
- PR #166 merged; the Safety Pilot ↔ PIC workflow is complete in the repository through SP1–SP5. Production deployment status is tracked separately.

### Safety Pilot ↔ PIC materialization + recency — SP4
- Enabled the dedicated Safety Pilot → PIC participation to materialize an independently owned recipient PIC flight.
- Recipient PIC commander now comes from the certification-protected source `commander`; existing non-PIC materialization behavior is unchanged.
- Added PIC-only acceptance/materialization guards for exact source revision/hash, source Safety Pilot role and a live accepted Connection.
- PIC minutes use the canonical crew-credit path; the source Safety Pilot record remains non-PIC credit.
- Shared-flight PIC preview preserves the certified source commander.
- Added recency proof showing a materialized PIC record behaves like an equivalent ordinary PIC record while the source Safety Pilot contributes no qualifying PIC movements.
- Added PostgreSQL acceptance for independent ownership, duplicate reuse and revoked-Connection fail-closed behavior.
- Verification: 895/895 unit/regression PASS; PostgreSQL core 48/48 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS; production build PASS.

### Safety Pilot ↔ PIC certified invitation — SP3
- Added a dedicated post-certification Actual PIC invitation action for certified Safety Pilot flights.
- The recipient is derived only from persisted connected-PIC metadata; no arbitrary client-supplied PIC participant ID is accepted.
- Invite creation rechecks source ownership, Safety Pilot role, certification hash/revision state and live accepted Connection status.
- Kept PIC excluded from the generic crew-sharing selector and rejected by the generic invite action.
- Added a separate certified Actual PIC panel with pending/cancel/reinvite states and live revoked-Connection fail-closed messaging.
- Kept recipient PIC materialization intentionally blocked for SP4.
- Verification: GitHub Verify FlyTally web PASS; 890/890 unit/regression PASS; PostgreSQL core 47/47 PASS across 20 files; authenticated Chromium desktop/mobile 22/22 PASS.

### Safety Pilot ↔ PIC create/edit identity — SP2
- Added an explicit Safety Pilot Actual PIC choice between manual text and an accepted FlyTally Connection; manual entry remains the default and no name matching is used.
- New Flight loads accepted pilot Connection IDs/names separately from instructor suggestions.
- Connected selections are canonicalized server-side from the selected account's current display name after accepted-Connection revalidation.
- Create/Edit synchronize the flight row, expenses and current connected-PIC metadata atomically; switching to manual entry or away from Safety Pilot removes the link.
- Edit/correction reloads stored connected identity by flight ID, including a fail-closed unavailable state when the Connection is no longer accepted.
- SP2 does not send PIC invitations or create participation rows; certified sharing remains staged for SP3.
- Added SP2 source/regression and browser-contract coverage. Final verification: TypeScript PASS, 885/885 unit/regression PASS with 0 fail / 0 skip, production build PASS, isolated Neon persistence acceptance PASS, and authenticated isolated Vercel Preview acceptance PASS across desktop, mobile and iPad layouts. Preview testing found and fixed a repeated-save controlled-field reset before merge.

### Safety Pilot ↔ PIC foundation — SP1
- Added tracked schema migration v15 for separate `flight_connected_crew` collaboration metadata with owner-bound FK, one-PIC-per-flight uniqueness, self-link rejection and cascade cleanup.
- Extended shared-flight participation role storage/domain normalization to `PIC`, with an explicit fail-closed `SAFETY PILOT → PIC` combination and canonical PIC-minute credit semantics.
- Added connected-PIC persistence helpers that require an editable Safety Pilot source flight and an accepted Connection before a link can be written.
- Kept the staged rollout fail-closed: PIC is excluded from the legacy generic crew selector, rejected by its generic server action, and not materialized until the later dedicated PIC workflow milestone.
- Added unit/source and PostgreSQL contract coverage for migration, constraints, role mapping and write guards.
- Verified SP1 with TypeScript PASS, 875/875 unit/regression PASS, production build PASS, and isolated Neon PostgreSQL acceptance over real migration constraints and fail-closed write guards.
- Deleted the isolated Neon acceptance branch after verification, then applied the exact verified migration v15 to the production Neon branch as the deployment prerequisite after explicit approval; post-migration checks confirmed the new table/constraints and zero collaboration rows.
- No Safety Pilot PIC selection/invitation UI is shipped by SP1; `FEATURES.md` therefore remains PLANNED.

### GPS touch-and-go detection reliability
- Reproduced a real missed rolling touch-and-go caused by an unrelated near-zero-timestamp altitude pair remaining inside a sparse ±10-point discontinuity window.
- Added anonymized regression coverage proving equivalent touchdown geometry must classify the same despite harmless post-climb point-density differences.
- Bounded rolling-T&G altitude-discontinuity checks to the candidate's own nearest +30 m descent/climb evidence span.
- Kept the existing 28–145 km/h rolling-speed and 30 m descent/climb thresholds unchanged.
- Preserved fail-closed rejection when timestamp/altitude corruption occurs inside the qualifying T&G evidence span.
- Left take-off discontinuity behavior and unrelated point-count grouping/dedup logic unchanged.
- GPS-derived landing totals remain advisory and user-reviewed; no DB/schema/certification behavior changed.

### Multi-aircraft Product Scale — M2A
- Changed type-specific helicopter recency to resolve historical type from stored `flights.aircraft_model`, with bounded legacy fallback to stored `flights.aircraft_type`.
- Removed mutable current-aircraft model and registration as silent historical type fallbacks.
- Added fail-closed LIMITED DATA handling when unresolved historical helicopter type evidence could satisfy an otherwise missing type-specific requirement.
- Kept independently proven CURRENT results current; unresolved unrelated flights do not downgrade them.
- Added PostgreSQL and unit/source regressions proving current profile model edits cannot rewrite historical type resolution.
- No flight rows, certification payload versions/hashes, schema or ULL/Annex-I mapping semantics changed.

### Multi-aircraft Product Scale — M1
- Added one canonical server-side aircraft-profile validator for regulatory profile state.
- Routed normal Aircraft Add/Edit and accepted shared-profile imports through the same fail-closed validation contract.
- Rejected explicit class/category mismatches, incomplete EASA identity, invalid/non-applicable BFCL class/group data and malformed explicit Part-FCL credit provenance instead of silently repairing them.
- Added an actionable shared-profile error path when a received profile cannot be imported safely.
- Added full profile-matrix/source regressions and PostgreSQL acceptance proving malformed shared regulatory profiles do not reach persistence.
- Kept exact backup/restore outside interactive profile canonicalization; no schema, certified-flight payload/hash, catalogue-authority or ULL/Annex-I semantics changed.

### Documentation governance
- Consolidated the roadmap into one current planning document.
- Added a canonical `FEATURES.md`.
- Added a documentation index and historical archive under `docs/history/`.
- Moved old version-specific scope/audit notes out of the repository root without deleting their evidence from Git history.

### Design consistency audit — Batch 9
- Added branded root not-found and runtime-error fallbacks using existing FlyTally page/panel/button contracts.
- Kept runtime error presentation non-technical and added retry plus safe root navigation.
- Replaced the bespoke Push onboarding glass surface with the canonical raised-surface tokens while preserving placement and behavior.
- Closed UX-027 without a visual change after confirming the effective login-card cascade was already 11 px with no backdrop blur.

### Design consistency audit — Batch 10
- Standardized sign-in/join email terminology while preserving the more specific Account email label in Settings.
- Replaced decorative Dashboard lead phrasing with operational all-time totals / Statistics guidance.
- No authentication, input behavior, dashboard calculation, regulatory or stored-data semantics changed.

### Design consistency audit — Batch 11
- Added an explicit non-blocking offline connection banner with automatic online/offline event handling.
- Kept the service worker online-only: no navigation/API interception, offline cache or offline logbook mutation was added.
- Added source-contract and real-browser coverage for banner appearance/removal.

## v3.3 design & workflow consistency — merged through 2026-09-20

### Workflow simplification
- Simplified New flight while keeping aircraft and route selection explicit rather than silently prefilled.
- Simplified the Flights workflow and restored an obvious compact Open action.
- Unified aircraft-card layout and added safe aircraft deletion.

### Design-system consistency
- Consolidated shared tokens, geometry, spacing and tabular numeric presentation.
- Improved light-theme text contrast and moved the legacy GPS chart to theme-aware chart tokens.
- Replaced OS-dependent functional glyphs with the shared SVG icon system.
- Converged empty/loading/component states.
- Hardened accessibility, focus and touch-target behavior.
- Clarified required-field and validation presentation.
- Standardized UTC, viewer-timezone and date-only display formatting.
- Normalized protected secondary route rhythm, Share headers and public/legal layout.

### Engineering workflow
- Reduced unnecessary GitHub Actions usage while retaining risk-based verification gates.

The approved design-consistency audit is complete through Batch 11.


## v3.2 — UI consistency & verification foundation — 2026-09-19

### Changed
- Added route-level UI consistency auditing and shared UI-system regression coverage.
- Added real-browser smoke coverage plus authenticated browser and mutation coverage.
- Added transaction-backed authenticated mutation tests for higher-risk write paths.
- Unified aircraft-card presentation and added safe aircraft deletion.
- Reduced unnecessary GitHub Actions usage while retaining risk-based verification gates.

## v3.0 — UX & Product Consolidation — 2026-09-18

### Changed
- Simplified global Logbook navigation around pilot tasks and moved Notifications into the live activity model.
- Simplified Licences & Recency, Aircraft & airports, Print & data and Settings hierarchies.
- Added personal aircraft-profile sharing and cover photos while keeping recipient copies independently owned.
- Added Web Push subscriptions, preference controls and contextual onboarding.
- Clarified the save → review → certify → share workflow.
- Closed the mobile/accessibility acceptance pass for core Logbook workflows.
- Added/refined the public interactive flight viewer and Share presentation.

### Integrity
- UX consolidation did not redefine certified-record, recency, ownership or regulatory evidence semantics.
- A later FCL.060 ULL same-class correction was merged as an explicit regulatory fix rather than hidden inside UX work.

## v2.9 — Commercial & External Validation technical foundation — 2026-09-18

### Added
- Fail-closed commercial-readiness contract and external-validation ledger.
- Versioned commercial legal publication boundary.
- Provider-neutral billing/entitlement technical foundation.
- Signature-assurance and regulatory-validation boundary.
- Brand/public-claims boundary.
- Final commercial release audit and build guard.

### External boundary
- Technical implementation does not equal lawyer, regulator, trademark, payment-provider or other external approval.
- Public commercial release remains dependent on real external evidence and business decisions where required.

## v2.8 — Compliance & Safety Foundation — 2026-09-18

### Added / changed
- Added privacy self-service, retention controls and cross-product erasure coordination.
- Hardened regulator-facing logbook identity and source-of-truth handling.
- Finalized reviewed map-provider/licensing behavior and browser security controls.
- Added compliance regression coverage for legal, sharing, provider and aviation-safety boundaries.

### Integrity
- Authority acceptance is not inferred from internal implementation or tests.
- FCL.050-oriented engineering traceability remains separately documented under `docs/compliance/`.

## v2.7.1 — Recency hotfixes — 2026-09-09

- Fixed the Recency expiry-date SQL type mismatch.
- Fixed Recency light-theme readability.
- No intentional regulatory-rule expansion was bundled into these hotfixes.

## v2.7 — Data Integrity & Recovery 2.0 — 2026-09-08

### Changed
- Made restore review-first with explicit missing/present/protected-conflict preview.
- Added authenticated current-format portable backup integrity while retaining bounded legacy compatibility.
- Preserved certified revisions, signatures, GPS, sharing evidence, audit history, licences, expenses and recency evidence through the canonical recovery path.
- Added tested large-account transaction batching while preserving atomicity/safety limits.

## v2.6 — Professional Pilot Workspace 2.0 — 2026-09-08

- Expanded professional/operator context and professional-experience reporting.
- Preserved recorded-evidence vs regulatory/employment-conclusion boundaries.
- Kept professional context explicit instead of silently inferring CAT/NCC/SPO or employment status.

## v2.5 — Recency & Compliance Workspace — 2026-09-08

- Consolidated licence/rating validity, flying recency and supporting evidence into a planning-oriented workspace.
- Kept CURRENT / ACTION SOON / NOT CURRENT / INCOMPLETE EVIDENCE evidence-driven and explainable.
- Linked recency presentation to supporting flights, training, signatures and credentials without rewriting certified records.

## v2.4 — Flight Entry & Review 2.0 — 2026-09-08

- Kept one canonical Add flight workflow while integrating review findings near their owning fields.
- Added explicit saved-vs-GPS review before applying GPS-derived suggestions to an existing flight.
- Added final logbook-data review before certification/sharing while preserving certification hashes, revisions and regulatory calculations.

## v2.3 — Large Logbook Performance & Scalability — 2026-09-07

- Retained 10k/50k scale gates and added a controlled 100k read-performance benchmark for production hot paths.
- Reduced Dashboard/Statistics/Print hot-path work through leaner projections, set-wise lookup and scoped aggregation.
- Preserved v2.2 workflow semantics and certified-data integrity while improving scale behavior.

## 2.2.0 — Action Center & Shared Flight Workflow — 2026-09-07

### Added
- Added an authoritative Action Center for unresolved flight invitations, instructor verification requests, aircraft-training signatures and incoming pilot connection requests.
- Sidebar and Dashboard now surface Actions only while a real workflow decision is pending; the badge is derived from workflow state rather than unread notification state.

### Changed
- Notifications remain the update/history inbox and no longer act as the global pending-work signal.
- Needs attention remains separate and continues to contain only actionable data-quality findings from the pilot's own logbook.
- Shared-flight and signature requests reuse the existing Review & add, Review & sign and Decline workflows; inline Action Center decisions disappear immediately after completion.

### Integrity
- Pending shared-flight actions require the exact current certified source revision and hash, so stale requests do not create ghost actions.
- Legacy instructor approvals are de-duplicated when the canonical instructor participation exists, while that participation still counts once as the real action.
- Modern `signature_request` notifications now support the same direct Decline path as other shared-flight requests.
- No database schema, certification fingerprint, verification payload, sharing ownership or audit-trail semantics changed.

## 2.1.0 — Dashboard & Statistics consolidation — 2026-09-07

### Changed
- Dashboard is a stable all-time at-a-glance home without historical period controls; period analysis lives in Statistics.
- Historical Dashboard period URLs hand off to the equivalent Statistics scope instead of silently losing the selected period.
- Career snapshot is a dedicated Statistics workspace and no longer lengthens Overview; its all-time nature is explicit and its period selector is hidden.
- Existing Dashboard saved-layout migration/customization remains intact and analytical widgets cannot be re-added to Dashboard.

### Preserved
- v2.0 category-aware logged-time, certification, sharing, print/export and Dashboard Safety Pilot semantics are unchanged.
- No database schema, regulatory calculation or credential workflow changed in this release.

## 2.0.0 — Multi-category Pilot Logbook — 2026-09-07

### Added
- One canonical regulatory-category capability model for Aeroplane, Helicopter, Sailplane, Balloon, ULL and conservative Other records.
- Category-specific evidence and progressive disclosure inside the existing Add/Edit flight workflow rather than separate category-specific entry pages.
- Multi-category Flights presentation, filters, Statistics, Dashboard, Print/Export and pilot-context handling built on the same category contract.

### Regulatory integrity
- Historical TMG remains Part-FCL unless an explicit Sailplane / Part-SFCL snapshot exists; legacy GLIDER and BALLOON records remain conservatively resolvable without rewriting certified history.
- Part-FCL Aeroplane/Helicopter certification keeps the existing FCL.050 gate, while SFCL/BFCL records are no longer evaluated with aeroplane SP/MP, SE/ME or BLOCK-time assumptions.
- Sailplane/Balloon credited time uses AIR semantics where applicable; powered/ULL activity retains BLOCK semantics. Safety Pilot remains dashboard activity only and does not inflate regulatory pilot experience.
- Certification fingerprints, certified revisions, sharing, trash/restore and portable backup preserve category, launch and BFCL evidence.

### Hardening and release gate
- Conservative runtime migrations do not rewrite certified historical category evidence.
- RC acceptance covers historical accounts, certification, sharing, backup/restore and mixed-category PostgreSQL behavior.
- The release gate includes TypeScript, complete regression tests, PostgreSQL acceptance, retained 10k/50k scale evidence, production Next.js build and Vercel production verification.

## 1.62.0 — Sailplane / SPL / TMG support — 2026-09-01

### Added
- Explicit aeroplane/sailplane regulatory context so TMG records are not silently reclassified between Part-FCL and Part-SFCL.
- Non-TMG sailplane launch method/count evidence and explicit SPL TMG day/night take-off evidence.
- SPL recency evaluation for sailplane/TMG privileges, passenger currency, launch-method recency and proficiency-check evidence.
- Portable backup v9 coverage for SPL proficiency-check evidence.

### Integrity
- Flight certification fingerprint v5 protects regulatory category and launch evidence while historical v1-v4 fingerprints remain verifiable.
- Sharing and trash/restore preserve the new regulatory/launch fields.
- Sailplane protected-record presentation is labelled Part-SFCL rather than FCL.050.

### Preserved
- Existing TMG history remains Part-FCL unless SPL context is explicit.
- GPS never invents launch methods.
- SPL TMG take-offs remain separate from Part-FCL FCL.060 PF movement evidence.

## 1.61.0 — Category-aware Flight Entry — 2026-09-01

- Blank New flight remains neutral until an aircraft is selected.
- Aircraft-dependent experience controls adapt to the selected profile category inside the existing Add flight workflow.
- Role remains flight-specific and is never replaced by aircraft selection.
- The category layer is presentation-only; existing regulatory calculations remain authoritative.

## 1.60.1 — Licences Navigation Cleanup — 2026-09-01

- Kept section tabs as the single normal Licences navigation layer.
- Kept status rows compact and read-only while detailed evidence remains in dedicated sections.

## 1.60.0 — Adaptive Pilot Workspace — 2026-09-01

- Added an adaptive Licences Overview that shows only relevant credentials, privileges and documents.
- Separated credential validity from flying recency and kept items needing attention prominent.
- Continued to delegate LAPL(A) recency to the existing authoritative Recency Engine.
- Added presentation-only pilot-category classification as groundwork for additional aircraft/licence categories.

## 1.59.2 — Manual Entry Defaults & Aircraft Profile Integrity — 2026-09-01

- New manual flights no longer preselect the previous aircraft registration.
- Departure no longer inherits the previous arrival or configured home airport.
- Aircraft-dependent logbook/class/billing state remains neutral until the pilot explicitly selects an aircraft.
- Explicit aircraft selection reapplies the complete aircraft-dependent profile state (type, logbook, class, engine derivation, operation mode baseline, billing/share and hourly rate) in one interaction.
- Flight-specific role remains untouched when changing aircraft, preserving the v1.53.1 state-integrity boundary.
- Additional expenses and all v1.59 financial behavior are unchanged.

## 1.59.1 — Database Migration Hotfix — 2026-09-01

- Fixed production startup failure `Unknown database migration 14`.
- Added the v1.59 structured-expense schema to the primary sequential database migration runner.
- No flight, regulatory, certification, expense ownership or currency semantics changed.

## 1.59.0 — Flight Entry Structure & Expenses — 2026-09-01

### Added
- Structured personal flight expenses: Landing fee, Handling, Parking, Fuel or a custom Other item, each with amount and currency.
- Currency-grouped totals with no implicit FX conversion.
- Portable backup v8 and trash/restore coverage for personal expenses.

### Changed
- Reorganized manual entry into Flight essentials, Flight experience, Crew & training, Aircraft & logbook, Costs and Notes.
- Day/night landings, Night/IFR time and EASA PF/movement evidence now live together under Flight experience.
- SPIC/PICUS countersignature evidence now lives with Crew & training.
- Notes are no longer mixed into Costs.

### Privacy & certification boundary
- Additional expenses are owned by the current user and are not copied to shared-flight participants.
- Expenses remain outside the certified flight fingerprint/revision, so financial metadata can be maintained without rewriting regulatory evidence.

### Verification
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V159.md`.

## 1.58.0 — Flight Entry Polish & Smart Defaults — 2026-09-01

### Removed
- Quick Routes from New flight, including the unnecessary recent-route query on that page.

### Changed
- Local flight is now a small contextual `Use DEP for local flight` action below Arrival rather than a separate route-shortcut block.
- Aircraft-profile defaults are explained next to Registration and the initial role, so automatic values are visible rather than surprising.
- Existing required selectors show inline missing-state guidance in addition to the final Review summary.
- Departure and Arrival disable mobile autocorrect/spellcheck for cleaner airport-code entry.

### Preserved
- No new regulatory inference and no change to flight parsing/storage, recency, movements, certification, aircraft identity, GPS evidence, sharing, export or backup semantics.

### Verification
- Release gate: TypeScript + complete regression suite + PostgreSQL acceptance + production build + clean Vercel preview + production CI/runtime audit.
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V158.md`.

## 1.57.0 — Flight Entry Workflow Simplification — 2026-09-01

### Added
- Recent-route shortcuts in manual New flight using FlyTally's existing route-history query.
- Explicit local-flight shortcut to set arrival equal to the current departure only when the pilot chooses it.
- Live BLOCK/AIR duration feedback directly below the timeline.
- Human-readable missing-field list in the final review card.

### Changed
- Logbook and Cost sections open automatically when they contain a missing or relevant required choice, without auto-closing after completion.
- Manual/GPS source selection is more compact on mobile.
- Entry-progress wording reflects the actual inline review workflow.

### Preserved
- No change to flight parsing/storage semantics, regulatory calculations, EASA movement evidence, certification/revisions, aircraft identity authority, GPS evidence, sharing, print/export or backup/restore.

### Verification
- Release gate: TypeScript + complete regression suite + PostgreSQL acceptance + production build + clean Vercel preview + post-deploy runtime audit.
- Detailed record: `docs/history/FLIGHT_ENTRY_UX_V157.md`.

## 1.56.0 — Mobile Layout Audit & Responsive Hardening
- Added the shared iOS/WebKit native date/time sizing fix and a primary-navigation responsive containment audit.
- Preserved internal scrolling for genuinely wide tables/navigation rather than hiding page overflow.

## 1.55.0 — Flight Entry Layout & Responsive UX
- Paired Date/Registration, Departure/Arrival, Off-block/On-block, Takeoff/Landing and Role/Day landings into an aligned desktop grid with a logical single-column mobile flow.

## 1.54.4 — Aircraft Picker Selection Close Fix
- Prevented a confirmed aircraft catalogue selection from immediately reopening because of the debounced search effect.

## 1.54.3 — Aircraft Type Catalogue & Smart Aircraft Setup
- Added the structured FAA aircraft-type catalogue, searchable Make/Model/ICAO picker and manual fallback while keeping Part-FCL class separately pilot-confirmed.

## 1.53.1 — Aircraft State Integrity
- Prevented mixed or stale aircraft state when changing registration or aircraft type in flight entry.

## 1.53.0 — Guided Everyday Entry
- Made normal manual entry the default and simplified first-aircraft/profile setup through progressive disclosure.

## 1.52.0 — Codebase Review & Cleanup
- Removed the retired Streamlit/Python runtime and obsolete generated artifacts while preserving the validated regulatory core.

## 1.51.x — Regulatory Correctness Core
- Established the tested FCL.060, LAPL/FCL.740.A, legacy movement, eligible automatic ULL-credit and certification-evidence baseline retained by later releases.