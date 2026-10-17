# Airport elevation — Phase 1 GPS Detection 2.0 foundation (2026-10-16)

**Scope:** `flytally-logbook` only. Owner approved Phase 1 on 2026-10-16. Implementation staged on `feat/airport-elevation-phase1`. The **source candidate `c37ae3ba` passed the owner-local acceptance matrix** and production-schema read-only preflight; this subsequent documentation reconciliation is **not yet retested**. **Not merged or deployed.**

## Why

The intended downstream product value is **more accurate GPS takeoff / landing / rolling touch-and-go classification**. The existing `lib/track-processing.ts` uses speed, local relative altitude and continuity; it does not have airport reference MSL elevation. Airport elevation may improve later evidence fusion, but **must not be treated as proof of runway contact**. GPS Detection 2.0 needs a separate design and validation milestone. This work does NOT modify GPS detection or flight records and is not a Training performance feature.

## Data provenance and meaning

- Static OurAirports-derived `data/airports.csv` already has `elevation_ft`. `lib/airport-catalog.ts` exposes `CatalogAirport.elevationFt: number | null` with strict non-guessing parsing.
- A blank, missing or malformed CSV elevation becomes `null` (unknown). Zero and negative values are valid. The new pure `lib/airport-elevation.ts` helper validates and formats `ft MSL`.
- User-owned `airports.elevation_ft` remains nullable. Browser forms permit manual entry and explicit clearing (blank field). Existing elevation is preserved when a legacy update form omits the field entirely; an explicitly blank field clears it.
- The row-level elevation editor updates **only** `elevation_ft`, scoped by `user_id`, and excludes `ourairports%` reference source rows. It cannot silently blank the name or coordinates.
- Origin is existing dataset vs manually entered record; this is **reference-only**. Airport elevation does not establish runway-end / threshold elevation. GNSS altitude may be ellipsoidal or another datum; vertical uncertainty, proximity and trajectory need later resolution. No automatic AGL calculation or confidence upgrade in Phase 1.

## Schema evidence and release prerequisite

A read-only Neon `describe_table_schema` check of project **Logbook Shadow** (`muddy-dust-14049657`) on 2026-10-16 found `public.airports.elevation_ft` of type **double precision nullable**. **No database writes or schema changes were made.**

**Historical preflight state, now superseded by the verified production-branch endpoint mapping above:** the initial Neon inspection alone did not identify the production target. The required steps below are retained as audit criteria; the exact `public.airports.elevation_ft` check later passed on the confirmed Vercel production branch. Before any merge/deploy:

1. Determine exact target from authorized production configuration, **not** from an assumed project name.
2. Read-only check: `SELECT data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='airports' AND column_name='elevation_ft';`.
3. If absent, review and explicitly approve the **optional** additive `tooling/airport-elevation-phase1-additive.sql` before running it on that exact target. If already nullable double precision, SQL migration is **N/A**. If incompatible, stop and reconcile.
4. Confirm read-only post-migration schema, then application reads/writes against an isolated test target. **Never use remote Neon for destructive acceptance tests.**
5. No production backfill is part of this phase.

The app's airport page now reads this column; deploying it before column availability may fail, so this preflight is a hard release blocker.

## Changed surfaces

- `lib/airport-elevation.ts`: pure nullable value parser, validation and `ft MSL` presentation
- `lib/airport-catalog.ts`: CSV column and catalogue type
- `lib/data/database.ts` → `lib/data/database-v164.ts`: user-owned elevation read path
- `app/(protected)/database/actions.ts`: full airport save and elevation-only edit, success/error redirect, idempotent field-missing behavior
- `app/(protected)/database/page.tsx`, `app/v300-u31-aircraft-airports.css`: add / view / edit
- Isolated browser fixtures: `tooling/bootstrap-browser-smoke-db.mjs` and `e2e/browser-db.mjs`
- `tests/airport-elevation.test.ts`: parser/validator/format assertions plus source/persistence/fixture contracts
- Optional migration artifact only: `tooling/airport-elevation-phase1-additive.sql`

## Latest verified evidence and production DB identity (16 Oct 2026; supersedes historical FAIL / NOT RUN sections)

**Exact verified source candidate `c37ae3ba9f2d69d8972ca23d61291a1f9d62266f`**, clean owner-local checkout, not CI:

- `verify:iterate -- --base origin/main`: source **257/257 PASS**, domain **20/20 PASS**, TypeScript **PASS**, candidate ID `879b73ad71c4abecbf51ba805ccbc7a7e8eea385e49db2910fc4117824c23ce6`.
- Full `npm test`: **1,630/1,630 PASS**, zero failures/skips, exit **0**.
- `verify:postgres` in explicitly owned six-isolated-PG16 mode: **163/163 PASS** (123 + 8 + 5 + 19 + 6 + 2), exit **0**.
- Exact-SHA `tooling/run-airport-elevation-browser-local.ps1`: production Next build **PASS**, safe disposable localhost PG16 identity and v20/v21 schema-first **PASS**, Playwright **27/27 desktop PASS** and **26/26 mobile PASS**, exit **0**, disposable server stopped. This includes nullable/zero/negative/clear, malformed input POST evidence and cross-account forged record rejection without mutation.
- These are **owner-local tests**, not CI or production smoke. No production writes or deployment occurred.

