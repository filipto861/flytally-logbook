# DATA-1D — large signed-account backup transport and restore atomicity: source audit / review gate

**Prepared:** 2026-10-29T19:11:48.769Z UTC, read-only source audit.
**Logbook canonical main:** `807f281e5870164b794d001480ecc84e0b45aea5`.
**Source candidate inspected:** `3997a5ef2093e50ee9b791f205c6a75b397ae299` (DATA-1C Draft PR #436, stacked on #435 and #434).
**Design branch:** `docs/logbook-data1-snapshot-design-20261029` (Draft PR #433).
**Owner scope:** continue DATA-1 development **without running tests**. No merge, deploy, production DB/flags, migrations, restores, destructive operations, Training changes, or new unapproved dependency.
**Stage:** DISCOVERY / ANALYZE / DESIGN. **No DATA-1D runtime code change.** Independent review of this materially corrected proposal PENDING.

## Verified executable facts — correction to review C5

1. **Current-format restore is already transactional.** In `app/(protected)/export/actions.ts:restoreParsedBackup`, all backups with `version >= 6` use `prepareExactAccountRestore` then `executeExactAccountRestore`. In `lib/account-restore-v6.ts`, `executeExactAccountRestore` constructs the SQL statement array, checks `queries.length > EXACT_RESTORE_STATEMENT_LIMIT`, then executes **one** `await sql.transaction(queries)` before reporting success. `lib/recovery-scale.ts` sets the exact statement limit to **1000**. The many *row batches within the array* do **not** each commit separately. Therefore a fully committed-but-partial **current v13 exact restore** from multiple writer transactions is **NOT supported by this source**. This corrects prior generalizations in Claude review C5 and earlier Project Memory about “multi-batch exact restore.” Single-transaction atomicity is a source contract, **not runtime-tested acceptance in this session**; races with *other* concurrent writer operations still need future verification.
2. **Legacy restore remains non-atomic.** In `app/(protected)/export/actions.ts`, the fallback `version < 6` path runs `restoreLegacy`: it commits `metadataQueries` separately, each `flightBatches` transaction separately, then per-flight updates. A concurrent backup could observe a committed intermediate legacy-restore state; a later batch failure could leave a partial legacy restore. Existing safety pre-backup occurs before writing; behavior change or retirement of legacy restore is **out of DATA-1D scope** until product owner decides and it receives independent review.
3. **Backup generation:** `lib/account-backup.ts` candidate uses one Neon HTTP `sql.transaction` with two MVCC state probes + 30 original SQL SELECTs and format v13 digest/signature after pre-sign validation (PR-A/B/C stacked, all **UNTESTED**). A single HTTP batch aggregates results into one response, rather than independent requests. Large `flight_tracks.coordinates_json` and evidence JSON are potential dominant contributions.
4. **Stored backup:** `lib/backup-center.ts:createStoredBackup` serializes pretty JSON, `gzipSync(...,{level:9})`, rejects compressed byte length **over 50 MiB** (`50*1024*1024`), then converts compressed bytes to Base64 and interpolates the entire Base64 string in **one HTTP SQL INSERT**. Base64 expansion means an archive below the 50 MiB cap can nonetheless exceed a smaller HTTP request limit. `loadStoredBackup` reads `payload_base64` in **one SQL SELECT**, independently exposing the response-size ceiling. Both upload and download directions matter; a cap only on the export batch is insufficient.
5. **Scheduled backup:** `app/api/cron/backups/route.ts` runs up to **500** user backups sequentially with `maxDuration=300`. `lib/backup-center.ts:ensureDailyBackup` catches failures and returns `null` for the `/data` page path, conflating an actual failure with a legitimate “already has a recent automatic backup” skip at that API boundary. Cron separately counts thrown failures with HTTP 207 if any. No promise of successful per-account 24-hour coverage on an overloaded cron can be made.
6. **Local smoke adapter:** `lib/local-postgres.ts` uses `spawnSync("psql",... maxBuffer:16*1024*1024)`. Its single snapshot batch can overflow this diagnostic buffer even when Neon HTTP succeeds. This is a **fixture-adapter** constraint, not the real Neon runtime transfer limit; changing it only for local acceptance should preserve safe bounded memory and clearly surfaced errors.
7. **Vendor size bound:** Claude reported **64 MB** for HTTP request and response. Public secondary guidance also mentions it. However **exact vendor maximum and whether MB vs MiB and JSON wire count were not independently verified against a currently accessible canonical vendor spec**; no Neon branch or account was queried. Do **not** encode 64 MB as an asserted app constant or promise based on this review.

## Design options and recommended order

### D1 — retain HTTP, fail closed, gather bounded evidence (RECOMMENDED first)

- Retain the staged `sql.transaction` snapshot semantics and two checked MVCC probes; never fall back to 30 independent reads if an HTTP response is too large.
- A transport error, short/partial batch response, missing profile, signature/archival validation failure or oversized stored Base64 payload must stop with an explicit typed `UNAVAILABLE` reason. Never produce an incomplete signed backup or a misleading “successful backup” state.
- On a **synthetic isolated Neon branch only, after permission to test**, measure: 32-result HTTP raw response bytes and duration; per-section count and lengths including realistic JSON/GPS; peak RSS; gzip bytes, Base64 bytes, complete INSERT HTTP request bytes; stored backup SELECT response bytes; scheduled backup per-user and aggregate runtime. No raw flight data/GPS/PII in evidence.
- Decide an **evidence-backed** safety envelope for upload, download and export; do not invent a threshold while testing is forbidden. A conservative limit must be documented by bytes, count method and source.
- Until an accepted envelope exists, the staged candidate remains **BLOCKED FOR RELEASE**. It can fail closed on provider errors, but large accounts could lose automatic/pre-restore backup availability. This is not a harmless performance change.
- Separate future UX change should distinguish skipped automatic backup vs failed/unavailable backup; do not mix user-visible feedback into DB engine slice without full Apple Design skill/playbook.

### D2 — interactive PostgreSQL session for large snapshots (CONDITIONAL, NOT APPROVED)

- If synthetic evidence shows normal supported accounts exceed HTTP batch envelope, evaluate Neon serverless `Client` / `Pool` WebSocket interactive **single-session** `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`, reading the same 30 unchanged SELECTs sequentially, with first/end probe on the same connection and guaranteed rollback/cleanup on failure.
- Do not share an interactive transaction across pooled/recycled sessions. Keep the `userId` owner predicates, v13 envelope and pre-sign validators unchanged. Be aware that JS still holds rows for full signing: breaking HTTP response into per-SELECT packets addresses only one limit, not total memory/serialization cost.
- Requires explicit runtime/package compatibility review (Node24/Vercel driver1.1.0), connection lifetime, serverless timeout and maximum account size verification. No silent runtime switch or unreviewed dependency.

### D3 — chunked storage / external object store (OUT OF SCOPE, owner approval required)

- Changing `account_backups` storage structure or moving signed payload to object storage requires a new durable data model, migrations, backward-compatible readers, authorization, retention/rollback plan and distinct owner approval. Not a shortcut for DATA-1D.

## Frozen DO / DO NOT

- DO preserve current-format v13 exact restore atomicity; no unnecessary redesign of `executeExactAccountRestore`.
- DO retain separate historical legacy (<6) behavior until its retirement/atomicity scope is approved; don't mislabel it as v13.
- DO preserve existing account data and previously stored signed backups; no truncation/deletion or rewriting voided/certification evidence.
- DO reuse exact v13 SELECTs/signature and audited validation, with read-only snapshot or explicit UNAVAILABLE.
- DO NOT query production Neon, measure real account records, change schema/flags, merge, deploy, touch Training or run any tests under the current owner directive.
- DO NOT store raw GPS/PII, pretend HTTP limit is a verified contract, add auto fallbacks, or claim “fixed / releasable” without exact candidate evidence.

## Future acceptance / evidence ledger (all NOT RUN by owner directive)

- Concurrent flight+track+expense+certification mutations: source snapshot is one committed state; owned v13 exact restore is single-transaction all-or-nothing on a disposable PG16 fixture, legacy restored separately.
- At synthetic realistic payload boundaries: HTTP batch request/response, storage Base64 INSERT and SELECT, 16 MiB local adapter output; typed failure without signed/stored partial and no rollback of preexisting backup records.
- Provider branch: Neon serverless 1.1.0 transaction probes verify actual server isolation; Vercel runtime memory and duration; cron throughput/500-user cap, daily skipped-vs-error semantics; current signature/restore compatibility.
- Retain separate restoration of legacy <6 behavior; never claim one atomic guarantee for both.
- Source tests, typecheck, full Node, build, PG16, Neon branch, CI, browser, production smoke: **NOT RUN**. Production DB/schema/flags UNKNOWN.

## Independent second-AI follow-up (new material evidence)

Claude's previous review C5 conflated `restoreLegacy` with `executeExactAccountRestore`. Reviewer should read the verified exact calls and **correct C5** rather than designing a v13 restore migration. Request read-only verdict on D1 transport safety and conditional D2; report supported HTTP request/response ceiling and whether a small no-data-loss release can be justified without large-account measurements.

**ONE NEXT STEP:** obtain one updated independent read-only review of corrected DATA-1D design at its exact review commit (no tests). Then reconcile the specific recommendations and choose the smallest runtime slice, subject to the owner's release authority.
