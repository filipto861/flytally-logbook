# FlyTally Logbook 3.8 — R1 DeepSeek code-level findings and corrective batch

## 15 October — second owner-local full-suite attempt, residual source tests

On exact `7e0a39d8c32db7e0f040e6bb8643bf9ab00f8c5d`, owner-local targeted previously failing tests **32/32 PASS**; native disposable PG16 identity was verified (`flytally_currency_test|flytally|127.0.0.1|59150`), typecheck PASS; schema static **6/6**, PG schema **9/9** and executable release SQL **5/5** PASS, temporary PG stopped. Full Node suite **1553/1555**; **two remaining failures** were `tests/timezone-semantics-source.test.ts:36` and `tests/v370-map-layers.test.ts:172`, each redundantly asserting 395 versus canonical module registry's validated runtime file count 396. Gate3 Next build and Gate4 browser **NOT RUN**, not PASS.

Minimal test-only correction `efcda5dc9526090c6af61aec6c8bad6bc76adcac` removes only those redundant `auditedTotal=395` assertions, retaining relevant strict timezone mapping and GPS/satellite-browser selection checks. The **central** `tests/development-scope.test.ts` remains authoritative and independently verifies actual runtime-file count, baseline stable ownership and >=90% coverage. Unmodified runtime and production SQL. New head remains **UNTESTED**.

Owner must run targeted timezone+map+development ownership tests, then full four-gate script on the same SHA. H4 independent application rollback proof and production safety gates remain OPEN.


## 15 October — Owner-local partial acceptance and test-governance reconciliation

On exact `e8cf3f1d6f48f9b0b0871399826248c83ad65ffa`, owner-local TS PASS, targeted currency guard/release contract 10/10 PASS, native disposable PG16 6/6 review source, 9/9 integration and 5/5 release-artifact PG tests PASS; PG identity verified and cluster stopped. Full Node Gate2 was **1552/1554 PASS**; two failures solely in the source/development registry gate: `tests/development-scope.test.ts:212` had 395 vs actual 396 runtime files after adding the new helper, and `tests/v367-flight-entry-e15-closeout.test.ts:11` expected old SELECT-version-only SQL instead of SELECT-version-and-name under the same schema-version filter. No Next build or Playwright ran.

Governance/test-only corrective commit `cc6b58a9d062d3a443a96e7ea6ae4eb4788e6577` registers new migration safety helper in explicit `shared-runtime` and under a strict development special rule requiring PostgreSQL and browser acceptance on future changes; sets audited count 396; updates E1.5 legacy test without weakening version filtering and adds an explicit validation of version21 name and physical shape check. Production SQL/runtime unchanged in this correction. These revised tests are **NOT YET RUN**.

Run targeted `npm run test:target -- tests/development-scope.test.ts tests/v367-flight-entry-e15-closeout.test.ts`; if PASS, full owner-local `run-currency-380-acceptance.ps1 -WithBrowser`. No release GO until all four gates PASS on one code candidate and H4/operator evidence blockers are resolved.


**Date:** 15 October 2026. Repo `filipto861/flytally-logbook`, Draft PR #338. Production release **NO-GO**.

## Independent review basis

DeepSeek's second report reviewed the source packet pinned to previously accepted code `4f8165272ff5dc33facdc60af1931f37b97c0303`; reviewer had no repository, runtime, Neon or Vercel access and executed no tests. Review classified: B1 primary protection; B2 exact Neon branch/host identity control; B3 real signed-v13 recoverability; B4 independent SIX original or owner policy; B5 fresh primary recovery checkpoint. Confirmed H1 generic local v21 auto-migration permission; H4 missing v20-on-v21 rollback proof; H5 blind trust in physical schema when registry21 exists. H2 advisory-lock order **DISMISSED**, H3 unqualified ALTER with `SET LOCAL search_path=public,pg_catalog` **LOW**. N1 parity assertion and N2 column-count test require strengthening; N3 repeating startup errors is LOW.

**Authority:** Advisory, independently reconciled against actual accepted source. No independent reviewer production GO.

## Corrective batch staged after the prior accepted code SHA