**Read-only production-target preflight:** Vercel project **`logbook`**, ID `prj_GYFLbRQjVyjn82Xnre5qZjz8UlAQ`, selected by its actual `filipto861/flytally-logbook` GitHub association. Its **production-target** `DATABASE_URL` resolves to Neon endpoint `ep-proud-bar-b1ts6cq1`, mapped by exact endpoint enumeration to Neon project **`muddy-dust-14049657`** (project display name `Logbook Shadow`) on **default/primary branch `br-raspy-fog-b1btvu5t`, named `production`**, database `neondb`. Earlier schema checks did **not** identify this production branch and must not be conflated with it. No URI credentials are included here.

Read-only `describe_table_schema` on that **specific production branch** confirmed `public.airports.elevation_ft` **double precision nullable**, `UNIQUE(user_id,ident)`, municipality, iso_country, latitude/longitude, source, active, closed and updated_at. **No airport elevation migration required: N/A.** Existing production `updated_at` is **nullable text**; isolated browser fixture models it as TIMESTAMPTZ. Phase 1 reads neither timestamp meaning nor ordering, but does assign `NOW()` on custom airport updates. The type difference remains an explicit fixture-fidelity observation; no direct production mutation/smoke proof is claimed. Do not silently migrate this legacy column as part of Phase 1.

**Current release state after this documentation-only edit:** New HEAD source/tests/build/PostgreSQL/browser acceptance **NOT RUN for the new SHA**; the verified `c37ae3ba` evidence above is historical exact-candidate evidence. Run the canonical candidate-aware `verify:release:risk` with the safe owned-PG16 browser/postgres workflow on the new documentation HEAD before labeling it READY. **PR remains DRAFT. NO MERGE, NO DEPLOY, NO PRODUCTION MIGRATION.**

## Fourth browser-risk run: malformed POST coverage and explicit error selector (16 Oct 2026)

Owner-local exact clean SHA `6e626bdac89931d17372037d571931aaa3199c92` verified with `verify:iterate` **257/257 source PASS, 20/20 direct domain PASS, typecheck PASS, iteration PASS**, candidate `5e2cab3b7bdf2a652ed0e396874b837f64eceedde3b5a1f28a4b651a978b6de5`. The owned localhost PG16 browser runner verified `flytally_currency_test` at `127.0.0.1:55318`, production build PASS and disposable v20/v21 schema-first PASS, then stopped owned PostgreSQL successfully. **Browser-risk FAIL: 25/27 desktop PASS, 2 airport E2E FAIL; mobile NOT RUN; exit 1.**

The malformed-elevation E2E altered the browser input from number to text and filled `not-a-number`, then clicked the legitimate form. It expected an `invalid-elevation` redirect, but the observed URL remained `airportStatus=saved`. The submitted wire value was **not captured**, so this is **ambiguous**: React may have restored the numeric input (submitting empty = valid nullable elevation) or the server may have accepted a malformed payload. Neither server correctness nor a defect is established. The cross-user E2E did observe the correct `airportStatus=not-found` redirect (owner isolation appeared to hold), but used an unscoped `getByRole('alert')` matching both the real app's `p.form-error` and Next's route announcer, causing a Playwright strict-mode error before DB immutability assertions.

Post-failure corrective **test-only** changes: malformed field type/value, `new FormData(form)` assertion and genuine `form.requestSubmit(submit)` now run synchronously in a *single browser task*, preventing an intervening React re-render before submission; Playwright also captures the actual POST and asserts the raw body contains `not-a-number`. This is a stricter test, **not a weakening of server validation**; a genuinely accepted malformed value will fail and demand application investigation. Alerts are constrained to `p.form-error[role='alert']`, avoiding the Next route announcer. Edit persistence now uses `expect.poll` against real PostgreSQL instead of treating the already-saved URL as proof of a later edit. Source contract updated to forbid unverified internal Next Action IDs and ensure outgoing payload proof. **Corrective HEAD all tests NOT RUN.** Release pending browser-risk, exact SHA full Node, owned PG16, production schema read-only preflight; no migration, deploy or merge.

## Third browser-risk run: explicit real Next Server Action form submission (16 Oct 2026)

