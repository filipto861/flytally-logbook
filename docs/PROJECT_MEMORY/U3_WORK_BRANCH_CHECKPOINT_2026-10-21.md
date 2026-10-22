# U3 work-branch checkpoint — 2026-10-21T19:54:09Z

### Final docs-only milestone checkpoint 2026-10-22T12:49:57.931Z

- Main full SHA `860df276f7044586834871808e7e3843a10daaac`, U3 branch pre-checkpoint full SHA `56c6efd1b4463530cb81f266a5620ba459f11c02`, PR #381 OPEN/DRAFT targeting main. This checkpoint advances branch HEAD and must be verified afterward.
- Source and status: no runtime/tooling/fixture edits after owner executable `a3a6f95158df8fc0950b65796a6f2622e51f5121`. Owner U3 config/spec syntax PASS, frozen E2E structure 15/15 PASS; first U3 Playwright run 2/2 FAIL on missing/invalid `DATABASE_URL` before test SQL. App behavior NOT EVALUATED, DB/process state on today's PC UNKNOWN. Historical U3 migrated-v21 acceptance is not today’s physical preflight.
- Files touched only `docs/PROJECT_MEMORY/U3_WORK_BRANCH_CHECKPOINT_2026-10-21.md`, `ROADMAP.md`, `CHANGELOG.md`, `docs/product/LOGBOOK_U3_AIRCRAFT_DELETE_FOCUS_2026-10-21.md`. No production DB, app SQL, migrations, flags, deployment, merge, Training, or audit ZIP deletion. Full release/browser/CI still NOT RUN on current test code; 2 browser tests attempted but did not reach behavior.
- **Exactly one next step:** owner performs read-only PG18 exact 55433 identity + v21 evidence check, sets exact U3 environment flags only after PASS in same PowerShell terminal, reruns dedicated 2-test Playwright acceptance. STOP on DB mismatch/unavailable. Keep generic PG16 55439 completely separate.

---

## 2026-10-22T12:47:09.749Z — Windows 15/15 source PASS; U3 Playwright setup BLOCKED before DB mutations by unset DATABASE_URL

- **Verified repo/branch:** `filipto861/flytally-logbook`; main `860df276f7044586834871808e7e3843a10daaac`; U3 branch `fix/logbook-u3-aircraft-delete-focus-20261021` exact executable HEAD before this docs-only checkpoint `a3a6f95158df8fc0950b65796a6f2622e51f5121`; PR #381 OPEN/DRAFT, base main, work one main commit behind. Core portable Windows PR #384 remains OPEN/DRAFT, separate PG16 on port 55439. This checkpoint advances only the U3 docs SHA, reverify after commit.
- **Owner Windows evidence on U3 executable SHA `a3a6f951...`:** `git status --short` had only two unrelated untracked ZIP audit artifacts, retained unchanged. `git switch` and `git pull --ff-only` PASS / already current. `node --check playwright.u3.config.mjs` PASS and `node --check tooling/u3-browser/aircraft-delete-focus.spec.mjs` PASS. `npm run test:target -- tests/browser-suite-structure.test.ts` **15/15 PASS, 0 FAIL, 0 SKIP**.
- **Browser test failure:** owner invoked direct `npx --no-install playwright test --config=playwright.u3.config.mjs --workers=1 --retries=0` (console input truncated but Playwright launched selected suite). Playwright selected exactly two desktop-chromium tests and **both FAIL immediately with `TypeError: Invalid URL`** at `new URL(process.env.DATABASE_URL||"")` in U3 spec lines 8 and 60. This proves `DATABASE_URL` was absent or invalid in Playwright process; the test body did **not** reach `runBrowserSql`, login, deletion, focus assertions, responsive matrix or database mutation. WebServer produced a Next.js ignored-parent-package-lock warning that is not demonstrated as a test failure. Browser **FAIL (ENV PRECHECK)**, U3 product behavior **NOT EVALUATED**, not a regression claim. Screenshot/trace are failure artifacts only; no acceptance PASS.
- **DO NOT / safety:** no generic `npm run test:browser` or `test:browser:local` for U3 (generic bootstrap `DROP SCHEMA public CASCADE`), do not run v21-only migration helper again, do not create/reset databases, do not mix U3 PG18 `127.0.0.1:55433/flytally_ui_u3_20261021` user `flytally_u3` with core PG16 port 55439. Do not print/store secrets, modify unrelated production data/SQL/Training or merge/deploy. No code changes in this investigation.
- **Required local read-only preflight before next retry:** verify exact owner-local U3 PG18 runtime identity (DB name/user/host/port/server_version_num) and existing v21 registry 1, source-backed 12 columns, four validated CHECKs using read-only `psql -w`. STOP if PostgreSQL service is unavailable, identity differs or migration state fails. Only after PASS assign the passwordless URL and `FLYTALLY_AUTH_BROWSER=1`, `FLYTALLY_LOCAL_POSTGRES=1`, `FLYTALLY_U3_SCHEMA_FIRST=1` in the **same** terminal, refuse `VERCEL`/`VERCEL_ENV`, and rerun the dedicated U3 Playwright command. Do not infer valid DB from a previous-day PASS.
- **Current evidence:** U3 syntax 2/2 PASS and 15/15 browser-structure PASS at previous executable SHA; direct 2-test browser run **0 PASS /2 FAIL (pre-SQL environment guard)**. Typecheck/new build/full PG/CI/native Safari/screenshots/restart **NOT RUN** in this turn. Prod DB/migrations/deploy/flags state UNKNOWN and not touched; no merge.
- **Exactly one next step:** owner performs read-only local PG18 identity and v21 checks, sets U3 environment in same PowerShell only if all PASS, and reruns exactly the dedicated two-test Playwright command; report results/trace on first failure.

