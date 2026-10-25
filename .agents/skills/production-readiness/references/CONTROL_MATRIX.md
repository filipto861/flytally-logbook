# FlyTally Production Readiness — control matrix V1
**Scope:** Next.js 16/React 19 logbook (Vercel + Neon PostgreSQL). `N/A` must be justified and revisited if a capability is added.

| ID | Control | What counts as VERIFIED; do not substitute existence of config |
| --- | --- | --- |
| REL-01 | Release CI/CD and gated merges | Current GitHub workflow/owner-local exact SHA release ledger; deployment SHA identity and explicit approvals |
| REL-02 | Unit/domain, regressions | Executed current tests, positive/negative and regression count on exact SHA |
| REL-03 | Authenticated browser smoke | Current selected Playwright matrix on owned synthetic fixture, not prod user data |
| REL-04 | Branch protection, test provenance | Live GitHub policy or documented equivalent manual gate; no inference from YAML |
| REL-05 | Staging/preview separation | Actual isolated target and data separation, never assume disabled auto-preview implies staging |
| REL-06 | Reversible release and rollback | Documented + exercised rollback preserving DB compatibility and old client contracts |
| SEC-01 | Authentication on endpoint inventory | Per-route GET/POST/action request authorization + anonymous rejection tests |
| SEC-02 | Object/tenant authorization | user_id scoping, forged IDs, sharing revocation, cross-user browser/API tests |
| SEC-03 | Session security / reset and verification | Cookie flags, CSRF/origin, login/logout, verification/reset real end-to-end evidence if supported |
| SEC-04 | Rate limits / bot abuse | Demonstrated limits on login, recovery, mutations, exports, cron callbacks and expensive queries |
| SEC-05 | Secrets and leakage prevention | .gitignore/history scanners, least privilege and rotation protocol; never read secret contents |
| SEC-06 | Dependency supply chain | lockfile, pinned runtime, current audited vulnerabilities and dependency review policy |
| SEC-07 | Security headers, HTTPS, CSP | Actual HTTP response and current config; report CSP compatibility instead of blindly adding it |
| SEC-08 | Error safety / prompt injection | Errors redact internals; AI-specific prompt injection **N/A unless actual LLM integration** |
| DAT-01 | DB migration/transaction/retention | Current schema guards and owned PG integration evidence, no prod SQL execution |
| DAT-02 | Backup schedule and consistency | Current backup job config + backup metadata/logs, retention, immutable/offsite properties |
| DAT-03 | Verified restore/DR/RPO/RTO | Successful isolated restore drill with integrity/hash checks; a backup cron is **not sufficient** |
| DAT-04 | Account/data deletion and export | Actual end-to-end authorization, delete/cancel, delayed erasure/third-party retention semantics |
| OPS-01 | Error tracking and logs | Current redacted app/server logs and error ingestion/ownership, no PII logging |
| OPS-02 | Uptime/health monitoring | Independent checks, alert delivery and test of on-call destination |
| OPS-03 | Performance / slow network | Measured real network/browser LCP/INP/CLS and degraded/offline states if relevant |
| OPS-04 | Costs/billing safety | Provider spending policies, caps, budget alerts and alert recipients **metadata only** |
| OPS-05 | Email deliverability | SPF/DKIM/DMARC DNS validation, resend/provider delivery and failure replay; only if mail used |
| UX-01 | Accessibility and devices | Real keyboard/touch/zoom/ARIA/contrast 320/390/768/1024/1440 tests, native Safari separately |
| UX-02 | Empty/loading/error/404/500 | Current rendered evidence with browser state and retry/cancellation |
| WEB-01 | SEO, metadata, OG/favicon/sitemap | Public marketing surface; do not index authenticated pilot records |
| LEG-01 | Privacy/terms/cookie consent | Current public documents and legally validated data-processing/cookie practice |
| AI-01 | Evals, model outage, prompt injection, tokens | **N/A only after verified inventory confirms no live LLM integration** |
| DOC-01 | README/runbooks & incident owner | Up-to-date ops instructions, least-privileged recovery and postmortem procedure |

## Decision rules
- State `UNKNOWN` for provider dashboards, billing, telemetry, current restore evidence or DNS when inaccessible.
- Mark `IMPLEMENTED—UNVERIFIED` when active repo code supports a control but runtime verification is missing; past recorded PASS is evidence for that *past SHA only*.
- Do not assume SEO or marketing requirements apply equally to protected application pages.
- Read-only audit must not itself add monitoring providers, publish sensitive security details or operate production resources.
- This matrix is a baseline; expand with evidence as risk warrants. Use links to source files/commits/PRs and record date.