Owner-local `e6c43f7adc900bf4c91109ecf71cd3a508da975d`, clean branch, `verify:iterate` **PASS** (257/257 source, 20/20 domain, typecheck PASS; `candidate_id=e6a1b1a55cd24449e324dcb7a0728a09e070e05f1cddfaa3284b14b457f32f05`). Safe owned PG16 browser runner verified local `flytally_currency_test` at 127.0.0.1:50873; production Next build PASS, browser bootstrap and v20/v21 schema-first PASS, isolated PostgreSQL shut down successfully. Browser-risk **FAIL**: 25/27 desktop PASS; only two new Airport Elevation scenarios FAIL, mobile NOT RUN. The new airport add/save path did successfully reach persisted NULL via actual form submission. Then the test waited 30 s for a hidden `input[name^="$ACTION_ID_"]` that is not present in the production Next.js React form, causing a timeout. The cross-user case tried a manually assembled `fetch` that failed with `TypeError: Failed to fetch`. Neither is a valid test assertion of application security/correctness.

Corrective branch batch: drive invalid numeric validation by temporarily changing only the browser fixture input type (number → text) and clicking the **actual** `saveAirport` form, then assert invalid-elevation redirect and unchanged PostgreSQL record; drive the IDOR defense by seeding separate airports for user IDs 9001/9002, authenticating as user 9002, opening their **actual** `saveAirportElevation` form, replacing hidden `id` with user 9001's record ID and submitting normally. Assert `not-found`, unchanged owner and second-user records, and hidden owner record in second-user UI. Both tests retain strict database identity guard and release registry ownership. Set explicit per-scenario limits 90 s (multiple real browser mutations) and 60 s respectively instead of relying on Playwright default 30 s. Removed the guessed Next internal Server Action field and manually crafted HTTP request; added direct source-contract protections. **Post-fix browser acceptance NOT RUN; do not mark PASS.**

Release still blocked on new exact-candidate browser, aggregate Node tests, owned PG16 acceptance and read-only production DB identity/schema preflight. No production migration, merge or deployment.

## Second browser-risk failure: existing rates schema in disposable fixture (16 Oct 2026)

Owner pulled clean `3871685e4475b5981ded0e00ef25e149ebd8b83b`, ran `verify:iterate`: **source 257/257 PASS, domain 20/20 PASS, typecheck PASS, iteration PASS**, candidate `ec389484ca267017409e34bdf86e690fb4bef441d24838eafc449102cc266761`. Then `tooling/run-airport-elevation-browser-local.ps1` verified owned PG16 localhost `flytally_currency_test` at 127.0.0.1:62023, Next production build PASS, browser bootstrap PASS, canonical schema-first v20/v21 PASS. The 27 desktop browser-risk executions ended **25 PASS / 2 FAIL**, exit 1; both Airport Elevation specs were blocked before their first form mutation by `Local PostgreSQL query failed: ERROR: column "aircraft_type" does not exist` while loading the shared `/database` read model. The isolated PG16 server stopped safely. **Browser acceptance remains FAIL; no mobile browser acceptance.**

Root cause independently reconciled against `lib/data/database.ts`: `getDatabaseData()` loads `rates` for every `/database` view, even Airports, and its SELECT includes `aircraft_type`, `dry_price_per_hour`, `source`; prior browser fixture `rates` had none. The new corrective fixture adds these three **pre-v21** historical fields and `UNIQUE(user_id,registration,valid_from)` expected by the existing rate upsert. Canonical v21 currency fields continue to be installed by the isolated schema-first migration; no regression contract/bypass relaxed. Source guard asserts the relevant read-model and bootstrap schema fields. **Current new corrective HEAD tests NOT RUN.** Re-run owner-local iteration and exact-candidate browser-risk before considering any pass. Production-schema preflight still NOT RUN. PR is DRAFT; no merge, production migration or deployment.

## Browser-risk failure and root-cause correction (16 Oct 2026, after 92405480)

Owner-local exact candidate `92405480f1103d50143da2bdb9d986e57fee2706`, clean branch, `verify:iterate` **PASS** (257 source, 20 domain, typecheck), full `npm test` **1,630/1,630 PASS**, browser-risk production build **PASS**. Browser-risk ran 27 desktop targets; **25 PASS, 2 FAIL** — both newly added airport scenarios were blocked by `Local PostgreSQL query failed: relation "aircraft_photos" does not exist` when `getDatabaseData` attempted the aircraft/photo outer join for `/database`. The errors occurred before elevation persistence was exercised. Disposable PG16 identity was checked on 127.0.0.1:61012, browser schema-first v20/v21 initialization succeeded, and the owned PG server was safely stopped. **Browser acceptance FAIL**; never count 25 PASS as full browser evidence.

