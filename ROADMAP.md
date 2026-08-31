# FlyTally roadmap

This roadmap applies only to the current Next.js / Vercel / Neon application. Detailed historical release prose is preserved by Git history; a small set of release anchors remains below because current regression tests use them to protect architectural boundaries.

## Current release — v1.52.0 · Codebase Review & Cleanup

Goals:

- freeze the validated v1.51.x regulatory behavior as the baseline;
- remove inactive Streamlit/Python runtime, obsolete migration tooling and stale repository data artifacts;
- remove obsolete generated airport SQLite infrastructure while retaining the active CSV catalogue;
- synchronize project version metadata;
- replace outdated v0.x architecture/deployment documentation with current Next.js architecture documentation;
- keep current certification, backup, ownership, recency, GPS, print/export and shared-flight behavior unchanged;
- retain all release regression tests that protect current behavior;
- record deferred technical debt instead of combining risky visual/business refactors into the cleanup release.

## Stable baseline carried forward from v1.51.x

- legacy EASA movement compatibility is provenance-aware;
- structured movement zeroes remain authoritative;
- FCL.060 calculation and Evidence detail are aligned;
- eligible certified ULL aeroplane PIC experience is automatically credited as SEP for FCL.140.A and the FCL.740.A experience route;
- ULL remains excluded from automatic FCL.060 passenger currency and the mandatory FI/CRI refresher element;
- normal Aircraft UI no longer exposes the optional Part-FCL override metadata.

## Historical architecture anchors

These concise anchors intentionally retain the names used by regression contracts; they are not a second release-history document.

## v1.45.0 · Licences, pilot profile & aircraft training

Established the separate aircraft-training evidence model, exact signed-content binding and the boundary between training evidence, ratings and ordinary aircraft-flown information.

## v1.47.0 · Everyday UX refinement

Simplified everyday flight entry and flight browsing without weakening certified-record, shared-workflow or GPS evidence boundaries.

## v1.48.0 · Modular training evidence

Introduced modular aircraft endorsement/purpose evidence while preserving certification and recency separation. FCL.740.A refresher training remains evidence for the experience route, **never as an automatic rating revalidation**.

## v1.50.0 · UI system & theme convergence

Established the semantic application theme layer while keeping printable logbook output and regulatory/certification behavior independent of appearance.

## Next development priorities

After v1.52 is stable, future releases should return to product development rather than repository archaeology. Candidate priorities:

1. continue UX simplification where real workflows remain unnecessarily dense;
2. continue measured performance work on authenticated hot paths;
3. extend EASA/ULL regulatory coverage only with explicit rule/evidence boundaries and regression tests;
4. consolidate CSS/module structure incrementally, with visual checks, rather than through one large rewrite;
5. keep certification, ownership and portable-backup evidence compatible across every schema change.

## Release discipline

Every production release should pass:

- TypeScript typecheck;
- complete TypeScript regression suite;
- isolated PostgreSQL acceptance suite;
- Next.js production build;
- Vercel preview/production build;
- production smoke check and runtime-error review.

Tests are corrected only when the product requirement itself intentionally changes; they are never weakened merely to make a release green.
