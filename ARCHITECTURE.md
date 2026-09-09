# FlyTally architecture — current v2.7 generation

This document describes the active Next.js application and the architectural rules that should guide new work. Historical release-specific design documents remain useful as regression context, but they are not the current system map.

## Production stack

FlyTally is a Next.js 16 / React 19 application deployed on Vercel and backed by Neon PostgreSQL. The active production runtime is TypeScript.

Primary runtime boundaries:

- `app/` — App Router pages, server actions and API routes;
- `components/` — reusable UI and interaction components;
- `lib/` — domain rules, authenticated data services, regulatory engines, certification, GPS, collaboration and recovery logic;
- `data/` — repository-owned static reference data such as the airport catalogue;
- `tests/` — TypeScript regression coverage and PostgreSQL acceptance/scale evidence;
- `tooling/` — development and CI tooling only; it must not become a second application runtime.

The pre-Vercel Streamlit/Python implementation is historical. Git history is the archive for that runtime.

## Product-domain map

The physical runtime layout remains `app/` / `components/` / `lib/`. We deliberately do not mass-move mature code merely to make directory names look modular.

For development planning and CI risk classification, `tooling/development-modules.json` maps stable path prefixes into these product domains:

- **flight-records** — Add/Edit flight, flight detail/list data and flight-entry behavior;
- **credentials-compliance** — licences, ratings, recency, SFCL/BFCL/helicopter compliance and supporting evidence;
- **connections-workflows** — Actions, notifications, participations, verification and training workflows;
- **analytics** — Dashboard, Statistics, Map and their read models;
- **data-recovery** — Data, Database, Export, Print, portable backup and restore;
- **fstd** — simulator/FSTD evidence;
- **platform** — authentication, profile/settings, administration, runtime schema and shared database infrastructure;
- **development-infrastructure** — GitHub Actions, local tooling and build/deployment configuration.

This registry is development metadata, not a runtime dependency graph. Unknown application code is intentionally classified conservatively as shared code until its ownership is made explicit.

When adding a new product module, prefer one clear canonical workflow and stable domain boundary. Register the module's path prefixes only after that boundary is real. Do not introduce parallel Quick/Simple/Advanced implementations of the same task merely to isolate code.

## Database, tenancy and schema compatibility

Neon PostgreSQL is the transactional source of truth. Queries and mutations are scoped by authenticated `user_id`; cross-user workflows use explicit participation and verification records rather than weakening ownership filters.

`lib/db.ts` owns the Neon client and initializes it lazily so build-time imports do not require a live production connection.

Schema compatibility is runtime-gated through `lib/runtime-schema.ts`. Schema gates must remain:

1. idempotent;
2. safe to retry after failure;
3. compatible with already-deployed historical records;
4. separated from presentation-only changes.

Database migrations, certification semantics and regulatory thresholds must not be changed as incidental cleanup.

## Certified and protected evidence

Ordinary flight records remain editable until certification. Certification creates a protected revision/fingerprint boundary; later corrections must not silently mutate the meaning of previously certified or signed evidence.

Important separations include:

- `flights` — the pilot's operational record;
- certification history — protected revision fingerprints;
- `flight_participations` — shared-flight workflow and ownership linkage;
- `flight_verifications` — signed evidence bound to an exact flight revision/hash;
- audit history — material change evidence independent of UI presentation.

A historical signature or verification must never appear valid for a later corrected revision unless the underlying protected evidence contract explicitly allows it.

## Multi-category regulatory model

FlyTally is one pilot logbook across `AEROPLANE`, `HELICOPTER`, `SAILPLANE`, `BALLOON`, `ULL` and conservative `OTHER` records. Category-specific evidence is explicit; category meaning must not be inferred from a convenient display label when the regulatory provenance is unknown.

The central architectural rule is **shared workflow, specialized authoritative engines**:

- flight entry remains one canonical workflow;
- certification and protected-evidence rules are category-aware;
- Part-FCL, SFCL, BFCL and supported helicopter calculations retain their own rule boundaries;
- presentation layers may normalize statuses and explanations, but must not merge distinct legal engines into a new untested super-engine.

Structured movements, launch evidence, BFCL operation context, training evidence and other regulatory inputs remain explicit evidence. Missing evidence is not silently manufactured from hours or GPS geometry.

## Recency & Compliance Workspace

The Recency workspace is a planning/read-model layer over authoritative category services. It can normalize presentation into states such as CURRENT, ACTION SOON, NOT CURRENT and INCOMPLETE EVIDENCE only when the underlying evidence supports that distinction.

Evidence links should point to the exact flights, training records, signatures or credentials already used by the authoritative engine. A row that did not contribute to the calculation must not be presented as confirmed provenance merely because it exists in the logbook.

## Flight entry and review

