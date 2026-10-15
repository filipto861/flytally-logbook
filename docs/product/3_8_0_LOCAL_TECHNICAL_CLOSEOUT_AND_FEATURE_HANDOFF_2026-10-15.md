# FlyTally Logbook 3.8.0 — local technical closeout and next-feature handoff

**As of 15 October 2026:** **Local implementation/testing phase COMPLETE for the tested scope; PRODUCTION RELEASE ON HOLD.** This is an intentional scope boundary to avoid repeatedly rerunning already passing synthetic tests. Owner requested moving promptly to other features. Do not call the 3.8.0 production release DONE or merge its currency schema into `main`.

## Actual evidence, never merged/deployed

- Repo: `filipto861/flytally-logbook`. Draft [PR #338](https://github.com/filipto861/flytally-logbook/pull/338); implementation candidate branch `feat/3.8.0-m2a0-schema-review-main`.
- Current `main`/Vercel prod code (at last verified release preflight): `dcc8ebbfda0eadfa01345cd875ef1db806a19e26`; live DB `neondb`, canonical Neon branch `br-raspy-fog-b1btvu5t`, schema v20. No live v21 DDL/merge/deploy or production backup export performed in this cycle.
- Broad v3.8 candidate owner-local acceptance: tested code `42e72909b798b8e71d0d9d3e66f551c14aad5931`, targeted native PG16 + typecheck + Node 1555/1555 + optimized Next build + desktop/mobile authenticated 8/8 PASS. Evidence applies to this SHA; subsequent backup tooling changes were not retested through the entire full suite.
- Actual frozen Vercel-production v20 application over fresh isolated schema v21: H4 owner-local on `b23f9b99e4327412204af74d2e42d2d9dbe33bf9`, source contracts 4/4 PASS; old Next/TypeScript build PASS, authenticated desktop/mobile 8/8 PASS; schema post-check PASS. This supports an **application-only rollback within the synthetic local PG16 tested envelope**, not a claim of Neon production restore.
- **Latest R1 encrypted off-provider recovery unit and synthetic PG18 integration — owner-local PASS on exact checkout `a3f2a7b0af13f849d3ff291eb04819f4751f71b1`:** `npm run test:target -- tests/v380-off-neon-archive.test.ts` **11/11 PASS, zero failures/skips**. `node tooling/v380-off-neon-pg18-synthetic-test.mjs` **PASS through all stages 00–10**: PostgreSQL18 isolated localhost port 53662, SCRAM correct password accepted and wrong password denied, synthetic `pg_dump -Fc` **2,806 bytes**, immutable authenticated v2 manifest, AES-256-GCM entire-file verification, TOC precisely **2 TABLE + 2 TABLE DATA**, atomic `pg_restore` to another synthetic database, source/target data equality and verified test PostgreSQL shutdown/removal. This does NOT use real Neon production records, credentials or historically signed v13 portable backup.
- Former failing PG18 runs (pg_ctl Windows pipe timeout, pg_dump quick-exit stdout loss, size-gate diagnostics, TABLE DATA double count) are documented as historical failures; all **superseded for this exact synthetic acceptance only**, not erased.

## Explicit closeout boundary

**DONE for local technical scope**: H4 rollback exercise; streaming encrypted PostgreSQL18 synthetic backup/restore; AES/HMAC manifest/SCRAM ACL/TOC targeted acceptance. No further speculative synthetic-code refactors, repeated identical acceptance commands or endless audit rounds while no failure is observed.

**NOT DONE / production only (retain as a bounded separate release checklist):**
1. Independent DeepSeek R1-D exact-head security reviewer verdict not received/reconciled after the fixes (first R1 review did occur). Do not claim independently approved or secure for real customer data.
2. An actual independent encrypted **off-Neon production `pg_dump` and complete disposable PG18 production-data restore** has **NOT RUN**. In-project copy-on-write checkpoint `br-shiny-bonus-b1gqt9u7` is retained but not a substitute.
3. Actual historically signed portable account v13 backup/restore evidence still unresolved. Real archive/test fixture must be owner-approved and evidence-preserving.
4. Exact Neon PG18 rehearsal of executable v21 SQL and production-target connection/preflight, independent ISO/SIX source provenance disposition, and separate owner C0 GO before any live v21 DDL, PR merge/deploy.
5. Windows volume encryption, archive key custody and potential privilege/extension differences require checks for real-data operations; tested synthetic PG18 is not proof of real production restores.

**Safe disposition:** Freeze Draft #338 as an **unreleased candidate**, keep all data/snapshots/checkpoint unchanged. Do NOT merge or deploy, do NOT export or restore real customer data automatically. The owner can initiate a short, separately approved *release operations* cycle later from the exact frozen baseline, with no further feature engineering unless real failures reveal a defect.

## Next product development can proceed immediately

User wants to return to new features. **Independent work is unblocked**: start from current `main` (live v20) on a new small `feat/...` branch; do not assume v21 currency columns or cherry-pick PR #338 implicitly. First next item in historical ROADMAP is 3.9.0 multi-aircraft heterogeneous onboarding proof, followed by 3.10.0 multi-aircraft sharing/recovery/scale. These titles are historical plans, NOT permission to release 3.9 before 3.8 or an automatic selection of the next feature. At the next feature request, reconstruct actual main/ROADMAP/FEATURES/CHANGELOG and ask the owner for a product decision only if the requested feature truly requires a different priority or depends on v21.

**Stop rule:** Do not keep requesting more synthetic tests absent changed code/failing evidence. Resume the 3.8 release checklist when the owner decides to schedule actual production-safe backup/release work. Keep exact evidence provenance and scoped status.
