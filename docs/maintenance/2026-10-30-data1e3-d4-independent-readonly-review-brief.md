# DATA-1E3 D4 — independent AI read-only security review brief (frozen)

**Prepared:** 2026-10-30. **Stage:** READY FOR INDEPENDENT REVIEW, **REVIEW NOT RUN**. This is a request to Claude or DeepSeek; the reviewing model must not be represented as having reviewed the proposal until an actual independent response has been received and reconciled.

## Your reviewer role and immutable starting points

You are an independent **read-only security/database/flight-integrity reviewer**. Please critically evaluate the *proposed* D4 fix, not just the existing reproducible vulnerability; challenge assumptions and locate regressions or missing protection.

- Repository: private GitHub **\`filipto861/flytally-logbook\`**; canonical main \`807f281e5870164b794d001480ecc84e0b45aea5\`.
- Freeze **actual executable source at** \`cf2332d3814fd5f97096608680dffdb1d457c5df\`, Draft [PR #446](https://github.com/filipto861/flytally-logbook/pull/446), stacked on #445 \`d77deeb2dfb0c9312adf3fe6e2cce0d2471f5e86\` and #444/#443. No product SQL fixes are yet present; do not assume released.
- Frozen **design snapshot** at docs-only commit \`48cd4394ed4decb49924dd0c718a9c6932617cfd\`: [Fail-closed D4 hardening design](https://github.com/filipto861/flytally-logbook/blob/48cd4394ed4decb49924dd0c718a9c6932617cfd/docs/maintenance/2026-10-30-data1e3-d4-fail-closed-hardening-design.md). Frozen **owner-run evidence** [4/4 PASS existing baseline / F3,FSTD,F9 safety FAIL](https://github.com/filipto861/flytally-logbook/blob/48cd4394ed4decb49924dd0c718a9c6932617cfd/docs/maintenance/2026-10-30-data1e3-d4-confirmed-synthetic-sql-evidence.md).
- This is a docs-only design **proposed by the lead assistant**, not an owner-frozen implementation algorithm. Owner approved **D4 fail-closed direction** and one disposable local synthetic PG16 test, not merge/deploy/production operations.
- If this private repo or exact files are inaccessible, report **UNVERIFIED** with precisely what you could and could not read. Do not invent source lines, Postgres behavior or external test results. Ask for curated files if necessary.

## Required source index for independent verification

Use immutable GitHub blob URLs at executable SHA \`cf2332d3814fd5f97096608680dffdb1d457c5df\`:
1. \`lib/account-restore-v6.ts:47-85\` classify/identity/conflict handling; \`:119-215\` preview/current checks; \`:217-283\` execution, stage/update/audit/delete/count.
2. \`app/(protected)/export/actions.ts:59-87\`: v13 authenticity/preview/confirmation and separate pre-restore backup boundary.
3. \`lib/db.ts\` and \`lib/local-postgres.ts\`: Neon HTTP \`sql.transaction(queries)\` and local deferred/batched transaction shape, \`RETURNING\` row capture, bounded psql output.
4. \`lib/recovery-conflict.ts\`, \`lib/backup-certification.ts\`, \`lib/portable-backup.ts\`: id/revision/void/certification/account evidence checks.
5. \`lib/backup-center.ts\`: \`pre_restore\` write side-effect and unrelated still-open D2 gzip risk.
6. \`tests/integration/postgres-security-restore.test.ts\`: existing positive baseline.
7. \`tooling/data1e3-d4-source-sql-risk-probe.mjs\`: deterministic synthetic execution of actual source SQL fragments; **not** actual concurrent app sessions.
8. \`DEVELOPMENT.md\`, \`ARCHITECTURE.md\`, \`tooling/development-modules.json\`, \`tooling/postgres-partition-registry.json\`, \`AGENTS.md\` and \`ROADMAP.md\`: critical project gates.
9. For any claimed trigger/constraint proof, inspect exact canonical \`sql/\` migration files and current DB creation/ensure logic; do not infer absent/present trigger behavior from fixture tables alone.

## Empirical evidence (owner Windows, source SHA above)

The owner executed a single **positively identified new disposable loopback PG16** on Windows Node24.19.0. Local preflight PASS, original synthetic PostgreSQL security/restore integration **4/4 PASS**, then \`D4_SOURCE_SQL_INTERLEAVING\` reported:

- \`flightExistingCertificationModified: true\`
- \`fstdExistingCertificationModified: true\`
- \`independentAuditRecordDeleted: true\`
- \`securityResult: FAIL\`
- \`simulatedInterleaving: true\`, \`twoRealSessions: false\`, \`fullAppRestore: false\`
- \`D4_TEST_COMPLETE testStatus: D4_SAFETY_FAIL, baselineStatus: PASS, securityStatus: FAIL, isolation: PASS\`, exit code \`1\`, owned disposable cleanup reported PASS by local tool.

This **establishes the bad SQL fragment effect under deterministic synthetic interleaving**. It does **not** establish that the complete production application with real triggers/audit constraints suffers the same observable effect, nor any production incident. **No actual two-session application race was run.**

## Review questions (must all be addressed)

**R1 F3/child identity:** Does Option A (remove \`ON CONFLICT DO NOTHING\` on *new staged flights and FSTD*) guarantee that no protected existing row can be overwritten if a conflicting identity appears between preview and SQL transaction? Consider uniqueness, update triggers, no-op updates, user scope, cross-account global primary keys, other attached certified children, trust and imported IDs. Identify the smallest correct atomic SQL pattern.

**R2 F9 audit:** Is simply removing broad audit cleanup safe? What legitimate audit/trigger events would then remain from staging and certification restoration? What changes would preserve *independent* append-only audit while avoiding false duplicates or untrusted history? Identify exact migration/trigger evidence and avoid speculative \`xmin\` or blanket disable.

**R3 F8 counts:** Propose exact committed-count strategy for ALL relevant sections under **Neon HTTP** and **local PG adapter**, preserving bounded output and statement-limit. Compare \`RETURNING id\`, \`WITH inserted AS (...) SELECT count(*)\`, dynamic transaction concerns, cases where conflict/skips are legitimate, rolled back transactions, and legacy data.

**R4 Transaction semantics:** Are \`sql.transaction(queries)\`, deferred local PostgreSQL queries, schema ensure and \`pre_restore\` backup side effects handled accurately? Would proposed SQL still be atomic? Is an early \`SELECT\` enough to prevent TOCTOU? Explain locking and concurrent transactions.

**R5 Certified immutable evidence:** Trace flights + FSTD + historical certified revisions + voided flight tombstones + instructor verifications + shared participant provenance. Any bypass in Option A? How to prevent old signed snapshots from replacing newer accepted/current facts? Evaluate whether server-side validation must be rerun at execution time inside transaction.

**R6 Accurate minimal scope:** Can A1 (strict conflict) be safely shipped without A2 audit treatment and A3 true counts, or are these inseparable for D4 acceptance? Recommend sequence of **small batches** with meaningful tests.

**R7 SQL risk probe caveat:** The reproduction's minimal tables may omit real constraints/triggers. Identify what part of F3 and F9 is proven vs hypothetical in an actual configured account; propose a **two-real-session** synthetic fixture on a fully verified disposable local PG16 and a clear failure signal. Should the test be embedded in real app route/service rather than only source SQL?

**R8 Security boundaries:** Validate cross-account restore permission, invalid stored v13 HMAC, pre-restore safety backup, post-restore cleanup and generic error boundaries. What should a client see on uniqueness violation? Ensure no raw SQL/user paths/credentials/GPS leak.

**R9 Compatibility and release:** No new dependencies/schema/flags unless independently justified; old backup versions supported, v21 money, immutable void/audit and existing snapshot semantics respected. What current development registry, source tests, PG16 partition hash inventory, Node/TS/build/browser/risk release gates must run for exact candidate?

**R10 Alternatives:** Evaluate Option B actual inserted-row-only update conditional on \`INSERT ... RETURNING\` and other viable small patterns. Give trade-offs vs Option A, risks and objective criteria for owner selection. If exact algorithm can't be justified from source, say **NEEDS DESIGN / UNVERIFIED**, not approved.

## Deliverable format

Produce an independent Markdown report with:
1. **Verdict for DESIGN ONLY:** \`APPROVE\` / \`APPROVE WITH CHANGES\` / \`BLOCK\` / \`UNVERIFIED\`. This does not approve production or release.
2. **P0–P3 prioritized findings**. Each: ID/severity, exact \`path:line @ executable SHA\` or frozen design section, preconditions/threat model, what is proved or inferred, minimally scoped change, and exact negative/positive regression acceptance. If code unavailable, cite only the provided frozen source and qualify.
3. Separate **confirmed facts** (owner local SQL evidence and exact code) from **unverified production/trigger/two-session claims**.
4. **Decision matrix** for options A and B and required owner freezes (especially treatment of auto-generated audit rows).
5. Concise minimal implementation milestone sequence, acceptance/CI matrix (PASS only if actually executed; otherwise NOT RUN), and single next step.

**Read-only hard stops:** No code changes, PR review submissions/merges/branch edits, build/test/SQL, migrations, production or Neon connection, feature flag/deploy changes. No secrets, real users' flight data/GPS, raw OS command lines, private account files, or invented aviation/regulatory data. Independent reviewer provides advice; owner retains authority.

**ONE NEXT STEP FOR LEAD AFTER REVIEW:** verify each reviewer claim against the exact SHA and source schema, reconcile findings, freeze remaining business decisions with owner, then implement a small D4 code batch on a separate branch; no unapproved merge/deploy/DB work.
