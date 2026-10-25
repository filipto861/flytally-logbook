# FlyTally Logbook — Production Readiness & Security Audit, pass 1

**Date:** 2026-10-25. **Assessment type:** non-invasive, read-only source/configuration plus limited GitHub/Vercel provider-metadata verification; **not a penetration test or release acceptance**.

**Audited baseline:** `filipto861/flytally-logbook@bdbadf863f3e6182dbbe1e3369c71644bb6595b9`, verified current `main` at audit start. **Delivery branch:** `docs/production-readiness-audit-20261025` (skill and report only). `flytally-training` excluded.

## Executive finding

**Overall: substantial existing engineering safeguards, but production resilience is NOT fully verified.** FlyTally has dedicated session/auth hardening, protected-user database access, development/release verification infrastructure, restore-integrity tests, browser/device coverage, private-beta legal documents, Next.js security headers and user-owned backups. Do not replace these.

Highest unclosed evidence items: independently recoverable/offsite disaster recovery with RPO/RTO, tested production observability/alert routing, full API authorization inventory, provider cost controls, current exact-SHA release evidence, and growth behavior for daily jobs. No actual exploit, breach, data loss or current outage has been demonstrated.

**Method:** loaded `AGENTS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, Project Memory and three existing specialist skills. Inspected `vercel.json`, GitHub workflows, `next.config.ts`, `package.json`, `.gitignore`, selected `app/api` + authentication and backup/restore code, privacy/legal, diagnostic/health code and historical targeted evidence. Independently inspected Vercel project/deployment metadata. Only source/config and provider metadata were read; no authenticated user data, secrets, production DB queries, HTTP attack simulations, real browser or DNS checks.

### Verification / provider identity
- Remote `main` SHA: `bdbadf863f3e6182dbbe1e3369c71644bb6595b9`.
- Vercel project `logbook` ID `prj_GYFLbRQjVyjn82Xnre5qZjz8UlAQ`; last observed production deployment `dpl_HWu3BwKtuD7miaVw6fS1wA3CQmMv` reported `READY`, source SHA exactly `bdbadf863f3e6182dbbe1e3369c71644bb6595b9`. **READY is not authenticated smoke or an uptime/SLA guarantee.**
- Current `vercel.json` disables automatic Git deployments for `*` and `main`, configures region `fra1`, daily backup and recency crons. This is an approved deployment separation, not a CI bug. GitHub workflows `.github/workflows/verify-web.yml`, `browser-smoke.yml` are `workflow_dispatch` diagnostics; current exact-main CI run not checked as PASS.
- Connected Neon listing showed a **Logbook Shadow** project but did not establish that it is the production database; **production branch/retention/PITR/connection privilege/backup state are UNKNOWN**. No database action or SQL executed.

## Control matrix — 29 controls

Statuses: **VERIFIED** = direct current provider/executed evidence scoped to that fact; **IMPLEMENTED—UNVERIFIED** = source implementation exists, current functional test absent; **PARTIAL** = some elements evidenced, other essential elements unknown; **UNKNOWN** = current evidence absent; **N/A** = only when irrelevant. No invented universal score.

| ID | State | Evidence / precise limit |
| --- | --- | --- |
| REL-01 CI/CD and release gates | PARTIAL | Manual CI workflows, `DEVELOPMENT.md` risk-selected owner-local release gates and current Vercel `READY`; no current exact-SHA full release ledger inspected. Manual production release is intentional. |
| REL-02 Unit/domain/regression | IMPLEMENTED—UNVERIFIED | `package.json` npm test and domain suites; historical `ROADMAP.md` SHA-bound test PASS belongs to older candidates only. |
| REL-03 Authenticated browser smoke | IMPLEMENTED—UNVERIFIED | `e2e/`, locked Playwright and manual browser workflow; no authenticated test run in this audit. |
| REL-04 Branch policy/provenance | UNKNOWN | Source documents prescribe approvals; effective GitHub branch-rule enforcement/permissions unverified. |
| REL-05 Staging isolation | PARTIAL | Local disposable PostgreSQL and controlled production separation documented; representative separately staged prod-like environment not confirmed. |
| REL-06 Rollback | PARTIAL | Candidate-first rollback rules and older rehearsal evidence; current Vercel rollback + schema compatibility exercise not run. |
| SEC-01 All endpoints authenticated | PARTIAL | Sample `app/api/export/route.ts` and `app/api/backups/[id]/route.ts` check `getSession`; both crons use `CRON_SECRET`. **Remaining API/action inventory not individually tested**, especially public endpoints where anonymous reads may be intentional. |
| SEC-02 Tenant/object authorization | IMPLEMENTED—UNVERIFIED | `lib/auth/require-user.ts`, user-scoped SQL in export and stored backup; `docs/certification-readiness/SECURITY_AND_RESTORE_EVIDENCE.md` documents historical real-PG16 cross-user tests, not this SHA's end-to-end authorization. |
| SEC-03 Sessions/reset/verification | PARTIAL | `lib/auth/session.ts` uses hashed 7-day revocable DB sessions, `httpOnly`, production `secure`, `sameSite=lax`; login and reset actions + Google verified-email callback exist. Current production delivery/reset/registration E2E not verified. |
| SEC-04 Rate limits | PARTIAL | `lib/auth/security.ts` login attempt limits, `app/forgot-password/actions.ts` reset-request limits; comprehensive per-endpoint/per-user/API usage limits not verified. |
| SEC-05 Secret handling | PARTIAL | `.gitignore` excludes `.env`, sessions require a sufficiently long secret, GitHub workflows show only synthetic test credentials; repo-history secret scan, rotation evidence and provider secret-scope review **NOT RUN**. |
| SEC-06 Dependency supply chain | PARTIAL | `package-lock.json`, Node 24 engine, locked Playwright; current `npm audit` and GitHub dependency-alert review not performed, production dependencies use semver ranges. |
| SEC-07 Security headers | IMPLEMENTED—UNVERIFIED | `next.config.ts` includes HSTS, CSP, X-Frame-Options, nosniff, policy/referrer headers; **real HTTPS response and CSP enforcement not captured**. Existing CSP permits inline JS/styles; review tradeoff rather than claim bypass. |
| SEC-08 Safe errors / AI prompt attacks | PARTIAL | Explicit error/404 pages and error handling exist; production error redaction/log privacy not system-wide verified. AI-specific subcontrol handled separately in AI-01. |
| DAT-01 SQL transaction/schema/integrity | IMPLEMENTED—UNVERIFIED | `ARCHITECTURE.md` schema gates, guarded localhost PG16 test harness, archive/authenticity/source contracts. This audit intentionally did not connect to Neon or execute DB tests. |
| DAT-02 Backup schedule/retention | PARTIAL | Daily `/api/cron/backups`, `lib/backup-center.ts` per-account gzip+hash/retention, data stored in `account_backups` **on the application DB**. Independent failure-domain/offsite store, prod cron history and provider PITR unknown. |
| DAT-03 Restore/DR exercise | PARTIAL | `SECURITY_AND_RESTORE_EVIDENCE.md` documents isolated portable-backup and signed-evidence restore tests; this is **not** a current full-service lost-database restore rehearsal. RPO/RTO and offsite recovery verification missing from inspected evidence. |
| DAT-04 Export and erasure | IMPLEMENTED—UNVERIFIED | `app/api/export/route.ts`, `lib/privacy-account.ts`, account deletion/retention logic; actual account rights workflow and third-party retention outcomes not end-to-end tested. |
| OPS-01 Errors/logging | PARTIAL | `console.error` diagnostics and `lib/system-health.ts` metrics exist; provider-level structured error ingestion, redaction, alert ownership and retention unknown. |
| OPS-02 Uptime + paging | UNKNOWN | No live independent uptime checks, tested outage alert route or on-call target verified. |
| OPS-03 Performance/slow networks | IMPLEMENTED—UNVERIFIED | Large-data/100k PG performance tests and UI browser automation exist; no current LCP/INP/CLS, 3G/high-latency, degraded-service or physical device measurement. |
| OPS-04 Cost caps | UNKNOWN | Vercel, Neon, Resend and map provider budgets/caps/email alerts not inspected or changed. |
| OPS-05 Email SPF/DKIM/DMARC | UNKNOWN | `lib/email.ts` uses Resend and has invite/password reset sends; current DNS authentication, bounce/feedback and delivery monitoring **NOT VERIFIED**. |
| UX-01 Accessibility/devices | IMPLEMENTED—UNVERIFIED | Playwright/browser risk framework, mobile/UI skills, CSS and test assets exist; current keyboard/zoom/Safari/actual hardware results not run in this audit. |
| UX-02 Empty/loading/404/500 | IMPLEMENTED—UNVERIFIED | `app/error.tsx`, `app/not-found.tsx` and existing UI patterns; no live failure-injection/browser screenshot verification. |
| WEB-01 SEO/OG/site metadata | PARTIAL | `app/manifest.ts`, `app/layout.tsx`, app icons and legal metadata; SEO for protected logbook is intentionally not a public-indexing objective. Public landing sitemap/robots/OG inventory not fully reviewed. |
| LEG-01 Privacy, terms, cookies | PARTIAL | `app/legal/`, `lib/legal.ts` provide beta documents. The code **explicitly requires formal operator identity and validation before a public commercial launch**; legal adequacy and actual browser cookie inventory not verified. |
| AI-01 Model-evals, LLM fallback, prompt injection | N/A (PROVISIONAL) | Current inspected `package.json` has no LLM provider/SDK; no actual LLM request integration identified in examined app path. If a future model API is connected, reclassify and audit this control. |
| DOC-01 README, runbooks and incident owner | PARTIAL | Substantial `README.md`, `DEVELOPMENT.md`, Project Memory and release history; current incident-contact/runbook and disaster recovery drill evidence not proven. |

## Prioritized findings and evidence gaps

### P1 — Establish independent disaster-recovery evidence (DAT-02/03)
**Finding: CONFIRMED source architecture, unverified resilience.** The built-in automatic backups are stored under `account_backups` in the same DB used by FlyTally. This is valuable for per-account accidental-deletion recovery, but alone does not prove survivability of full database loss. Neon provider PITR/offsite retention may exist, **UNKNOWN**; do not assert it is absent. **Next safe action:** verify production Neon project identity and read-only PITR/backup-retention metadata; document RPO/RTO; create a separate approved restore rehearsal on disposable infrastructure using synthetic data and checksum/critical-flight-evidence assertions. Do not restore or migrate production.

### P1 — Verify incident detection/notifications (OPS-01/02)
**Finding: UNVERIFIED, not claimed absent.** Source `console.error` and application health checks are present. Current error ingestion, automated backup/cron-failure paging, uptime probes and the actual escalation recipient have not been established. **Next:** read-only inspect Vercel observability/log drain/uptime settings, confirm alert delivery with an authorized test using synthetic event, and write an on-call runbook.

### P1 — Scheduled user-processing coverage (DAT-02, REL-01)
**Finding: CONFIRMED bounded selection; customer impact conditional on population.** Both `app/api/cron/backups/route.ts` and `app/api/cron/recency/route.ts` select `ORDER BY ... LIMIT 500` with no pagination/continuation visible in these handlers. If more than 500 active accounts qualify, later accounts may not be processed by a given job. The code also executes work per user in a loop, with `maxDuration=300` and per-user error collection. **Next:** non-mutating synthetic fixture/latency capacity analysis; decide pagination/cursor, run partitioning, timeout/retry/idempotency and completion alert strategy, then test on isolated owned PG. Do not run load against production.

### P1 — Complete API permission review (SEC-01/02/04)
**Finding: COVERAGE INCOMPLETE, no demonstrated bypass.** Auth was verified in representative code paths; the full route/server-action inventory has not been line-by-line reviewed. **Next:** inventory each route/action as public/authenticated/cron, inspect identity + object authorization, negative tests for forged IDs and rate limits, and run accepted synthetic browser/PG tests. Never fuzz live users or production.

### P1 (commercial launch only) — Formal operator and legal signoff (LEG-01)
**Finding: CONFIRMED documented launch gate.** `lib/legal.ts` explicitly uses private-beta placeholders unless operator fields are configured and warns public commercial launch needs operator identification. Commercial gate/build guard exists. Verify actual public legal identity configuration, DPA/subprocessors and regulatory claims with a qualified reviewer before enabling commercial stage. **Not a defect in the approved private beta.**

### P2 — Supply chain, provider limits, domains and performance (SEC-05/06, OPS-03/04/05, WEB-01)
Run an authorized secret/history scan and `npm audit --json` in isolated checkout (never print env values), inspect Vercel/Neon/Resend billing caps and alert contacts (metadata only), validate mail domain SPF/DKIM/DMARC, sample real HTTPS headers and slow-network/keyboard tests, and confirm public pages' robots/sitemap/OG only if a public acquisition surface is planned. No evidence currently establishes a particular vulnerability.


## Additional direct Vercel observability inspection (2026-10-25)
- Read-only Vercel **project-scoped log drains listing returned zero drains** for the `logbook` project. This establishes that no Vercel log drain was returned for this project, **not** that all observability is absent: Vercel's built-in runtime logs still exist and external monitors could be configured elsewhere. Classify `OPS-01=PARTIAL`.
- Read-only Vercel **runtime error aggregation returned “No runtime errors found” during the most recent 24-hour query window**. This is a limited no-error observation, **not** evidence that all errors, outages or missing alerts are impossible; does not certify notification delivery or every route. `OPS-02=UNKNOWN` remains.
- No error notification, log stream, provider billing configuration or connected Neon production DB was modified.

## Recommended safe audit phase 2

1. **Read-only provider inventory:** identify production Neon project and PITR/retention settings, Vercel uptime/errors and budget alert configuration, Resend domain status, effective GitHub protection policy. Record dates/scope but not secrets or personally identifying data.
2. **Source checks in exact checkout:** `npm audit --json` (dependency snapshot only), inspect `app/api` and server-action inventory, `npm run scope:changed` for any proposed scanner/QA tool changes. Do not start DB or dev server just to label the audit PASS.
3. **Risk-selected local QA:** after owner approval for an isolated target, run `npm run verify:plan -- --base origin/main` and selected targeted tests, then optionally synthetic expiry/reset/offline/restore/cron boundary cases on independently verified disposable local PostgreSQL. Do not use the production `DATABASE_URL`.
4. **Changes only after owner prioritization:** split real fixes into separate PRs: cron robustness, observability/incident runbook, DR verification, API permission/abuse review. Each new behavior change gets its own exact-SHA release evidence and approval boundary.

## Not run / exclusions
NO production Neon query, database restore/migration, attack simulation, live website login, endpoint scanning, trial invitations, emails, alert triggers, billing modifications, key rotation, full Node suite, Playwright, 100k load, slow-network test, Lighthouse, live HTTPS/DNS check or native Safari. Provider Vercel `READY` is identity/deployment evidence only.

**Verdict:** `PRELIMINARY / READ-ONLY / ACTIONABLE` — sufficient to prioritize validation work; **not an attestation that the service is production secure or operationally disaster-resistant**.
