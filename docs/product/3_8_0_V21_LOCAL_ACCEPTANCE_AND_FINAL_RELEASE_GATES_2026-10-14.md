# FlyTally Logbook Currency 3.8.0 — complete local acceptance and remaining release gates

**Recorded 14 October 2026**. Repository `filipto861/flytally-logbook`, Draft [PR #338](https://github.com/filipto861/flytally-logbook/pull/338).
**Exactly accepted application code SHA:** `4f8165272ff5dc33facdc60af1931f37b97c0303`.
**Status:** LOCAL OWNER ACCEPTANCE **PASS**; independent release review **OPEN**; production v21 migration/merge/Vercel deploy **NOT AUTHORIZED and NOT RUN**.
Follow-up documentation-only commits MUST preserve this accepted code SHA and distinguish docs HEAD from accepted SHA. A source/runtime/test change requires applicable new acceptance.

## Direct evidence from owner Windows PowerShell log

Owner-local git fast-forward to the exact SHA and `npm run test:target -- tests/safety-pilot-pic-sp2.test.ts tests/v323-auth-browser.test.ts tests/v340-flight-entry-phase1.test.ts tests/v380-currency-signed-backup-schema.test.ts` **38/38 PASS**. Then `powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-380-acceptance.ps1 -WithBrowser` printed both initial and terminal candidate SHA `4f8165272ff5dc33facdc60af1931f37b97c0303`.

| Step | Observed result | Scope |
| --- | --- | --- |
| Gate 1 TypeScript | PASS | `tsc --noEmit` |
| v21 review/static schema source | PASS **6/6** | Review SQL contract, not production |
| Native PostgreSQL 16 draft integration | PASS **9/9** | Native disposable `127.0.0.1:56579`, database `flytally_currency_test`, user `flytally` |
| **Actual v21 release SQL** integration | PASS **3/3** | Atomic migration, partial-state refusal and invalid exact tuple protections in same disposable DB |
| Gate 2 complete Node | PASS **1549/1549** | Complete repo test suite |
| Gate 3 optimized Next.js 16.3.2 build | PASS, **41/41** static pages | Local build only |
| Gate 4 browser-specific Next build | PASS, **41/41** static pages | Separate local optimized build |
| Authenticated desktop/mobile Playwright | PASS **8/8**, one worker | Native disposable `127.0.0.1:61601`, same expected database/user |
| Browser runtime schema evidence | `1|12|4` PASS | Exactly one approved v21 registry row; 12 v21 columns and four CHECK constraints |

Both test clusters' `expected`/ `observed` identities matched and both stopped successfully. Browser server printed slow-server-task observations but no test failure. PostgreSQL initdb could not map Windows Czech locale to fulltext language and chose `simple`; nonblocking for this acceptance. **14 unrelated untracked working-tree files were ignored and not touched** (per runner). Neither CI nor production behavior has been tested by these passes.

### Governance of previously failing candidate runs

Earlier browser bootstrap had fake migration registry names, partial review DDL application and three stale fixture test assertions. These were fixed before current acceptance; this is the first observed **full four-gate PASS** on the v21 release-code candidate. Do not carry earlier failure statuses forward as current test failures, but retain history in ROADMAP/CHANGELOG.

## Independent read-only production preflight after PASS

- GitHub `main` is `dcc8ebbfda0eadfa01345cd875ef1db806a19e26`; PR #338 Draft HEAD at check = accepted code SHA.
- Vercel project `logbook`, ID `prj_GYFLbRQjVyjn82Xnre5qZjz8UlAQ`, latest production deployment `dpl_HTHj1v1rq5kojpMafUfEekdgrBwi` is **READY**, source `main`/`dcc8ebbfda0eadfa01345cd875ef1db806a19e26`.
- Verified Vercel **production** `DATABASE_URL` **hostname and database name only** (no credentials exposed): `ep-proud-bar-b1ts6cq1.c-5.eu-central-1.aws.neon.tech/neondb`.
- Neon project `muddy-dust-14049657`, owner-approved canonical branch **`br-raspy-fog-b1btvu5t`**, `production` / primary/default/READY, compute endpoint matches Vercel exactly, PostgreSQL **18.6**, physical schema registry exactly **1..20**.
- **0/12** proposed currency columns, **0/4** proposed CHECK constraints present. Read-only row counts: 33 rates, 25 aircraft, 315 flights, 0 `flight_expenses`, 3 `voided_certified_flights`, 12 `flight_source_provenance`, 24 `account_backups`.
- This restored canonical Neon branch currently reports `protected:false`. A reviewer/owner must explicitly decide protection and operational access controls before production mutation; changing it is a separate infrastructure action.
- Existing manual snapshot `snap-proud-fire-b1bm8oac` belongs to the **former** primary branch `br-dark-math-b1snjzub`, not a fresh recoverable point of the current canonical branch. The previous `restore_snapshot(finalize:true)` unexpectedly switched production; **DO NOT repeat a finalized restore, switch back, delete branches or snapshots as a rehearsal**.

## Owner decision gates — next phase (ALL OPEN)

**R1 Independent architecture/DB/security review.** Send `docs/product/3_8_0_V21_INDEPENDENT_RELEASE_REVIEW_HANDOFF_2026-10-14.md` plus current accepted SHA and this verified log to DeepSeek or Claude. Reviewer must read code and report blockers/unknowns, including SQL exact transaction, v20 fallback, runtime automatic migration veto, credential/preview boundaries, certified/void invariants, invalid persisted state, and branch identity; reconcile against actual code and tests. Reviewer reply is NOT authority and must not directly commit or deploy.

**R2 Authentic currency source.** Existing pinned ISO 4217 reference has owner attestation and matching blob but official SIX original provenance is **NOT INDEPENDENTLY AUTHENTICATED**. Record resolution, independently verify with a genuine official registry original, or explicitly determine the limitation and release policy; never represent attestation as official-source proof.

**R3 Real-history signed v13 recoverability.** Owner-local browser passed controlled signed-v13 cases on a synthetic/disposable test fixture only. An actual current-production protected-history backup and non-destructive restore proof for certified/void and attached children is **NOT DONE**. Existing counts/snapshot are not proof of restore. Must have approved privacy-preserving evidence and **never restore destructively into canonical production**.

**R4 Fresh, independently recoverable checkpoint from the canonical production branch.** Create it only in an explicitly authorized operation after target recheck and reviewed recovery procedure. Do not call `restore_snapshot` with `finalize:true` to test, and do not consider the old snapshot adequate against post-switch writes.

**R5 PostgreSQL 18 target compatibility and pre/postflight.** Local PG16 native release SQL passed; former authorized isolated Neon PG18 structural DDL rehearsal did not include representative negative data probes. Define and approve safe PG18 evidence or document reason for acceptably limited parity. Before any DDL recheck branch ID, endpoint/database/user, v20 registry names, original data/provenance baselines, 0/12 fields, 0/4 checks. `tooling/v380-v21-preflight.sql`, `migrate.sql`, `postflight.sql` must be reviewed as exact execution artifacts. SQL checks the database name, **not the Neon branch ID**.

**R6 Separate explicit owner GO for production v21 schema migration** (and later merge/deployment only after database postflight), with exact branch and SQL file hash, verified backup and recovery evidence, operational window, stop conditions and post-deploy smoke owner. Approval to implement or to preserve the restored branch **does not** grant this GO.

## Deployment ordering and rollback boundary

1. Freeze accepted code and verify target; complete R1-R6 and repeat fresh preflight.
2. Under explicit authorization, run reviewed 12-column/four-CHECK **additive** schema-first migration with registry21 inserted in **the same guarded transaction**, with rollback on pre-/postcondition errors.
3. Verify schema 12/12, checks 4/4 validated, registry 1..21, preserved legacy money and protected certified/void evidence *before* deploying v21 application.
4. Merge and deploy compatible PR code; inspect Vercel source SHA/READY, production runtime logs, authentic user flows using safe data; preserve past signed evidence.
5. On runtime failure investigate logs and use an approved application-only rollback after checking schema compatibility; no automatic DROP/DELETE/branch swap or destructive restore.

**Do not classify Currency 3.8.0 as live. All required app-code tests PASS locally; production safeguards remain separate.**
