# DeepSeek — independent DATA-1E3 D4 A2 audit review (read-only)

**Freeze:** executable source at full SHA `6fd5597aec03ee7b6cbab4dafd98228fafdaaea1` in private `filipto861/flytally-logbook`; A2 docs-only Draft PR #450 base is this exact source. Canonical main `807f281e5870164b794d001480ecc84e0b45aea5`. The A1 local PG16 approval is **scoped only** (baseline 4/4 and four real two-session FSTD/flight ID collisions; no full authenticated v13 app restore). The DeepSeek report from previous D4 design review does NOT constitute independent review of this newly discovered A2 audit-ID collision.

## Read FIRST
`docs/maintenance/2026-10-30-data1e3-d4-a2-audit-provenance-and-id-collision-design.md` — source reconciliation and thirteen proposed A2 checks. Read raw source files (provided separately as exact copies, not summaries).

## Full source paths at immutable SHA (line references use this version)
- `lib/db-optimization.ts`: global `flight_audit_log.id BIGSERIAL PRIMARY KEY`, INSERT/UPDATE/DELETE audit trigger (lines 39-80), ensure schema/effectivity.
- `lib/account-restore-v6.ts`: `auditKey`, `classify`, preflight audit list, staging, F9 `MAX(id)` outside transaction and broad DELETE, archival `ON CONFLICT DO NOTHING` (lines 33, 47-60, 119-195, 220-283).
- `lib/account-backup.ts`: signed portable v13 repeatable-read audit snapshot and exact ID retention.
- `lib/portable-backup.ts`: backup versions, ownership and relationship contracts.
- `lib/backup-authenticity.ts`: server-authoritative protected sections.
- `lib/db.ts`, `lib/local-postgres.ts`: Neon HTTP and local transaction semantics.
- `lib/data/flight-audit.ts`: user-scoped audit rendering, last-100 cutoff.
- `tooling/data1e3-d4-source-sql-risk-probe.mjs`: original synthetic F9 reproduction only.
- `docs/maintenance/2026-10-30-data1e3-d4-a1-owner-pg16-two-session-pass-evidence.md`: actual bounded A1 evidence, not A2 evidence.
- `AGENTS.md`, `.agents/skills/database-security/SKILL.md`, `ARCHITECTURE.md`, task section of `ROADMAP.md` for hard stops.

## Frozen owner invariants (not permission for migration)
A. Preserve **all independent existing audit events** and genuine trigger-generated audit events. Never delete on `id > MAX before transaction`, suppress triggers, silently drop/rewrite an archived event, or invent provenance. Abort on ambiguous protected conflict. 
B. Do not add a natural-key UNIQUE index, change schema, or introduce a new audit provenance column/ledger without new explicit owner approval.
C. Parent/child protected evidence conflicts fail closed, no silent skip.
D. Actual committed counts and generic public errors; pre_restore backup can persist after main transaction rollback.
No merge/deploy/production/remote DB action is authorized.

## Core question — provide concrete SQL proof, not just opinion
Given `flight_audit_log(id BIGSERIAL PRIMARY KEY,...)` and an AFTER INSERT/UPDATE trigger that adds audit events for a staged flight, what happens when a correctly signed archive contains original audit `id=1,2` and the newly empty target sequence produces generated `id=1,2` before archival replay? The source currently deletes recent audit using a pretransaction MAX floor then replays archived rows `ON CONFLICT DO NOTHING`. Show whether merely removing DELETE and making archival INSERT strict can preserve both event groups and restore valid archives without adding a provenance field or remapping imported IDs. Include the effects of explicit IDs on PostgreSQL sequences, rollback and concurrency; don't assume `setval` is safe.

## Required review findings
1. Separate **proven synthetic F9 deletion** from source-derived but not yet executed F9b global-ID collision and F9c same-owner ID-only equality risks.
2. Diagnose actual event content, foreign-user audit ID collision, account authorization, differing same-user event, duplicate archived IDs, legacy v5-v12 and v13.
3. Compare a strict no-schema fail-closed algorithm with an additive provenance-column or distinct immutable imported-audit ledger. Determine whether **valid nonempty archive positive recovery** is feasible without schema changes and whether signatures/backups need versioning.
4. Examine audit-created/updated staged transient events, actor mapping and audit consumer `ORDER BY changed_at DESC,id DESC LIMIT 100`; preserve real history and user truthfulness.
5. Check compatibility with fixed transaction query arrays in Neon HTTP/local PG16. No unverified read-modify-write or source HMAC rewrites.
6. Propose exact synthetic two-session PG16 tests: independent event appended after old floor, foreign-owner ID collision, same-owner differing event, same-owner exact event, nonempty archive fresh target, true generated events, rolled-back stage, positive valid replay and original A1 guards.
7. Report severity P0-P3 with **path:line@fullSHA**, CONFIRMED vs INFERRED vs NOT RUN, verdict APPROVE / APPROVE WITH CHANGES / BLOCK for **design only**, recommended safe algorithm and ONE NEXT STEP.

**READ-ONLY REVIEW:** Do not edit source, run SQL, access any database or deploy. If the files are incomplete, state UNVERIFIED; do not invent missing results. Do not claim to have validated production.
