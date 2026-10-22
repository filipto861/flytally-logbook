---
name: release-workflow
description: Apply to GitHub branch/PR workflow, canonical documentation, versioning, Vercel release, approvals, evidence reconciliation and cross-chat Project Memory checkpoints.
---
# Release and Development Workflow

## When to load
Task kickoff/continuation, scope/milestone changes, PR creation, docs closeout, pre-release verification, deployment or session end.

## Procedure
1. Independently verify Logbook repository, main SHA, relevant work branch HEAD/base and open PRs. Read AGENTS.md, ROADMAP, FEATURES, ARCHITECTURE, relevant DEVELOPMENT/CHANGELOG and Project Memory; reconcile drift explicitly.
2. Confirm scope, product owner decisions, dependencies, frozen behaviors, prohibited work and smallest reversible milestone. Significant new direction gets ROADMAP approval before runtime changes.
3. Use a dedicated branch and short PR; preserve unrelated draft PRs and existing history. Avoid direct main changes. For major/high-risk designs, request independent read-only DeepSeek/Claude review before implementation, then reconcile findings.
4. Invoke relevant domain skills. Trace affected files, contracts, implementation and selected tests. Record gates on exact candidate SHA, not historical version/date.
5. Update canonical ROADMAP/FEATURES/CHANGELOG when their respective ownership warrants it; Project Memory is only a short pointer. At milestone, owner decision, blocker and handover write an exact-SHA checkpoint per HANDOFF_PROTOCOL.md.
6. Require explicit owner permission BEFORE merge, production deploy, DB migration/restore/delete or production flag change; permissions do not transfer between actions.
7. Verify Vercel target, commit/deploy ID, READY and public/authenticated smoke individually if explicitly performing deployment.

## Hard stops
Build is not production acceptance. Unmerged draft isn't shipped. Handoff isn't permission. Do not modify flytally-training. If GitHub not accessible, report UNVERIFIED; if work not pushed, UNPERSISTED.

## References and verification
AGENTS.md, ROADMAP.md, docs/PROJECT_MEMORY/HANDOFF_PROTOCOL.md, DEVELOPMENT.md, docs/AI_HANDOFF_TEMPLATE.md, actual provider state. End each session with branch/full SHA/PR/tests/DB/flags/deploy/risks/one next step.