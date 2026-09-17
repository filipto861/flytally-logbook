# FlyTally v2.8 — Compliance & Safety Foundation

Status: implementation baseline for private beta. This file is operational compliance documentation, not a substitute for final legal review.

## Release gates

v2.8 is not complete until C1–C6 are green. Public commercial launch is blocked until the public operator identity is configured and the v2.9 consumer/commercial review is complete.

### C1 — Legal & privacy
- Canonical `/legal` centre with privacy, beta terms, cookie/storage, aviation-safety, provider and report notices.
- Legal links on sign-in, join, authenticated shell and public share pages.
- No consent banner while only essential storage is used. Introducing non-essential analytics/advertising requires a consent design review before loading it.
- Operator identity is environment-backed. Missing formal operator details are a public-launch blocker.

### C2 — Maps & third-party licensing
- Satellite: ArcGIS World Imagery with labels/reference overlay; ArcGIS credential remains server-side.
- Normal map: OSM Standard remains transitional in this baseline. Requests preserve an allowed FlyTally browser Referer upstream, identify FlyTally and use cache headers.
- Required map attribution must remain visible in interactive and exported Story maps.
- Target before v2.8 completion: either migrate normal map tiles to a contracted/provider-backed service or re-verify the OSM proxy implementation against the then-current tile policy.

### C3 — Aviation records
- Maintain an auditable mapping of AMC1 FCL.050 requirements to stored fields, export columns, page/running totals and signature workflow.
- Do not claim EASA, Czech CAA/ÚCL or LAA approval without explicit evidence and scope.
- In-app attestation must not be labelled a qualified electronic signature. Print/sign and authority-specific workflows remain available where required.

### C4 — Training operational safety
- Operational calculations fail closed outside source authority.
- No extrapolation and no software interpolation unless the governed dataset explicitly authorises the interpolation method.
- Aircraft applicability, source revision and publication status are mandatory operational boundaries.
- AI drafting cannot publish safety-critical content without governed human approval.

### C5 — Security & public sharing
- Security headers include HSTS, nosniff, frame denial, strict-origin referrer policy and a restrictive Permissions-Policy.
- Public flight shares are secret-token based, revocable, limited to public DTO fields and marked `noindex`/`nofollow`/`nocache`.
- Sharing UI states which fields become public and links to privacy/terms.
- Public report route exists for privacy, copyright, security and unlawful-content concerns.

### C6 — Compliance regression suite
- Tests protect legal route availability, technical-cookie wording, public-share noindex, public-field disclosure, provider registry, security headers, map Referer/attribution rules and aviation-safety boundaries.

## GDPR processing record (RoPA baseline)

| Activity | Data | Purpose / baseline legal basis | Recipients | Retention baseline |
| --- | --- | --- | --- | --- |
| Account & authentication | email, name, credential/session identifiers, OAuth identity | provide account/service; security | Vercel, Neon, Google when chosen | account life; sessions shorter |
| Pilot profile & licences | pilot-entered profile/licence data | provide logbook features | Vercel, Neon | account life unless deleted/required for record integrity |
| Flight records | flight/aircraft/time/role data | logbook and export | Vercel, Neon | account life; user-controlled deletion subject to record integrity |
| GPS tracks | imported track coordinates/time/altitude/speed where supplied | map, route analysis and Story | Vercel, Neon, map provider for tile requests | with flight/account unless deleted |
| Signatures/certification | attestation image/data, signer/record audit metadata | evidence and integrity | Vercel, Neon | with certified record / applicable retention |
| Public sharing | share hash, chosen public fields, revoke metadata | user-requested public link | Vercel, Neon, map provider | active share; revoked metadata on shortened schedule |
| Transactional email | email address and message content | account/service communication | Resend | provider/application operational retention |
| Security | session/audit metadata, privacy-preserving network identifiers where implemented | protect accounts and service | Vercel, Neon | shortest useful security period |

Legal bases must be revalidated by counsel before public commercial launch; consent must not be used as a blanket basis where service performance or legitimate security purposes are the appropriate basis.

## Processor register

- **Vercel** — hosting, delivery, server execution. DPA/transfer mechanism review required annually and on material provider change.
- **Neon** — PostgreSQL infrastructure. Production region and access controls must remain documented.
- **Resend** — transactional email. Do not enable open/click tracking for authentication/service mail without a privacy review.
- **Google** — optional user-selected identity provider; scopes stay minimal.
- **Esri / ArcGIS** — imagery/map services; API credential server-side; attribution retained.
- **OpenAI** — Training admin drafting only where enabled; source-rights check required before proprietary material is sent.

Adding a processor requires updating the public provider notice, this register, DPA/transfer assessment and data-flow documentation before production use.

## Retention baseline

- Active account and core logbook: retained while requested by the user, subject to aviation-record integrity requirements.
- Authentication sessions: expire automatically; stale/revoked sessions are periodically removed.
- Public share: revoke immediately disables access; v2.8 must establish a short deletion schedule for orphaned/revoked share metadata.
- Support/security records: retain only as long as required to resolve the case and defend the service.
- Backups: retention and deletion propagation must be documented from Neon/Vercel provider settings before public launch.

## Data-subject request procedure

Private beta requests go to `support@fly-tally.com`. Verify identity proportionately; log request date/type; search relevant application/provider stores; respond/export/correct/delete as applicable; record exemptions or retained regulated records; close with an audit entry. Self-service export/delete is a v2.8 target, not a reason to delay a valid manual request.

## Incident response

1. Contain the incident and preserve minimal evidence.
2. Identify systems, users, data categories, jurisdictions and likely impact.
3. Rotate compromised secrets/tokens and invalidate sessions/shares where relevant.
4. Record detection time, facts, decisions and remediation.
5. Assess whether the incident is a personal-data breach and whether supervisory-authority notification is required within the applicable deadline.
6. Assess user notification where high risk exists.
7. Conduct post-incident review and add a regression/control.

Never put secrets, raw access tokens, database URLs or unnecessary personal data in GitHub issues, CI logs or public incident notes.

## Aviation-record baseline

`FCL050_COMPLIANCE.md` and `docs/certification-readiness/FCL050_COMPLIANCE_MATRIX.md` remain the detailed implementation matrix. v2.8 extends them rather than replacing them. Authority acceptance is not inferred from an internal test result.

## Release evidence

Each C-stage PR should contain: changed requirement, implementation, regression test, CI result, and any unresolved external/legal decision. Vercel preview builds remain disabled/skipped for ordinary feature branches; production deployment occurs after validated merge to `main`.
