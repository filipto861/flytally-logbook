# FlyTally Logbook — AI contributor entrypoint

This is a **stable navigation contract**, not a second product roadmap or a substitute for the actual repository. It applies to changes in **`flytally-logbook` only**. `flytally-training` is a separate repository; do not modify it for Logbook work.

## Start every new work session

1. Inspect actual `main` / branch HEAD, changed files, open PRs and relevant runtime/tests. Treat GitHub and deployed evidence as primary, not prior chat claims.
2. Read [ROADMAP](ROADMAP.md) for **current** state, next task, dependencies and frozen owner decisions; [FEATURES](FEATURES.md) for capabilities; [ARCHITECTURE](ARCHITECTURE.md) for active technical/data/security contracts.
3. Read only relevant sections of [DEVELOPMENT](DEVELOPMENT.md), [CHANGELOG](CHANGELOG.md), [docs index](docs/README.md) and the exact dated acceptance/source documents needed. Do not ingest all history by default.
4. Read [rolling session handoff](docs/PROJECT_MEMORY/SESSION_HANDOFF.md), [active work pointers](docs/PROJECT_MEMORY/ACTIVE_WORK.md) and [checkpoint protocol](docs/PROJECT_MEMORY/HANDOFF_PROTOCOL.md); independently verify their branch/PR/SHA claims. Resolve source conflicts before code. Never promote historical `Draft`, `PASS`, `FAIL`, `NOT RUN` or version numbers into present status without matching date/SHA.

## Work safely and efficiently

- Preserve canonical flight integrity, certification/audit evidence and explicit aircraft/regulatory applicability. Missing or conflicting critical data must **fail closed**, never become invented/default approved values.
- Make small, scoped changes. Follow [candidate-bound risk verification](DEVELOPMENT.md): tests are selected by actual touched surface; mandatory evidence may never be skipped or declared PASS without execution. Protect DB targets and never claim production approval from build alone.
- Review ROADMAP, FEATURES and CHANGELOG at meaningful milestone closeout. Preserve dated records and decisions; do not silently rewrite history.
- Source authority: executable code/schema/tests and actual deployment evidence > ROADMAP current decisions > FEATURES capabilities > CHANGELOG dated actions > active contracts > dated history. Final product decisions belong to the owner.
- A broad/new or high-risk design warrants an **independent, read-only AI review (DeepSeek or Claude)** after discovery/design and before implementation; small routine fixes do not. See [AI handoff & review protocol](docs/AI_HANDOFF_TEMPLATE.md). Review once per frozen design unless materially new evidence arises.

Do not store credentials, private user flight records or unsupported regulatory claims in AI handoffs. No implicit approval for deploys, migrations, feature flag changes or irreversible actions.

## Durable checkpoint at each milestone

After meaningful owner decisions, stage completion, new blockers, PR updates, chat pauses or agent handovers, follow the [cross-session checkpoint protocol](docs/PROJECT_MEMORY/HANDOFF_PROTOCOL.md) on the scoped work branch. This records commit/evidence/next action, not private pilot data. An uncommitted checkpoint must be marked **UNPERSISTED**; no handoff bypasses test, DB safety, merge or deployment controls.
