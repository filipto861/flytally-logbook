---
name: production-readiness
description: FlyTally Logbook production-readiness and security audit across deployment, CI/testing, authentication, data integrity, observability, recovery, privacy, cost and dependency supply chain. Read-only evidence-first assessment; never deploy or touch production data by default.
---
# FlyTally Production Readiness & Security — audit skill V1

## Trigger
Use for a production/security/operational readiness audit, website launch review, risk register, hardening backlog, disaster-recovery exercise planning or evaluation of a viral “things to do before shipping” checklist. Always read `AGENTS.md`, the current main SHA, `ROADMAP.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, the skills registry, Project Memory, and this full skill. Combine with **database-security**, **testing-quality** and **release-workflow** for this broad audit. Treat `flytally-training` as a different project.

## Mission / evidence contract
1. **Read only by default.** Establish exact repository/base SHA, environment and inspected scope. Read current code/config, GitHub check evidence, connected Vercel and Neon read-only metadata only when identity is verified. Never test destructive routes, provision resources, read secret values, query personal records or run authenticated mutations to “see if auth works”.
2. **Distinguish states:** `VERIFIED` = current, direct execution/provider evidence, with environment/time/SHA; `IMPLEMENTED—UNVERIFIED` = current code/config or prior evidence but no current functional verification; `PARTIAL` = some sub-controls supported; `GAP` = clearly absent in inspected current scope; `UNKNOWN` = evidence inaccessible or not inspected; `N/A` = genuinely irrelevant with reason. **Absence of a keyword is not a gap**. Provider configuration is not equivalent to end-to-end function.
3. **Severity:** P0 = credible immediate exposure/data-loss risk requiring evidence or mitigation before high-impact operations; P1 = important production hardening; P2 = quality; P3 = optional. Do not call an unconfirmed concern a vulnerability. State `CONFIRMED`, `POSSIBLE` or `NOT VERIFIED` separately from impact.
4. For every finding provide control ID, state, evidence path/provider reference + exact SHA, impacted surface, *next verification step*, smallest safe remediation, owner, and confidence. Avoid blanket scores or fake green ticks.
5. Audit using [CONTROL_MATRIX](references/CONTROL_MATRIX.md), flag existing local mechanisms rather than demanding fashionable vendors. Prioritize `auth/tenancy → verified restore → incident visibility → controlled releases → performance/accessibility`.
6. **Two phases:** A — passive discovery and gap matrix; B — evidence-based validation plan. Execute only non-mutating tests in an isolated checkout. Guarded integration/browser/restore/failure-injection tests require a verified disposable loopback PostgreSQL target and applicable authorization; production recovery exercises, spend changes, SMS/email delivery and key rotation require separately scoped owner approval.
7. Preserve protected/certified flight revisions, signed verification, pilot consent, UTC/flight-time semantics, GPS provenance and fail-closed compliance. Security UX must not auto-complete flight fields or change records. Do not expose personal logs, GPS tracks, env values, email recipients or account tokens in output.
8. The existing `vercel.json` intentionally disables automatic Git deployment. Do not “fix CI/CD” by switching it on. Current manual release controls, exact-SHA release gates and rollback requirements remain authoritative.
9. Record dated findings in `docs/audits/production-readiness/` on a **scoped work branch**; update project-memory handoff for the workstream. A report/skill PR is not evidence of production readiness and does **not** authorize merge, deploy, DB migrations, billing changes or secret rotation.

## Audit execution order
- **1 Scope and identities:** verified main SHA, PRs, production target and API/DB boundaries; inventory applicable controls.
- **2 Safeguard audit:** auth server endpoints, tenancy, session, secrets, rate limits, input validation, CSP/security headers, packages/CI secrets; classify confidence.
- **3 Reliability audit:** transactions, schema gates, backup cadence/retention, *restore drill evidence*, recovery time/point targets, cron observability, incident handling and rollback procedure.
- **4 Shipping audit:** CI/manual QA, GitHub branch policy, locked Node/Playwright, unit/integration/browser/regression evidence, staging separation, deploy guard, error telemetry, uptime/performance alerts and cost limits.
- **5 User/trust audit:** privacy/terms/deletion, registration/verification/reset, cookie legal basis, export, retention, mobile/slow networks, 404/500/loading/empty, accessibility and public-page SEO only. For AI prompt injection/evals/context controls return N/A unless a real LLM request boundary exists.
- **6 Deliver:** compact executive summary (no false completeness score), machine-readable optional evidence table, prioritized P0/P1/P2 issues, explicitly *not tested*, next concrete non-destructive verification and immutable GitHub PR.

## Hard stops
- No test/restore against remote Neon; no public endpoint brute force, synthetic-account creation or rate-limit pressure against production.
- No raw `.env` reads or connector responses containing secret values in results/reports. Verify *presence/names only* if access permits.
- No silent installations, cost changes, alert emails, new third-party monitoring, cron edits, GitHub enforcement changes or DNS.
- No security issue title asserting a breach without directly reproducible, authorized evidence.
- Never label backup “verified” from the existence of backup-export code or a scheduled cron alone.
- No direct pushes to `main`, merges or deployments without separate explicit owner approval.

## Required output
Repo SHA/branch, inspection date, exact evidence sources, control matrix counts by evidence state, top 3–7 risks (clear confirmed vs unknown), short milestone plan, tests actually run/NOT RUN, production status known/unknown, next step, PR, and Project Memory checkpoint.