---

> Branch-scoped continuity note. The canonical `docs/PROJECT_MEMORY/SESSION_HANDOFF.md` was added to `main` **after this U3 branch forked** and is absent here. This independent filename deliberately avoids an add/add merge conflict. Reconcile with rolling SESSION_HANDOFF only after an approved branch synchronization.

## Verified GitHub references

- Repository: `filipto861/flytally-logbook`; not Training.
- Canonical `main` observed SHA: `860df276f7044586834871808e7e3843a10daaac` (GitHub compare).
- U3 work branch: `fix/logbook-u3-aircraft-delete-focus-20261021`.
- Verified U3 work HEAD **before this checkpoint**: `2312345b84028643447e5673f09019eba40207ca` (GitHub connector commit response).
- PR: [#381](https://github.com/filipto861/flytally-logbook/pull/381), base `main`, Draft, open, unmerged; compare against main shows branch behind 1 commit (new Project Memory already landed on main). U0 #377, U1 #378, U2 #379, Flights mobile #380 all independently observed Draft/open.
- This checkpoint commit's own full SHA must be read from GitHub before use; do not treat the pre-checkpoint source HEAD as the final branch tip.

## Scope and DO NOT

- **Scope:** U3 Aircraft Manage successful-delete accessibility focus and a separate isolated Desktop/mobile/iPad Chromium responsive acceptance test.
- **DO NOT:** Change server deletion eligibility, recorded flights, production schema, authentication, Training repo, GPS importer, unrelated UX PRs, normal browser test baseline or approved UI theme. No production DB change, feature flag, merge or deployment without explicit owner approval.

## Changed paths for this U3 milestone

- Production UI: `components/aircraft-manager.tsx` — earlier source-only fix using once-per-success status focus guard.
- Static regressions: `tests/logbook-u3-aircraft-delete-focus.test.ts`.
- U3-specific test infrastructure: `tooling/apply-u3-v21-disposable.mjs`, `tooling/u3-browser/aircraft-delete-focus.spec.mjs`, `playwright.u3.config.mjs`; previous temporary `e2e/logbook-u3-aircraft-delete-focus.spec.mjs` was moved out of frozen default browser suite and deleted.
- Documentation: `ROADMAP.md`, `FEATURES.md`, `CHANGELOG.md`, `docs/product/LOGBOOK_U3_AIRCRAFT_DELETE_FOCUS_2026-10-21.md`, this checkpoint.

## Evidence and unverified gates

- Earlier owner-local U3 source-contract regressions **3/3 PASS**, `npm run typecheck` **PASS**, `npm run build` **PASS**, Next.js 16.3.2 static **41/41**; verified through owner-provided PowerShell logs before current test-only commits (runtime code unchanged).
- Earlier owner-local Desktop Chromium **1/1 PASS (9.7 s)** at previous browser test code head `fd67eee235dfd1daa103ed4095a3d8100af0f4fb`. It exercised synthetic deletion, actual success focus, no focus replay after subsequent Escape, and saved-flight delete disabled. **Do not transfer this PASS to the relocated spec or new config.**
- Dedicated local disposable U3 DB `127.0.0.1:55433/flytally_ui_u3_20261021`, owner `flytally_u3`; explicit canonical v21-only schema-first migration **PASS**, migration registry 21, 12 expected currency columns, four CHECK constraints. First generic browser bootstrap failed closed on missing v21 and is documented historically.
- **New head:** `node --check` of relocated test/config **NOT RUN**, `tests/browser-suite-structure.test.ts` **NOT RUN**, full 2-test U3 Playwright config **NOT RUN**, new 8-case 320/390/768/1024 × light/dark Chrome-touch matrix **NOT RUN**, screenshot review **NOT RUN**, native Safari **NOT RUN**, full app/browser suites and CI **NOT RUN**. No claim of complete release-gate PASS.
- Production DB/flags/deployment current live status: **UNKNOWN / NOT INSPECTED**, no operation carried out in this U3 milestone. Merge/deploy: **NONE**.

## One next action

Owner pulls U3 branch locally on Windows, revalidates exact localhost U3 database/flags and absent Vercel flags; runs syntax and browser-suite-structure source tests; executes `npx playwright test --config=playwright.u3.config.mjs --workers=1 --retries=0` **directly** against the already-migrated disposable fixture. Never run `npm run test:browser` in this environment because its bootstrap resets the database. Report exact test outcomes and screenshots for review, then revisit PR #381.
