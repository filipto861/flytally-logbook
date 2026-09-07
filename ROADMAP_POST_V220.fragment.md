## Post-v2.2 roadmap

The next roadmap phase prioritizes performance, workflow quality and product consistency before another major expansion of regulatory scope.

### v2.3 — Large Logbook Performance & Scalability

- Audit and benchmark Dashboard, Flights, Statistics, Action Center, Print/Export and certified-history reads on 10k, 50k and a read-only 100k-flight dataset.
- Measure real server response times and browser rendering cost rather than relying only on build success.
- Keep pagination, filtering, search and analytics fast on large mixed-category accounts.
- Measure large career-logbook browser print behavior and optimize only demonstrated bottlenecks.
- Remove redundant reads, duplicate aggregation work and avoidable serial data dependencies where evidence shows a measurable benefit.
- Consider chunked or streaming output only where ordinary CSV/XLS/print generation becomes a proven bottleneck.
- Keep this release performance-only: no new regulatory semantics or parallel user workflows.

### v2.4 — Flight Entry & Review 2.0

- Treat Add flight → Review → Save → Certification → Sharing as one coherent workflow.
- Improve inline validation, required-state explanations and progressive disclosure without adding a separate Quick/Simple/Advanced entry mode.
- Surface Intelligent Logbook findings where the relevant field is being edited and keep statistical observations informational.
- Improve continuation, return and local-flight assistance only by reusing the single canonical flight-entry flow.
- Audit GPS import → correction → certification and mobile keyboard/focus behavior end to end.

### v2.5 — Recency & Compliance Workspace

- Consolidate licence/rating validity, flying recency and supporting evidence into one planning-oriented workspace.
- Keep explicit states such as CURRENT, ACTION SOON, NOT CURRENT and INCOMPLETE EVIDENCE evidence-driven and explainable.
- Improve SEP/TMG, LAPL, SPL, Balloon and supported Helicopter planning without making unsupported legal-status inferences.
- Link recency requirements to the exact flights, training, signatures and saved credentials that support them.
- Keep FSTD recency evidence deferred unless it becomes an explicit product priority during this phase.

### v2.6 — Professional Pilot Workspace 2.0

- Expand operator/operation context, PICUS/supervised time, commander/copilot/instructor reporting and professional experience summaries.
- Improve aircraft-type and employer-oriented career reporting and exportable professional experience summaries.
- Keep CAT/NCC/SPO and other professional context explicit evidence, never inferred silently.
- Preserve the distinction between recorded evidence and a claimed regulatory or employment status.

### v2.7 — Data Integrity & Recovery 2.0

- Re-audit portable backup/restore, certified revisions, signatures, sharing and audit history against the current multi-category model.
- Add clearer restore preview/diff and duplicate classification where this can be done without weakening deterministic restore behavior.
- Validate large-account disaster recovery and end-to-end data portability.
- Keep destructive cleanup and migration separate from ordinary product changes.

### v2.8 — Mobile & PWA Hardening

- Run a complete iPhone/Android audit across Add flight, Actions, Flights, signatures, GPS import, Licences and Statistics.
- Harden safe-area, keyboard, date/time, focus, loading and perceived-performance behavior.
- Validate PWA install/update behavior.
- Consider limited offline capability only with a clear conflict and protected-record integrity model; do not introduce offline editing of certified evidence casually.

### v2.9 — Product Polish & Consistency

- Converge terminology, status badges, empty states, page titles, navigation, form controls, confirmations, loading/error states and accessibility.
- Remove remaining obsolete or duplicate UI components and dead code only when behavior is covered by regression tests.
- Re-run performance, mobile and protected-evidence regression audits as the final v2.x consolidation release.

### v3.0 — Professional Logbook Platform research

Do not schedule v3.0 from a single feature request. Treat it as a research boundary for a later product shift toward organization/operator accounts, instructor/student workflows, flight-school evidence, fleet-linked training, organizational verification, controlled reports and team permissions. Promote this to an implementation roadmap only when the pilot logbook, regulatory evidence, collaboration and professional-experience foundations are stable in real use.

## Permanent release principles

- **Performance:** every release retains 10k/50k gates; v2.3 establishes a 100k read-only benchmark where practical.
- **Regulatory integrity:** never infer legal status or privileges without explicit supporting evidence and a tested rule boundary.
- **Certified-data integrity:** certification fingerprints, revisions, signatures, sharing and restore behavior remain regression-protected.
- **One workflow principle:** do not create parallel Quick/Simple/Advanced versions of the same core task.
- **Mobile as a release gate:** core mobile workflows are part of release acceptance, not a later cleanup step.
