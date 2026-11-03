# M0-B B1b.2c — V22 real-schema compatibility and retention checkpoint (DRAFT)

**UTC:** 2026-11-03T07:26:45.413Z. **Repository:** `filipto861/flytally-logbook`. **Verified main:** `c9c2f60303236113a223942072311f5e37f876f7`. **Work:** `docs/logbook-m0b-b1b2c-v22-compatibility-retention-20261103`, Draft **PR #462**, base `docs/logbook-m0b-b1b2c-writer-topology-20261103@b852114307b37dd6f17442a430bdfb6bee2af0b6` (Draft #461). Stacked ancestor Drafts #460/#459/#458/#457/#456/#455; separate B0 #454. **Exact executed test source HEAD:** `a966ee5805a120f52d5707183a5667a5e2c71b53`. The final documentation/cleanup HEAD must be independently reverified using GitHub; no later source changes inherit prior CI evidence.

## Scope and owner authority

Owner: continue without DeepSeek review, respected; no external model review used. This milestone is source-to-schema compatibility mapping plus a **synthetic-only** PostgreSQL16 nullable UID, existing owner-FK and Trash A/B policy experiment. **DO NOT** merge, deploy, run production/remote SQL/migration/restore/delete, change production flags, enable full-account Restore or modify flytally-training. No production DB connection or authentic pilot data.

**Files:** New `docs/maintenance/2026-11-03-m0b-b1b2c-v22-real-schema-compatibility-retention.md`, `tooling/m0b-b1b2c-retention-compatibility-probe.mjs`, this checkpoint. Temporary branch-only `.github/workflows/m0b-b1b2c-retention-diagnostic.yml` (must be removed after PASS). Updated `ROADMAP.md`, `ARCHITECTURE.md`, `docs/PROJECT_MEMORY/SESSION_HANDOFF.md`, `docs/PROJECT_MEMORY/ACTIVE_WORK.md`. FEATURES and CHANGELOG reviewed, no production capability/ship to record.

## Evidence and exact result

| Gate | Result / authority |
| --- | --- |
| Node24 script syntax | **PASS**, [GitHub Actions #41596162456](https://github.com/filipto861/flytally-logbook/actions/runs/41596162456), SHA `a966ee5805a120f52d5707183a5667a5e2c71b53` |
| Safe-target preflight | **7/7 PASS**, same run/SHA |
| Disposable PostgreSQL **16.15** with synthetic real-shaped owner/FK and nullable UID | **7/7 PASS**, same run/SHA; random schema removed |
| Old flight/FSTD `NULL event_uid` updates; owner composite FK rejects foreign expense; partial owner+UID UNIQUE with duplicate heuristic fingerprint permitted | **PASS**, same isolated test |
| Existing Trash-list AND privacy-sweep direct DELETE with strict registry | Both **correctly REJECTED** in synthetic fixture |
| A: atomic `trash→purged` plus payload DELETE, owner-linked UID retained | **PASS** synthetic, replay prevented; **policy NOT APPROVED** |
| B: atomic delete archive and marker, UID later reusable | **PASS** synthetic **as a demonstrated integrity limitation, NOT a safe proposed default** |
| Legacy Trash NULL UID with no trusted issuer | **PASS**, can expire without assigning fabricated source trust |
| Prior synthetic PG16 lock [#41592224174](https://github.com/filipto861/flytally-logbook/actions/runs/41592224174) and lifecycle [#41594393542](https://github.com/filipto861/flytally-logbook/actions/runs/41594393542) | Historical separate PASS on their own source SHAs only |
| Full app Node/typecheck/build; canonical Windows PG16 164/164; Playwright/risk; real-schema deployed catalog; actual Neon HTTP; signed V14/issuer; B2 native vs imported audit | **NOT RUN** for this experimental branch |
| Production runtime and deployment | Read-only Vercel READY `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub`, `fly-tally.com` at app SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; production DB/schema/flags **UNKNOWN**, authenticated smoke **NOT RUN** |

## Important discrepancies and blockers

- Existing tables **do not share one owner-FK shape**. Composite owner FKs exist for expenses/connected crew/public shares/participant provenance, whereas participation, verification and instructor approval source CREATE TABLEs reference only numeric `flights.id`; FSTD and certified revision CREATE TABLEs do not declare active-parent composite owner FKs. Real `pg_catalog` is unverified. Do not accidentally attach a historical signed revision to a different pilot/row.
- The present `deleted_flights` default is 90 days. Both `lib/flight-trash.ts:11` (listing side effect) and `lib/privacy-account.ts:44–52` (sweep) execute direct DELETE; strict retained-state registry copied from PR #461 would break these paths. Owner must decide whether a finite owner-linked UID marker is retained after payload expiry. This is a potentially linkable identifier and cannot be treated as non-personal data merely because it is an opaque UUID.
- **Option A** retains an owner-linked UUID for a yet-to-be-decided permitted period after payload erasure; **Option B** eliminates that metadata but forfeits replay/identity evidence. No indefinite retention and no silent authoritative source identity assigned to old backups. Full Restore unknown/erased-source => UNAVAILABLE.
- V22 must never be auto-registered as a runtime migration just by bumping `lib/migration-plan.ts` version 21; must be explicitly controlled schema-first with production owner authorization. No global locks or row-trigger-only account gates.

**ONE NEXT STEP:** obtain a specific owner decision on A/B **retention/erasure policy** (including scope/duration of owner-linked UID markers); then design separately gated real-schema V22 migration acceptance in isolated DB. No DeepSeek review, no production SQL.
