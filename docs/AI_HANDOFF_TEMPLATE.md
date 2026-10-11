# FlyTally — AI handoff and independent review protocol

**Purpose:** Transfer only the **current actionable state** across ChatGPT sessions and from ChatGPT to an independent AI reviewer (DeepSeek or Claude). The canonical repo still takes precedence. This is a reusable template, not an active handoff.

## 1. Collaboration workflow

- **Owner:** prioritizes, approves product behavior, significant scope/risks and release decisions.
- **ChatGPT (lead):** reconstructs actual repo, does discovery and source review, proposes a small design/roadmap, implements accepted slices, runs/verifies permitted gates, updates canonical docs and produces closing evidence.
- **Independent reviewer (DeepSeek or Claude):** receives **read-only** SHA-bound design/diff and bounded questions when appropriate; returns finding severity, source, alternative, risks and approval conditions. No automatic authority to deploy, merge or alter data.
- **Review triggers:** architecture/data model, auth/security, aviation/regulatory/recency logic, certification/backup/restore, schema/migrations, migration/legacy retirement, irreversible operations, complex performance/interpolation, major UI refactor, release governance, disputed evidence.
- **No repeated model loop:** one independent review per frozen proposal. Lead reconciles each finding into **ACCEPT / REJECT with verified evidence / DEFER for owner**. Ask again only with material new evidence.
- **Routine changes:** no independent AI review by default; use the existing scoped development/test contract. Split significant work into small commits/PRs and verify required gates only.

## 2. Copy/paste template

Fill in what is *actually known*; write `UNKNOWN`, `NOT RUN` or `N/A` where appropriate. Never fill a field from guesswork.

### Repository and identity

- Repository: `filipto861/flytally-logbook` (do not touch `flytally-training`)
- Date and baseline `main` SHA:
- Work branch, candidate exact SHA, PR link:
- Current product version **as observed**, package source, and deployment SHA/alias evidence (if relevant):

### Intent and frozen decisions

- Owner request and decision (quote or link):
- Last completed milestone and actual evidence:
- Current phase, next smallest step:
- Scope / affected modules/files:
- Explicit DO NOT / exclusions:
- Frozen contracts, applicability, migrations and backward-compatibility requirements:

### Discovery and proposed solution

- Actual routes/components/types/schema/API/tests inspected (paths):
- Relevant source documents + revision/effectivity when critical:
- Proposed minimal design; rejected options and rationale:
- Risks/edge cases/security and rollback plan:
- Acceptance criteria per milestone:

### Evidence ledger

| Gate / check | Required? | Exact command / source SHA | Result (`PASS`, `FAIL`, `NOT RUN`, `N/A`, `PARTIAL`) |
| --- | --- | --- | --- |
| Source / domain tests | | | |
| TypeScript / Node / build | | | |
| PostgreSQL / migrations / scale | | | |
| Browser (desktop, iPad Safari, mobile) | | | |
| Feature flags / legacy compatibility | | | |
| GitHub CI / Vercel deployment / production smoke | | | |
| ROADMAP / FEATURES / CHANGELOG review | | | |

### Independent reviewer questions

1. [Specific architectural/contract question requiring challenge]
2. [A concrete edge case or failure hypothesis]
3. [Alternative with trade-off and owner decision point]

**Reviewer response format:** Verdict (`APPROVE`, `APPROVE WITH CHANGES`, `BLOCK`); severity-ordered findings with exact file/SHA and observed vs inferred facts; bounded options; checks/risks; explicit owner choices. **No implementation in reviewer mode.**

**Final handoff:** State the outcome, current branch/main, merged PR/commit, tests, schema/deploy, unfinished risks and next exact task. Always reconstruct from current repo in the next chat; this handoff never overrides it.