- `lib/currency-v21-migration-safety.ts` (new): `allowDisposableLocalV21Migration(env)` now requires ALL of routing flag `FLYTALLY_LOCAL_POSTGRES=1`, browser marker `FLYTALLY_AUTH_BROWSER=1`, purpose marker `FLYTALLY_CURRENCY_V21_BROWSER=1`, absence of *both* Vercel markers, `postgres:`/`postgresql:` URL, **exact** loopback IP `127.0.0.1` (not hostname/DNS), explicit non-standard port (not 5432/55432), exact username `flytally`, no password and exact decoded path `/flytally_currency_test`. `NODE_ENV=production` is deliberately *not* forbidden because local authenticated browser acceptance uses a production Next build. A test flag or loopback alone does **not** prove a disposable database: only the dedicated runner's freshly initialized PG16 cluster and independent ID checks establish that.
- `lib/db-optimization.ts` now imports this strict helper and uses it before any pending v21 automatic runtime transaction. When migration registry already contains v21, runtime checks the *exact canonical name* and performs a read-only query for **12 correctly typed nullable no-default columns, on their expected tables**, and **four validated, correctly table-bound CHECKs**, followed by a fail-closed evidence assertion before normal application startup. This closes the H5 blind-trust path. The validator does not replace mandatory SQL postflight or audit protected row hashes.
- `tests/currency-v21-migration-safety.test.ts` (new) exercises positive isolated/production Next build context and denial for missing/mismatched flags, Vercel present, wrong/remote/spoofed host, port, database, role, password/protocol, invalid registry name and incomplete numeric evidence.
- `tests/currency-v21-release-contract.test.ts` compares each of the **eight complete DDL blocks** parsed separately out of reviewed draft, executable SQL and v21 runtime (rather than checking only equivalent substring inclusion). Extends source checks for runtime fail-closed gate and exact post-registry validation.
- `tests/integration/postgres-currency-v21-release.test.ts` now extracts the **actual read-only runtime metadata query**, executes it against the disposable PG16 fixture, and asserts failure of the exported evidence validator for a forged registry21 without DDL, dropped validated CHECK and dropped v21 column. The original three release-file test scenarios remain; total currently five. This also supersedes its former weak unqualified column-name-only count check (N2).

**Source-only pre-acceptance checks** (not executed local tests): four ALTER + four CHECK blocks precisely match original review draft, executable migration and runtime, and the new query has 12 table/type-specific column predicates plus four table-qualified validated CHECK predicates.

## Intentionally not changed

- All three `tooling/v380-v21-{preflight,migrate,postflight}.sql` artifacts and the `sql/drafts/` historical candidate are **unchanged**. H3 is LOW under the explicit transaction-local search path and exact public catalog checks; fully qualifying the SQL would expand the already-reviewed execution artifact surface and force a new SQL hash/rehearsal. Defer as separate reviewed hardening decision, not a blocker bypass.
- **H4 mandatory v20 application rollback compatibility is NOT RUN**. Old `main` v20 runtime ignores registry21 in its migration version query, but that does not prove functional reads/writes/certified history on v21. Required: isolated PostgreSQL with real v20 schema plus exact v21 migration; run the **actual frozen v20 application code** from its Git SHA in a separate worktree against that disposable DB and verify representative rates, aircraft, flights, expense, archived/certified reads and safe writes (never real records). Do not classify isolated SQL fixture-only smoke or static source inspection as equivalent. Define and review the exact isolated protocol before executing; never point old runtime at production.
- **N3 LOW** repeated error retry after fail-closed startup remains deferred, as changing global failure caching interacts with recovery behaviour and needs separate design.
- Neon branch protection, API branch-ID/compute-host/operator-URL reconciliation, signed real v13 restore, SIX provenance or explicit owner policy and new canonical-branch snapshot remain **production release blockers** outside this code batch. A DB sentinel is *not* a substitute for Neon API branch identity: it would be cloned along with the DB. Do not repeat `restore_snapshot(finalize:true)`.

## New acceptance required

Earlier full owner-local PASS applied only to `4f8165272ff5dc33facdc60af1931f37b97c0303`. **Current corrective code has NOT RUN typecheck, Node tests, PG16 integration, build or authenticated Playwright**. Owner should:
1. `git pull --ff-only` on `feat/3.8.0-m2a0-schema-review-main`, confirm expected exact head.
2. `npm run typecheck`.
3. `npm run test:target -- tests/currency-v21-migration-safety.test.ts tests/currency-v21-release-contract.test.ts`.
4. If PASS, `powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-380-acceptance.ps1 -WithBrowser`. This will run five executable release PG cases, all Node and authenticated browser.
5. On failure STOP, capture full diagnostic and SHA; fix in Draft PR. No code changes on `main`, no merges or production DDL.

## Closeout status

Corrective batch **IMPLEMENTED, VERIFICATION NOT RUN**. R1 source findings reconciled but independent reviewer has not re-reviewed these changes; do not call full independent R1 signed off. Original application `4f816527` is still locally accepted historically; its PASS is not inherited by the new SHA. Database/release authority unchanged.
