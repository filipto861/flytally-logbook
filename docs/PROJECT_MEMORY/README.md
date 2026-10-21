# FlyTally Logbook — durable project continuity

**Scope:** `filipto861/flytally-logbook` only. Not `flytally-training`. This directory stores short, non-sensitive pointers across AI development sessions; it is **not** an alternative ROADMAP, product release record, or approval system.

## Resume order
1. Verify GitHub's actual `main` SHA, feature branch head, open PRs and any deployment evidence.
2. Read `AGENTS.md`, `ROADMAP.md`, `FEATURES.md`, `ARCHITECTURE.md` and task-relevant `DEVELOPMENT.md` sections.
3. Read [SESSION_HANDOFF](SESSION_HANDOFF.md), [ACTIVE_WORK](ACTIVE_WORK.md), and [HANDOFF_PROTOCOL](HANDOFF_PROTOCOL.md). These are pointers to verify, not live status.
4. Apply the existing [AI handoff/reviewer template](../AI_HANDOFF_TEMPLATE.md) when the task warrants a full SHA-bound reviewer transfer.

Never store passwords, credentials, personal pilot log entries, live flight records, exports, raw GPS tracks, customer/personally identifiable data or access tokens in these files. Never authorize or run production DB migrations, destructive DB tests, merges or deployment from a handoff alone. The full contract remains `AGENTS.md` / `DEVELOPMENT.md` and qualified source evidence.