Corrective new branch commits add the production-backed `aircraft_photos` table and index to the disposable browser bootstrap (from `lib/v300-aircraft-sharing-schema.ts`, not a fake mock), set an explicit localhost `baseURL` on the second independently authenticated Playwright context, and add source-contract guards requiring exact photo schema parity and cross-account origin. No production runtime, application schema or permission logic was modified. **New corrective head remains NOT RUN.** Repeat `verify:iterate` and exact-candidate owned PG16 browser-risk acceptance before any release decision. Production DB schema preflight still **NOT RUN**; no merge/migration/deploy.

## Verified owner-local gates and new browser acceptance batch

- On `e88bc4f9923b091bfde125bfcdb323877506c45c`, clean tree (16 Oct 2026): `verify:iterate -- --base origin/main` **PASS**, source 257/257, direct domain 19/19, typecheck PASS. `verify:postgres -- --base origin/main`, explicit six-owned-local-PG16 mode: **163/163 PASS**, exit 0; six isolated clusters, PostgreSQL 16.15. `npm test` full aggregate **1,629/1,629 PASS**, exit 0. Initial targeted 13/13 and build PASS were also recorded on an earlier SHA.
- **After** these PASS observations the branch was amended for browser acceptance. Therefore the new HEAD requires its own tests and release candidate identity. No later PASS result may be backdated from `e88bc4f9`.
- `tooling/bootstrap-browser-smoke-db.mjs`: browser-only disposable `airports` fixture now matches custom airport action needs (`municipality`, `iso_country`, `updated_at`, `UNIQUE(user_id,ident)`, nullable elevation). The second pre-existing fixture pilot has test-only credentials for cross-account authorization checks.
- `e2e/airport-elevation.spec.mjs`: two authenticated logical scenarios, each on desktop and mobile: add with NULL; forged malformed elevation rejected before mutation; edit to zero, negative, clear back to NULL; persistence and unchanged metadata; reference catalogue lookup and overflow; server-action cross-user forged edit is rejected without changing owner data.
- Strict `tooling/browser-suite-baseline.json` and `tooling/development-modules.json` now register these **four browser execution targets** as aircraft-airports release evidence, preserving existing targets. Corresponding source-contract tests keep fixture, ownership and baseline expectations explicit.
- **Destructive fixture isolation:** `tooling/run-airport-elevation-browser-local.ps1` provisions and identity-checks a new owned local PG16 cluster and sends an exact scoped candidate to `verify:browser:risk` with schema-first local v21 intent for the existing currency regressions. Bootstrap executes `DROP SCHEMA public CASCADE` **only** on this newly verified disposable database. Never invoke browser tests against production, Neon or a pre-existing local database.
- **As of authoring:** new browser specs and amended fixture **NOT RUN**; updated branch full suite, typecheck, build, PG acceptance and risk browser acceptance **NOT RUN**. The pre-browser 1,629/1,629 result belongs only to `e88bc4f9`. Production Logbook schema still **NOT VERIFIED**; PR remains DRAFT, no schema migrations/deploy/merge.

## Verification required before READY

**Current verification (owner-local Windows PowerShell, 16 Oct 2026, original PR head `79b9a66a`):** Node v24.19.0; `npm ci` complete; targeted elevation/airport-code/U3.1 tests **13/13 PASS**; `npm run typecheck` **PASS**; `npm run build` **PASS**. Initial `verify:iterate -- --base origin/main` reported **source FAIL** (256/257; source inventory expected 397 vs actual 398), **domain PASS** (13/13) and **typecheck PASS**. Corrective branch update increments the reviewed `tooling/development-modules.json` audited runtime count to **398**, preserving full ownership coverage, and registers `tests/airport-elevation.test.ts` as direct domain-unit evidence. **The new branch head has NOT YET BEEN TESTED**; rerun the exact candidate `verify:iterate` after `git pull`. `psql` and `pg_isready` are not on the user's PATH, and `DATABASE_URL` is not configured: PostgreSQL/browser acceptance **NOT RUN**. Do not use remote Neon or an assumed production database for test acceptance.

On owner-local checkout of exact branch HEAD:

```bash
npm ci
npm run test:target -- tests/airport-elevation.test.ts tests/airport-code.test.ts tests/v300-u31-aircraft-airports.test.ts
npm run typecheck
npm run build
npm run scope:changed -- lib/airport-elevation.ts lib/airport-catalog.ts lib/data/database.ts app/\(protected\)/database/actions.ts app/\(protected\)/database/page.tsx
```

Then run the candidate-aware `npm run verify:release:risk -- <candidate>` on the **exact pinned branch commit**, satisfying its targeted Postgres/browser gates on owned isolated localhost fixtures. Specifically exercise manual airport add with unknown, zero, negative elevation; edit existing elevation; clear to NULL; invalid form feedback; cross-user edit rejection; custom metadata unchanged; reference display and dark/mobile widths; previous catalogue search and routes unaffected. Verify historical flights/GPS evidence unchanged. Release gate and tests remain **NOT RUN** until owner-local evidence is attached. No merge/deploy requested.
