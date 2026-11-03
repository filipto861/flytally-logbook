# M0-B B1b.2c — authenticated Trash/cron/shared Neon HTTP source checkpoint

**UTC:** 2026-11-03T08:35:07.635Z. **Repo:** `filipto861/flytally-logbook`. **Verified main:** `c9c2f60303236113a223942072311f5e37f876f7`. **Work:** `test/logbook-m0b-b1b2c-neon-auth-boundary-20261103`, stacked Draft [#466](https://github.com/filipto861/flytally-logbook/pull/466) base Draft #465 `2520bb4129cb65729f2176c59c034f26b154f89e`, ancestors #464→#455 and B0 #454 independent. **Executed CI SHA:** `5df035db7fb17c7d6c10eb41bd38c1839067cbdd`. **Work HEAD before checkpoint:** `b5305e64966d1f2f5669ad3aad1d88ef8d006513`; verify final pushed work SHA after commit. Test result covers executable unchanged after CI, not other runtime.

## Scope/owner authority and files

Owner approved continue with source-level call-path and isolated Neon HTTP parity **planning**. No approval of actual remote Neon branch/role creation, SQL DML, migration, merge, deploy, production flags, full-account Restore or Training changes; no DeepSeek review per owner. Retention option A previously approved as design only, original 90-day Trash cutoff + working minimum owner UID for additional 12 calendar months, lawful basis and right-of-erasure exceptions unresolved.

Changes: new read-only `tooling/m0b-b1b2c-neon-auth-boundary.test.mjs`, new [source map/P0–P8 plan](docs/maintenance/2026-11-03-m0b-b1b2c-neon-http-auth-parity-plan.md), this checkpoint; updated `ROADMAP.md`, `ARCHITECTURE.md`, `docs/PROJECT_MEMORY/{SESSION_HANDOFF,ACTIVE_WORK}.md`. Created temporary `.github/workflows/m0b-b1b2c-neon-auth-boundary-diagnostic.yml` for CI and **removed** after PASS. FEATURES and CHANGELOG reviewed, no shipped feature to record. No application runtime/schema or `DATABASE_SCHEMA_VERSION=21` changes.

## Verified source and exact gates

| Category | Evidence / verdict |
| --- | --- |
| Node24 `node --check tooling/m0b-b1b2c-neon-auth-boundary.test.mjs` | **PASS** [Actions #41603548638](https://github.com/filipto861/flytally-logbook/actions/runs/41603548638), exact executable `5df035db7fb17c7d6c10eb41bd38c1839067cbdd` |
| `node --experimental-strip-types --test tooling/m0b-b1b2c-neon-auth-boundary.test.mjs` | **12/12 PASS**, same run/SHA |
| Cron Bearer function missing/malformed/valid auth tests | **PASS** pure function; not a live route request |
| Pilot Trash source session and user ownership | **PASS** static source boundaries; **NOT** real authenticated browser/DB test |
| Cron route guards before global sweep/backup; schedule config | **PASS** static source; real cron execution **UNKNOWN** |
| lib/db shared Neon HTTP client and absence of separate per-caller SQL role in examined sources | **PASS** source observation; actual current_user/grants **UNKNOWN** |
| Both direct expired Trash DELETEs and restored archive semantics | **PASS** static audit; V22 shared writer **NOT IMPLEMENTED** |
| V22 schema version remains 21; M0-A full Restore blocked | **PASS** source audit; production M0-A READY separate evidence |
| Real Neon HTTP transaction/role/two-client lock, actual physical catalog/flags, app auth+role acceptance | **NOT RUN / UNKNOWN**; **no DATABASE_URL, SQL or remote connectivity used** |
| Full Node/typecheck/build, native Windows PG16 164/164, risk browser, signed V14 issuer/B2 imported/native audit, authenticated prod smoke | **NOT RUN** |
| Production Vercel | **READY** read-only `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` app `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, production DB/schema/flags **UNKNOWN** |

## Risks/hard stops

1. `lib/db.ts` shares one cached `neon(DATABASE_URL)` principal across user/cron privacy sources. Earlier synthetic restricted roles are **not production DB roles**. Separate HTTP endpoint authorization is not automatically database role isolation. Avoid passing untrusted owner ID to a broadly callable `SECURITY DEFINER` function.
2. Neon HTTP `sql.transaction([...])` executes one noninteractive predeclared batch. Do not implement interactive stateful flows as multiple HTTP requests; first owner account gate and fresh evidence read need tested SQL sequencing/rollback under actual transport and privilege model.
3. The two existing expired Trash direct DELETE writers must both be migrated before enabling a strict V22 registry; restored archive UID stays active, void/native audit/other participant evidence protected. Current account erasure retains active flight/FSTD. Legal signoff for minimum UID 12 months is **not secured**.
4. No merge, deployment, remote/production SQL/provisioning/migration/delete/restore, prod feature flags, full-account Restore activation, signed/audit rewrite, Training or DeepSeek.

**ONE NEXT STEP:** separately approve an exact **disposable Neon project/branch/database/SQL role scope**, positively verify its identity, then prepare and run P0–P8 Neon HTTP two-client parity solely there (not production).
