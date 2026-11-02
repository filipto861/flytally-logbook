# M0-B B1b.2c — docs-only identity/coordination design checkpoint

**UTC:** 2026-11-02T20:51Z. **Repository:** `filipto861/flytally-logbook`. **Verified main:** `c9c2f60303236113a223942072311f5e37f876f7`. **Branch:** `docs/logbook-m0b-b1b2c-event-contract-20261102`, parent Draft #458 HEAD `49f7aeb85e5e61b3256d28cfb4937d38d33dba13`; work pre-checkpoint commit `a8c7a3ca4317db5de55ee5c7bd5cb1127dcdf7fc`, latest SHA must be independently read from GitHub after commit. Stacked #458→#457→#456→#455; B0 #454 separate. Draft **PR #459** created against #458; verified source-only candidate before this addendum: `f8f7cf1a5a74a5cb78565dad3c61763870e38029`, GitHub comparison: exactly 6 Markdown files, ahead 2 / behind 0, mergeable=true at post-create readback. Final addendum commit SHA to be verified after push.

## Files/scope
- New `docs/maintenance/2026-11-02-m0b-b1b2c-event-identity-concurrency-v22-design.md` and this checkpoint; updates to `ROADMAP.md`, `ARCHITECTURE.md`, `docs/PROJECT_MEMORY/SESSION_HANDOFF.md`, `docs/PROJECT_MEMORY/ACTIVE_WORK.md`.
- **Owner request:** continue B1b.2c design and safe planning. No explicit permission for production DB migration, merge, deploy, restore activation, production flags, destructive SQL or Training. Proposed immutable UID/event lifecycle and DB-trigger enforced account guard, v14 trust/membership and additive V22 migration outline are NOT deployed, executed, or final owner-approved schema.
- **Risk / DO NOT:** do not treat restore-only advisory or global table locks as safe; do not auto-unique the fingerprint; do not accept legacy source ID as authenticated issuer; do not remove M0-A. SQL trigger exhaustive writer map, multiuser deadlocks, v14 account trust and Neon HTTP snapshot semantics UNVERIFIED.

## Exact candidate evidence
| Evidence | Status | Authority |
| --- | --- | --- |
| Source-only GitHub discovery / documented design | PASS for documentation creation, not runtime proof | main/parent SHA as above, new design file |
| New B1b.2c Node/TS/build/PG16/Neon HTTP/browser/risk | NOT RUN / N/A (docs-only scope) | No new executable changes or tests |
| B1b.2b historical targeted Node/source/PG16/TS/build | PASS ONLY for older executable SHA | Actions #41520038331, `b5c95731efe93bfe9556c929274bd833a11bb1a7` |
| Canonical Windows six-owned-PG16 164/164 for this stack | NOT RUN | No current exact-head evidence |
| Independent DeepSeek/Claude read-only architecture review | NOT RUN | Reviewer packet embedded in design |
| Vercel deployed M0-A metadata/alias | PASS (read-only provider inspection) | `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub`, app SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, alias `fly-tally.com` |
| Production DB/schema/flags, authenticated smoke | UNKNOWN / NOT RUN | No production DB connection or auth smoke |

**DB/migration/flags/deploy:** NONE performed; V22 design only. M0-A remains in production; no permission to execute remote/prod SQL. `FEATURES.md` and `CHANGELOG.md` reviewed; no change as no capability shipped. `DEVELOPMENT.md` and skills used for verification boundaries.

**ONE NEXT STEP:** independent read-only review and severity-ordered reconciliation of the exact frozen B1b.2c design against code; only then isolated executable prototype and tests under separately reviewed scope. No merge/deploy/production DB.
