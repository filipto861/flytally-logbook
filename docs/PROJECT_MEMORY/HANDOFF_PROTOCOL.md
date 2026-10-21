# Cross-chat checkpoint and recovery procedure

## Start every work session
1. Independently resolve GitHub `main`, selected work branch and current PR head/base; read `AGENTS.md`, `ROADMAP.md`, `FEATURES.md`, `ARCHITECTURE.md` and relevant `DEVELOPMENT.md` scope.
2. Read [SESSION_HANDOFF](SESSION_HANDOFF.md), [ACTIVE_WORK](ACTIVE_WORK.md) and the [existing detailed AI handoff template](../AI_HANDOFF_TEMPLATE.md).
3. Compare pointers with actual code, PR comments, evidence and any provider state; if mismatched, state the conflict and use the verified present state. Never treat a previous chat or checkpoint as live deployment/test authority.

## Write a milestone checkpoint
Checkpoint **after each substantial owner decision, merged/approved change, completed implementation or test stage, new blocker, PR/base change, pause or AI/chat handover**. Also checkpoint early when context space may run out. Prefer small, coherent commits so interrupted chats do not lose work.

For each checkpoint record: (1) UTC date/time; (2) `main` and work head full SHA with verification source; (3) PR/base and affected file paths; (4) exact owner scope/approval limitations and DO NOT; (5) verified tests/evidence for that SHA labeled PASS/FAIL/PARTIAL/NOT RUN; (6) DB/migration/feature flag/deploy status, including UNKNOWN where not inspected; (7) outstanding blockers and local-only assets; (8) **one immediate actionable next step**.

- On scoped work branch, update the short rolling [SESSION_HANDOFF](SESSION_HANDOFF.md); update [ACTIVE_WORK](ACTIVE_WORK.md) only when workstream state materially changes. Do not push directly to `main`.
- Keep long-lived roadmap authority in `ROADMAP.md`, capabilities in `FEATURES.md`, shipped history in `CHANGELOG.md`, technical design in `ARCHITECTURE.md`. Do not rewrite dated history or multiply canonical owners.
- Use [AI_HANDOFF_TEMPLATE](../AI_HANDOFF_TEMPLATE.md) for an independent reviewer, sensitive design or full transfer; freeze exact SHA and identify read-only scope.

## Recovery when the chat hits its limit
Start a new chat with:

> Pokračuj na FlyTally Logbook. Ověř GitHub main SHA, aktuální PR a pracovní větev. Načti AGENTS.md, ROADMAP.md, docs/PROJECT_MEMORY/SESSION_HANDOFF.md, ACTIVE_WORK.md, HANDOFF_PROTOCOL.md a relevantní technické dokumenty. Pokračuj od posledního skutečně uloženého commitu bez merge či nasazení.

If no checkpoint was pushed, provide a clearly marked **UNPERSISTED HANDOFF** in chat. Work that existed only in conversation or a local uncommitted checkout might be missing; never claim it was saved remotely.

## Security and hard stops
- Treat actual application, PostgreSQL and deployment evidence as authoritative. Keep test fixture and production Neon targets separate; never run destructive tests against a remote DB.
- No secrets, personally identifiable pilot/flight data, private GPS exports or regulatory self-approvals in project memory.
- A handoff cannot authorize merges, production deploy, data migrations, restores, feature flags, certification changes, or deletion of branch/history. Obtain explicit owner approval and run risk-selected verification under `DEVELOPMENT.md`.
