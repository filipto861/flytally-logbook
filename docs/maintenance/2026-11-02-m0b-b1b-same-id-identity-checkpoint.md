# M0-B B1b.1 — same-ID flight/FSTD parent natural-identity guard (staged)

**Status 2026-11-02 UTC:** IMPLEMENTED, TARGETED CI PASS, UNMERGED, NOT RELEASED; full-account restore remains blocked by M0-A. Repo `filipto861/flytally-logbook`, main baseline `c9c2f60303236113a223942072311f5e37f876f7`, parent B1a branch `fix/logbook-m0b-b1a-parent-id-20261102@0ed7114d054bec9fb781f9d8b3e22fc0d69b64ce`, work `fix/logbook-m0b-b1b-same-id-identity-20261102`, pre-documentation HEAD `7dfed71ede66f5f788aa02066b0177e593f935c4`. This is a STACKED feature: PR #455 B1a must be reconciled before any B1b merge; unrelated DATA-1 draft branches not included.

## User approval and DO NOT

The owner authorized continuing M0-B B1a release verification and advancing B1b in context of repeated `pokračuj/souhlasím` messages. **No approval** for merging B1a or B1b, production deploy, DB schema migration/restore/delete, feature flag change, Neon/prod tests or re-enabling full-account restore. No external AI review performed for this narrowly scoped guard. Preserve approved D1–D3 B0 design and M0-A fail closed.

## Real implementation

- `lib/recovery-parent-identity.ts` (new): pure identity comparator: same non-empty source/target parent ID, complete actual calendar date, equal source/target date, non-empty identifying fields, valid explicit FSTD minutes (zero supported; missing, invalid, negative and fractional disallowed), and equality of the existing canonical natural key functions. Unknown/malformed/incomplete means **not proven identical**; no fabricated zero.
- `lib/account-restore-v6.ts`: existing `classify()` used to skip all same numeric IDs without comparing identity. Now for **flights and fstd_sessions only**, same-ID fast skip is allowed if `sameRestoreParentNaturalIdentity` proves completeness/key equality. Otherwise a typed `record-identity` conflict is raised. Other sections keep existing behavior (NOT claimed safe for full account restore). The PREVIEW classification remains **outside** the atomic write transaction: this does NOT solve race between preview and commit.
- `tooling/development-modules.json`: audited runtime file inventory incremented 417→418 (new helper is already stable-owned by `data-recovery` prefix `lib/recovery-`). This preserves coverage invariants; no threshold change.
- `tests/recovery-parent-identity.test.ts`: 8 positive/negative unit cases (date, route, registration, time, FSTD type/qualifier/instruction, zero vs missing minutes, source incompleteness). `tests/m0-account-restore-containment.test.ts`: source guard for integration with `classify` and retained M0-A. `tests/m0-account-restore-runtime-mock.test.ts`: import resolver loads the REAL pure comparator, preserving existing no-DB access assertions and test behavior. Integration test count and canonical 42/164 PostgreSQL hash registry unchanged.
- Temporary isolated GitHub Actions workflow created for verification and removed afterwards; `.github/workflows/m0b-b1b-temporary.yml` **NOT** in final code diff. No new library, schema, feature flag or user-visible UI.

## Exact test evidence

**GitHub Actions [#41512957127](https://github.com/filipto861/flytally-logbook/actions/runs/41512957127) at exact code+tests SHA `988ae4d8a999dec4a43c1f0cf7b01882c3e3db13`**, Node v24, isolated GitHub Actions PostgreSQL 16.15 synthetic Docker:

- **PASS:** targeted identity/source guard **16/16**, zero fail/skip.
- **PASS:** TypeScript `npm run typecheck`.
- **PASS:** canonical registry integrity `node tooling/validate-postgres-partition-registry.mjs` **42 files / 164 declared cases**; NOT 164 actual SQL cases at this B1b SHA.
- **PASS:** all Node tests **1780/1780**, zero fail/skip.
- **PASS:** Next.js production `npm run build`.
- **PASS:** independently identified synthetic isolated PostgreSQL16, targeted `tests/integration/postgres-security-restore.test.ts` **4/4**, including inherited B1a real 2-session parent conflict races. PostgreSQL service stopped by CI.
- Retain earlier unsuccessful CI [#41512538643](https://github.com/filipto861/flytally-logbook/actions/runs/41512538643): targeted identity tests and TS PASS, full suite FAIL for two **integration infrastructure** findings (runtime audited-file count new 418 vs registry 417; M0-A runtime mock missing new alias). Corrected without weakening assertions or coverage thresholds. Test result at old SHA stays FAIL.
- Later workflow-removal commit `7dfed71ede66f5f788aa02066b0177e593f935c4` and subsequent Markdown changes do **not** alter tested production code/unit/integration source or manifests. Don't claim a **new formal exact-candidate release PASS** at post-test docs HEAD.

**Prior B1a owner Windows acceptance** (different SHA): `68b43b98f11b79dd8e76acac9c8d6e3a916375ec`, candidate ID `29f6d94682652c4168c60506d67548768a78e6c616a2f2ceca4ff21d182dd72a`, owner-provided terminal reports **fresh native six-PG16 164/164 PASS**, authenticated Chromium risk **4/4 PASS**, full formal release risk **PASS**; see PR #455 comment and B1a acceptance doc. This is **not** B1b release evidence.

## Open constraints / next step

- **B1b.1 narrows only same-ID natural identity; not full parent/evidence equality.** Strict mode can withhold an incomplete historical record that might otherwise be identical; this is intentional fail-closed. Certification/revision completeness and original owner/actor authorization must still be proved, and same-key rows with *different* IDs or concurrent writes require transaction-bound safety.
- **Next B1b slice:** strict target natural-key/parent + protected child collision and transaction-bound checks, not just advisory preview; then B2 native/imported audit append-only provenance and complete consistent v14 snapshot, then B3 atomic orchestrator, and B4 explicit release activation. All high-risk remaining steps need source/Neon transaction scrutiny and independent exact candidate tests before enablement.
- **NOT RUN for B1b:** owner Windows canonical six-owned-PG16 164/164 real test gate; authenticated risk browser/release `verify:release:risk`; Neon HTTP query transaction parity; native Safari/VoiceOver or production authenticated smoke. Production DB/schema/flags remain UNKNOWN.
- **Production:** old M0-A Vercel deployment `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` READY source `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; NO merge/deploy/DB/flags. Training untouched. No private user data or credentials persisted.
- **ONE NEXT STEP:** freeze small B1b.2 transaction-bound natural-key/child verification acceptance and verify Neon HTTP fixed-batch atomicity on separate test resources BEFORE its implementation, with M0-A still blocked. Do not request another 164-case Windows full gate until a meaningful release candidate, to avoid repeatedly burdening the owner.
