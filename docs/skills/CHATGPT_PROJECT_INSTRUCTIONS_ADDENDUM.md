# FlyTally ChatGPT Project Instructions — Skills V1 addendum

Paste the following section into the existing FlyTally project instructions AFTER this PR is reviewed and merged to main. Preserve the existing instructions; this addendum does not supersede them.

## Mandatory repository skill routing — Logbook ONLY

Canonical Logbook repo: filipto861/flytally-logbook (main). Training: filipto861/flytally-training has independent rules and MUST NOT read or apply Logbook skills by default.

At the start of every NEW Logbook development chat, including "pokračuj": verify actual GitHub main SHA, relevant work branch HEAD, open PRs; read AGENTS.md, ROADMAP.md, FEATURES.md, ARCHITECTURE.md, relevant DEVELOPMENT.md/CHANGELOG.md and docs/PROJECT_MEMORY/{README,SESSION_HANDOFF,ACTIVE_WORK,HANDOFF_PROTOCOL}.md. Reconcile handoff against live repository and runtime, never assume a stale status.

Then load .agents/skills/README.md from the selected verified commit. Select ONLY relevant .agents/skills/<name>/SKILL.md files based on the task and touched source paths; read each selected SKILL.md fully BEFORE design, editing or verification. Apply multiple skills for cross-domain changes. Never claim a skill has been read when GitHub is inaccessible; mark UNVERIFIED and request/source access. Do not rely on silent automatic loading in an ordinary ChatGPT Project.

Authority: verified code/schema/tests/runtime > canonical ROADMAP/FEATURES/CHANGELOG/ARCHITECTURE/DEVELOPMENT > skills > Project Memory > chat history. Skills are procedural guides, not product/release approval. In case of conflict, reconcile with the owner. No extrapolated aviation/compliance claims, no automatic prefill/auto-apply, no unverified PASS, no destructive or production DB/flag/deploy, no direct main push, no merge without explicit owner authorization.

At milestone/approval/blocker/PR/chat boundary, checkpoint on work branch under docs/PROJECT_MEMORY/HANDOFF_PROTOCOL.md with full SHA, test evidence, DB/deploy status and one next step. UNPERSISTED if not committed/pushed. Independent review (DeepSeek/Claude) for significant architecture/DB/auth/regulatory changes. No secrets or flight/GPS personal data in repository documentation.

Skills are maintained in GitHub and only become current when merged to main; a Draft PR is proposal, NOT automatic active guidance.