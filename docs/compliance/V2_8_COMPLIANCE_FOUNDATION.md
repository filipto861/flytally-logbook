# FlyTally v2.8 — Compliance & Safety Foundation

Status: implementation baseline for private beta. This file is operational compliance documentation, not a substitute for final legal review.

## Release gates

v2.8 is not complete until C1–C6 are green. Public commercial launch is blocked until the public operator identity is configured and the v2.9 consumer/commercial review is complete.

### C1 — Legal & privacy
- Canonical `/legal` centre with privacy, beta terms, cookie/storage, aviation-safety, provider and report notices.
- Legal links on sign-in, join, authenticated shell and public share pages.
- No consent banner while only essential storage is used. Introducing non-essential analytics/advertising requires a consent design review before loading it.
- Operator identity is environment-backed. Missing formal operator details are a public-launch blocker.
- Settings exposes a self-service portable export, all-share revocation and account deletion with an explicit retained-record boundary.

### C2 — Maps & third-party licensing
- Satellite: ArcGIS World Imagery with ArcGIS imagery labels/reference overlay; the ArcGIS credential remains server-side.
- Normal map: OSM Standard tiles are requested only through the FlyTally server proxy. The proxy identifies FlyTally, forwards an allowed FlyTally Referer upstream and applies cache headers in line with the current tile-use policy.
- Browser components do not request the community tile host directly; all normal-map access is centralized through the reviewed FlyTally route.
- Required OSM attribution remains visible in interactive Leaflet maps and exported Story maps. Satellite attribution remains Esri/data-provider specific.
- Satellite map requests fail closed when the ArcGIS credential is unavailable; normal-map requests never silently switch to an unreviewed provider.

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
- Security headers include HSTS, nosniff, frame denial, strict-origin referrer policy, restrictive Permissions-Policy, CSP, COOP and CORP.
- Public flight shares are secret-token based, revocable, limited to public DTO fields and marked `noindex`/`nofollow`/`nocache`.
- Sharing UI states which fields become public and links to privacy/terms.
- Public report route exists for privacy, copyright, security and unlawful-content concerns.

### C6 — Compliance regression suite
- Tests protect legal route availability, technical-cookie wording, public-share noindex, public-field disclosure, provider registry, security headers, provider-backed map routing/attribution rules and aviation-safety boundaries.

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
- Public share: revocation immediately disables access; revoked metadata is purged after 30 days.
- Authentication sessions/password-reset records are purged 30 days after expiry/revocation/use; authentication security events use a 90-day baseline unless an incident requires a documented hold.
- Deleted-flight recovery copies are purged at their existing `purge_after` deadline.
- Account deletion removes stored backups, GPS tracks, expenses, live settings/credentials/licences/recency data and public-sharing metadata immediately; historical flight/FSTD and signed/approved integrity evidence remains only under the pseudonymised deleted-pilot boundary.
- Provider-level backup retention/deletion propagation must still be documented from Neon/Vercel settings before public commercial launch.

## Data-subject request procedure

Private beta requests go to `support@fly-tally.com`. Verify identity proportionately; log request date/type; search relevant application/provider stores; respond/export/correct/delete as applicable; record exemptions or retained regulated records; close with an audit entry. Logbook self-service export, public-share revocation and account deletion are implemented; broader erasure review remains available where retained aviation evidence is challenged.

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