Add flight remains one canonical form. Intelligent review findings, continuation/return/local-flight assistance and GPS-derived suggestions are integrated into that workflow rather than creating duplicate entry modes.

GPS suggestions for an existing saved flight require explicit review before overwriting saved values. A successful normal Save hands the pilot into final logbook-data review without bypassing certification, sharing or protected-record boundaries.

## Collaboration and professional evidence

Connections, Actions, notifications, shared-flight participation, instructor/training verification and professional pilot context are workflow layers over the pilot's own records. They may add evidence and review state, but they do not transfer ownership implicitly or rewrite protected records.

Professional context such as operator/operation, supervised time or employment-oriented reporting remains recorded evidence unless a separate tested rule explicitly establishes a regulatory or employment conclusion.

## Data integrity and recovery

Portable backup/restore is an application-level disaster-recovery feature, separate from provider-managed PostgreSQL recovery.

The v2.7 recovery path is intentionally review-first and atomic:

- restore preview groups missing, present and protected/conflicting evidence before mutation;
- authenticated current-format backups use server-side integrity protection while legacy backups remain bounded by compatibility rules;
- certified revisions, signatures, GPS, sharing evidence, audit history, licences, expenses and recency evidence are preserved through the canonical recovery path;
- large-account recovery uses tested batching while preserving transaction safety.

Restore must remain non-destructive by default. A convenience cleanup must never weaken protected-evidence conflict detection.

## Data access and performance

High-frequency routes use compact SQL projections, set-wise lookup and aggregation where practical. Large GPS geometry is excluded from routine list payloads and loaded only by detail/review workflows that require it.

Performance rules:

- never cache user data across tenants;
- avoid N+1 queries on high-frequency pages;
- aggregate in PostgreSQL when transferring raw rows is wasteful;
- keep Dashboard read models lean and leave historical analysis to Statistics;
- load detailed GPS only when required;
- retain 10k/50k scale gates and the controlled 100k read benchmark for registered hot paths.

Known performance-sensitive paths are centralized in `tooling/development-modules.json`; CI uses that metadata rather than duplicating path lists in workflow YAML.

## Airport reference data

`data/airports.csv` is the repository airport catalogue used by the Next.js runtime. `lib/airport-catalog.ts` loads and normalizes it server-side and maintains a process-local read-only index.

Transactional database copies and personal source spreadsheets do not belong in the active repository.

## Development verification and deployment

The development loop is candidate-first:

1. iterate locally with targeted tests and explicit TypeScript checks;
2. use `npm run scope:changed -- <path> [...]` to inspect module/CI risk when useful;
3. run `npm run verify` before publishing a coherent candidate;
4. push one candidate commit when practical and let the pull request run the shared safety gates;
5. merge only after the exact candidate SHA is green.

Every normal PR keeps the fast application gate: TypeScript, the complete unit/regression suite and a real Next.js production build. PostgreSQL acceptance runs for application-impacting work, while registered performance hot paths and `[full-ci]` candidates retain the scale gates.

Vercel build filtering is deliberately conservative. `tooling/vercel-ignore-build.mjs` can skip a deployment only when every changed file is structurally development-only: documentation, GitHub workflow metadata, tests or non-deployment tooling. Runtime code, dependency metadata, TypeScript/Next/Vercel configuration and `tooling/vercel-ignore-build.mjs` itself are always build-relevant.

The guard uses `VERCEL_GIT_PREVIOUS_SHA` when Vercel supplies a usable commit. When preview checkouts omit that value, a one-commit candidate may fall back to its parent only when that parent is a GitHub-created production merge commit. Multi-commit or otherwise untrusted preview history fails safe toward a real build rather than inspecting only the latest commit. Production deployments compare against the previous production state, using the supplied previous SHA when available and the first parent as the safe merge/direct-push fallback.

Release-numbered regression tests are retained after their release closes. They are historical behavior contracts, not disposable scaffolding.

## Architectural rules for future work

- Prefer extending an existing canonical workflow over adding a parallel implementation.
- Keep legal/regulatory rule engines deterministic, evidence-driven and independently testable.
- Treat protected evidence, certification fingerprints and restore semantics as high-risk boundaries.
- Make new database work tenant-safe and idempotent before optimizing it.
- Add scale coverage only where the production read/write path justifies it; do not run expensive fixtures on unrelated changes.
- Refactor large modules incrementally behind behavior tests rather than combining broad code movement with feature delivery.
- Use the development module registry to make ownership and CI risk clearer, but do not distort runtime architecture merely to satisfy the registry.

## Deferred structural debt

The codebase still contains several deliberately large UI/domain modules and historical version-layered styling. They should be reduced incrementally where a concrete feature or measured maintenance problem justifies it. A repository-wide folder rewrite, CSS rewrite or regulatory-engine merge would create substantial regression risk without equivalent user value and is therefore not a default cleanup strategy.
