# DATA-1E3 D4 A2 — audit provenance, historic-ID collisions and append-only restoration (DISCOVERY / DESIGN ONLY)

**2026-10-30 | Status: DISCOVERED, proposed mitigation NEEDS review; product SQL NOT CHANGED.**

## Verified frozen authority and evidence

- Repo: \`filipto861/flytally-logbook\`. Canonical \`main@807f281e5870164b794d001480ecc84e0b45aea5\`; source base [Draft #449](https://github.com/filipto861/flytally-logbook/pull/449) \`6fd5597aec03ee7b6cbab4dafd98228fafdaaea1\`; #449 stacked on #448 \`55e3aac2f2a01c1670b0e1b238e45515e711b543\` (A1 strict parent insert), #447/#446/#445/#444/#443. This new A2 branch is **docs-only** stacked on #449, not a new runtime fix.
- Owner explicit D4 policies approved 2026-10-30: **A** retain every independent audit event and genuine trigger event, reject ambiguous archived/protected audit ID conflict rather than quietly delete/skip; **B** no speculative unique natural-flight index; **C** no protected evidence overwrite/skip; **D** actual committed counts and safe messages, pre_restore backup separately reported. Do not conflate policies with proven implementation.
- Prior original exact SQL owner isolated PG16 \`cf2332d...\`: deterministic synthetic F9 \`independentAuditRecordDeleted=true\` when an unrelated event was inserted after pre-read \`MAX(audit.id)\`, and source SQL deleted it. This is executable synthetic SQL, **not** full application/prod audit incident. A1 later owner local \`0891ae0fb5f1a1c99a6982f55e7f701411bee001\`: source SQL + selected triggers, 4/4 baseline and four genuine two-session flight/FSTD collisions PASS, cleanup PASS (owner-local report); **F9 was NOT fixed or retested** by A1. [A1 evidence](2026-10-30-data1e3-d4-a1-owner-pg16-two-session-pass-evidence.md).

## 1. Actual source map: delete, triggers, archive and consumers

| Contract | Code line at source base \`6fd5597...\` | Direct observation |
| --- | --- | --- |
| Audit schema | \`lib/db-optimization.ts:39-43\` | \`flight_audit_log.id BIGSERIAL PRIMARY KEY\` **globally**, row \`flight_id,user_id,actor_user_id,action,old_data,new_data,changed_at\`; no \`origin\`, \`restore_operation_id\`, \`source_audit_id\` or provenance discriminator |
| Trigger | \`lib/db-optimization.ts:60-80\` | \`AFTER INSERT\` logs \`created\` and full \`to_jsonb(NEW)\`; \`AFTER UPDATE\` when row JSONB changes logs \`updated\` with old/new, \`AFTER DELETE\` logs \`deleted\`. Uses \`NEW.user_id\` or \`OLD.user_id\` for actor, not a cryptographically verified current API actor |
| Export | \`lib/account-backup.ts:22-56,62-66\` | Signed v13 portable backup includes **all** \`flight_audit_log\` rows for account under read-only repeatable-read snapshot; \`audit_log\` counts are signed and snapshot-bound. Historic audit IDs are included as exported |
| Backup requirement | \`lib/portable-backup.ts:125-143,226-229,255-260\` | \`audit_log\` required from legacy v5; its \`user_id\` is checked against backup profile for v6+. Other cross-user audit provenance/ID/actor contents not covered by a canonical audit-event equivalence contract |
| Preview | \`lib/account-restore-v6.ts:33,47-60,134-135,168-195\` | \`auditKey = row.id\`, target only \`SELECT id ... WHERE user_id\`; generic \`classify\` treats same-owner matching ID as **skip without comparing audit content**, foreign-owner/global-ID conflicts invisible to preview. Preflight result becomes stale before execute |
| Restore critical | \`lib/account-restore-v6.ts:220-225,233-236,268-270,282-283\` | Reads **global** \`MAX(flight_audit_log.id)\` **outside** write transaction; stage INSERT/UPDATE newly added flights generates audit events; broad \`DELETE FROM flight_audit_log WHERE user_id=$owner AND id>$auditFloor AND flight_id IN planned\` removes any matching event with no transaction ownership check; archived \`audit_log\` then inserted with \`ON CONFLICT DO NOTHING\` (silent loss on any global id conflict). Result \`added\` uses planned counts (A3 open) |
| Display | \`lib/data/flight-audit.ts:8-15\` | User+flight scoped, last 100 events ordered \`changed_at DESC,id DESC\`; \`old_data/new_data\` rendered as changes. Historic/generated events are indistinguishable by provenance. Full certified revision audit page is a **separate** source \`app/(protected)/flights/[id]/audit/page.tsx\` relying on R1/R2 hashes/verification; it does not make audit log deletion acceptable |
| Test evidence | \`tooling/data1e3-d4-source-sql-risk-probe.mjs\` | Deterministic SQL fragment test proves independent post-floor audit deletion on synthetic schema, **without** real multi-client app/trigger effectivity |
| Transaction interface | \`lib/db.ts\`, \`lib/local-postgres.ts\` | Restore uses fixed \`sql.transaction(queries)\`; local adapter defers queries and executes one transaction; dynamic read->modify/SQL based on intermediate result is not automatically supported in Neon HTTP array. Important for safe archive collision handling |

**Important subtlety:** \`BIGSERIAL\` creates a sequence; inserting historical explicit IDs does not automatically advance that sequence. A restored \`flight\` generates a \`created\` event (and later \`updated\` event) consuming new IDs from the target sequence. On an empty target, those generated IDs may collide with backup's archived audit IDs. Even if broad DELETE is removed, current \`ON CONFLICT DO NOTHING\` silently drops the archived events. Conversely, replacing it with unconditional strict INSERT may roll back legitimate recovery whenever those IDs collide. **Neither approach is a complete restore solution by itself.** Do not update sequences with \`setval\` speculatively: PostgreSQL sequences have side-effect/rollback semantics that require actual isolated proofs, and global ID reservations would alter other accounts' behavior.

## 2. Threat model / explicitly distinct failures

**F9a (demonstrated under deterministic synthetic SQL):** independent event for same user/flight appended after global floor read is removed by broad predicate. It is not necessary for the event to belong to the current restore. **Stop broad DELETE entirely**; no ID/changed_at/txid/xmin/window alternative without evidence.

**F9b (source-confirmed, runtime result not yet demonstrated):** archived event ID can collide with a target event, even one belonging to another account; \`ON CONFLICT DO NOTHING\` drops the archived event silently. Since the preview only reads target same-owner IDs, even **same-ID foreign owner** is not seen before execution. The final backup may be reported as partly restored.

**F9c (source-confirmed, runtime result not yet demonstrated):** current owner same-ID event is treated as identical solely on ID. Same owner could have different \`action\`, \`flight_id\`, \`old_data\`, \`new_data\`, \`actor_user_id\`, \`changed_at\`; this is not evidence equivalence. An archivally signed event must not silently disappear based on a numeric ID match.

**F9d (source schema design gap):** real trigger-generated events from **staging** and **certification update** depict database transitions (blank staged fields -> restored fields), but there is no provenance field identifying them as generated by account restore. Keeping them preserves real changes yet could be presented to end users as normal \`created\`/\`updated\` actions, attributed to \`NEW.user_id\`, and could push original events out of the last-100 audit view. **Not permission to discard, hide, relabel, backdate, or rewrite them without an approved provenance policy.**

**Not yet established:** full canonical v21 live trigger effectivity, cross-account ID/sequence collisions during actual stored-v13 restore, two physical concurrent sessions executing complete restore, production incident/history loss. Treat as NOT RUN / UNKNOWN, not proven exploitation.

## 3. Proposed safe A2 design with compatibility gate

**Invariant A2-1 (approved):** absolutely no existing independent audit row may be deleted or rewritten by restore. Remove global \`MAX(id)\` and the broad \`DELETE\` **together**, with test proving not only no delete source line but unchanged existing audit rows under an interleaved independently committed audit.

**Invariant A2-2 (approved):** retain automatically generated \`created\` and \`updated\` events as actual history, do not disable triggers globally. Confirm observed generated events under configured source functions in isolated PostgreSQL.

**Invariant A2-3 (approved):** no silent same-id skip for an archived audit row with different contents/ownership. For a truly identical existing archived event, idempotent skip may be permitted **only** with a source-defined exact immutable equivalence rule (all audit columns, null semantics and timestamps) and transaction-time conflict safety. A different event / foreign owner / concurrent insertion must fail-closed, not leak private data. Same-ID matching is not adequate.

**Blocking compatibility question:** preserving original archived audit primary keys *and* new trigger-generated audit identities *and* non-destructive history may be infeasible for valid legacy/v13 restored backups under current global PK/sequence model, particularly on a fresh target. Before a runtime patch, an isolated PG16 fixture must show a successful, complete meaningful restore with **nonempty archived audit history and nonempty newly generated audit**, without silent loss. If exact-identity strict insertion fails on valid fixtures, A2 is **NEEDS DESIGN**, not PASS: do not ship a restore feature that systematically fails, and do not weaken no-data-loss to force success.

### Candidate mechanisms for independent comparison (none authorized for implementation yet)

- **Option A (minimal fail-closed):** eliminate floor/delete; preflight cross-owner/global-ID collision and exact same-owner row equality; strict archival insert inside transaction; any unexpected conflict aborts full restore. **Pros:** no lost audit, no schema/library migration, simple semantics. **Cons:** likely to reject otherwise-valid recovery when trigger-generated IDs overlap archived IDs, and global-ID ownership can change between preflight and write. Must pass both positive and negative PG fixtures before considered viable.
- **Option B (explicit immutable historic identity + restore provenance):** add an additive, owner-approved \`source_audit_id\` + \`restore_operation_id\`/origin schema contract (possibly separate ledger) for imported events; keep local globally unique \`id\` generated, preserve all original row fields/JSONB and source ID in distinct immutable provenance. Must define provenance uniqueness, legacy compatibility, canonical backup/restore schema, signed v13 digest evolution, actor semantics, FK/consumer behavior, read/write ACLs, migration and index/sequence effectivity, and duplication/idempotence. **Pros:** can restore historical events even when target-generated IDs overlap. **Cons:** schema/backup-version/semantic change, **NOT owner-approved**, not in A2 narrow scope, requires separate ROADMAP revision and owner explicit approval. No silent remapping in current A2.
- **Option C (provably transaction-owned event treatment):** keep separate generated and archived events but identify newly emitted rows using explicit database-enforced provenance tied to exact restore operation, never a generic \`id>floor\` predicate. Could require an approved new audit provenance field or controlled trigger context. PostgreSQL \`SET LOCAL\`/transaction variables must be vetted under Neon HTTP transaction array, row-level trust and local adapter. **Not** permission to delete even transaction-owned generated events under owner policy A, and not an immediate solution to global-ID collisions.

**Recommended immediate delivery:** A2 source-backed discovery, fixed acceptance tests and independent read-only design review **before** SQL runtime changes. Owner policy A is frozen; options that need schema/new provenance require new approval, not inference.

## 4. Mandatory A2 acceptance matrix (all synthetic; no remote data)

| Gate | Fixture/test | Required result / evidence |
| --- | --- | --- |
| A2-00 | Verified fresh newly owned loopback PG16 with canonical schema migration/trigger inventory, exact test SHA | physical PG/data/role identity, production-effectivity proof restricted to disposable local fixture only; cleanup verified |
| A2-01 | Existing same-user same-flight audit row inserted **after** former max floor preflight and before restoration | independent row byte-for-byte **preserved**; no broad DELETE; no global audit mutation |
| A2-02 | Concurrent independent same-user audit append *during* restore in two real sessions | both transactions act correctly, unrelated event survives, no unnecessary serialization/deadlock |
| A2-03 | Backup archived event ID equals existing **other-user** audit ID | abort with generic conflict; other-user event untouched, no PII/record leaks; no silent \`ON CONFLICT DO NOTHING\` |
| A2-04 | Same-owner ID but altered content/actor/changed_at | reject, no silent by-ID equality; all existing/other historical events unchanged |
| A2-05 | Same-owner ID and exact full immutable content | policy-defined verified skip, source evidence unchanged; test optimistic preview becoming stale |
| A2-06 | Fresh valid signed-v13 archive with **nonempty historic audit** and newly staged flight triggering at least \`created\` + \`updated\` | **successful** complete source-backed event preservation or explicit **BLOCK** if current ID semantics make it impossible; both archived and generated events traceable |
| A2-07 | Legacy v5+ backup archived audit without modern provenance fields | no unapproved schema/version rewrite, fail-closed or accepted compatible restore path grounded in actual versions |
| A2-08 | Mid-transaction duplicate audit ID / invalid archived row after an earlier staged flight | atomic main restore rollback, no transient generated history committed; pre_restore safety backup separately retained |
| A2-09 | True configured source trigger INSERT/UPDATE events across certified/draft flights | automatic audit untouched and actor display semantics documented; no mass trigger disable |
| A2-10 | Audit consumer \`getFlightAudit\` last 100 ordering and account isolation | no cross-user leak; truthful provenance/no incorrectly claimed user action; large archive behavior tested |
| A2-11 | Neon HTTP vs local PG fixed transaction arrays and safety envelope | consistent atomicity, result/error mapping, bounded SQL, no raw SQL/PII logs |
| A2-12 | Existing A1 four two-session cases and AC20 positive hashes/GPS/signatures | unchanged and PASS on exact eventual candidate, no regression by A2 |
| A2-13 | Candidate-bound Node/TS/build/PG/browser/registry risk planner | output PASS only on actual exact SHA, not prior proof; production/DB/flags no changes |

**Explicit hard stops:** no merge, deploy, production/Shadow/Training/Neon SQL, migration/feature-flag or unbounded DB writes. No private flights/GPS/signature payloads. Do not mark a source grep PASS as PostgreSQL PASS. Test runner must reuse positive-identity disposable cluster guard and never reuse another DB.

## 5. Questions for independent second-AI reviewer

1. Can the approved invariants A2-1..3 be simultaneously achieved under existing global \`BIGSERIAL\` with original archived IDs and automatic trigger events for a nonempty archive? Show a concrete SQL transaction interleaving, not intuition.
2. Where exactly does the current \`classify\` by ID conceal different same-account audit contents? What minimum existing-row projection and comparison would be necessary, and would it be race safe inside fixed Neon HTTP transaction?
3. Can a strict ID-based insert be viable without resetting/advancing global sequence, and how to test positive legacy/v13 restore? If no, mark Option A **BLOCK** rather than silently substituting schema migration.
4. For Options B/C, what precise additive schema, data ownership, provenance, canonical digest/backup version and audit consumer contract changes would be necessary, and what needs owner approval?
5. How do the real flight trigger's auto-generated \`old_data/new_data\`, actor and \`changed_at\` behave under stage+update? Should legacy audit rows retain source chronology while new events show restored action chronology?
6. Propose minimal two-session *actual-source* PostgreSQL test fixtures on a verified disposable loopback PG16, including cross-user audit ID collisions and true audit-log content equivalence.
7. Verify current user policy: **never delete independent events, retain generated events, fail closed on ambiguous imported audit history**. Does any suggested SQL accidentally violate this?
8. How to avoid unrelated natural-key/child count changes A3/A4, new migration or library scope creep?

Reviewer cannot approve merge, deployment, prod/remote DB writes or an irreversible policy change. Report P0-P3 findings with exact \`path:line@6fd5597...\`, deterministic acceptance, design verdict, uncertainty and one next step. If files not accessible, UNVERIFIED.

**ONE NEXT STEP:** send this new A2 finding/design to an independent read-only reviewer, reconcile the global-ID collision/positive-restore feasibility question with exact source, then propose a scoped A2 implementation or explicit owner decision on provenance schema. A2 product SQL remains untouched.
