# FlyTally Logbook — rolling session handoff

## 2026-10-22 — versioned patch release 3.8.1, deploy request in progress

- **Authoritative repo:** Logbook `filipto861/flytally-logbook` only. GitHub main at release creation `db8abbd90d28ce70fc3c7ae5ba89c00242bab75b` includes owner-approved merged U3 PR #381. Work branch `release/logbook-v3.8.1-20261022`, base main; new branch SHA changes as release docs/version commits land. Training untouched.
- **Owner intent:** "tak udelej nasazeni a dej tomu nove cislo verze nebo podverze at je to odlisene" = distinct **3.8.1 PATCH** release of present main to verified project `filipito/logbook`; this approves production deployment of scoped versioned code but NOT separate production DB migration/restore/delete or flag change. Version is read from package metadata in app footer.
- **Source of truth:** previous production Vercel READY deployment `dpl_75cGyhLAMyHjBLwEZPMU1Gkfehod` at `6a67a02475ab09c3271f8646427f7956ed6e590a` (17 Oct). New 3.8.1 contains cumulative merged code since that SHA, including GPS repairs and U3. Compare verified 78 main commits / 30 changed files, not just U3. Main U3 executable `a1e0be99...` local canonical release `PASS` including 1653 Node, 163 PG, 8 browser and focused U3 2/2; v3.8.1 candidate gates **NOT RUN** at this checkpoint. No app logic in version branch.
- **Live DB read-only verified:** Neon Logbook (historically named Shadow) `muddy-dust-14049657`, primary/default production `br-raspy-fog-b1btvu5t`, `neondb`: `schema_version=21`, 21 migrations, exact v21 registry 1, 12 columns, 4 validated CHECK constraints. No production migration required by this release and none authorized. Vercel project Git link verified to correct repo; `vercel.json` disables Git autodeploy on all refs incl main. Existing production deployment remained older at discovery.
- **Changed files on work branch:** `package.json`, `package-lock.json`, `tests/versioning-governance.test.ts`, `CHANGELOG.md`, `ROADMAP.md`, `FEATURES.md`, this `SESSION_HANDOFF.md` and `ACTIVE_WORK.md`. No auth, flight data, migrations, external Training repo, or flags.
- **Risks/DO NOT:** release includes previously merged GPS code not yet on production; production Neon metadata read-only confirmation does not alone prove runtime smoke. DO NOT touch production DB schema, production flags, Training, or deploy to another Vercel project. No production deploy until version candidate checks and exact SHA target preflight; report NOT RUN/UNKNOWN where appropriate.
- **One next action:** finish release PR and validate exact 3.8.1 candidate build, merge approved release metadata into main and make explicit-SHA Vercel production deployment, then confirm READY, app version and public smoke; stop on DB/target drift.



**Recorded:** 2026-10-21. **Classification:** documentation snapshot; independently verify all references on resumption.

## Repo and observed baseline
- Repository: `filipto861/flytally-logbook`; `filipto861/flytally-training` is a **separate project**.
- Observed latest GitHub `main` commit at discovery: `8099149f72d493c34dd59babf65bdb064ff99fc9` (GPS V2 cleanup documentation). **Not a perpetual live SHA.**
- Source-of-truth status, version, release order: [ROADMAP](../../ROADMAP.md), [FEATURES](../../FEATURES.md), [CHANGELOG](../../CHANGELOG.md). Re-read relevant portions and actual source/PRs rather than using this dated snapshot as release truth.
- Present work: see [ACTIVE_WORK](ACTIVE_WORK.md) for discovered PRs and their independent gates.

## This milestone
- Scoped documentation-only work branch `docs/session-continuity-20261021`: add persistent cross-chat handoff/checkpoint rules and pointers to the existing AI reviewer template.
- Existing product code, authenticated routes, certified-flight revision history, regulatory logic, PostgreSQL/Neon data, GPS importer, Vercel configuration and `main`: **unchanged by the proposal**.
- Validation: GitHub source inspection and branch/PR inventory. **NOT RUN:** local npm tests, typecheck, build, database/browser tests, CI and deployment. Never call these PASS without evidence on exact SHA.

## One next action
Review and explicitly approve or reject the dedicated documentation PR; no merge or production deployment implied. On next implementation session, first re-fetch actual GitHub branch state and [ACTIVE_WORK](ACTIVE_WORK.md), then continue only the selected scoped PR.

## Checkpoint fields for the next session
Update after an owner decision, completed milestone, new blocker, PR change or session switch: UTC time; verified `main` SHA; work branch/head; PR; approved scope and DO NOT; files touched; observed exact-head evidence; private/local-only blockers; one smallest next step. Mark unknown or unrun gates accurately. See [protocol](HANDOFF_PROTOCOL.md) and [original full reviewer handoff template](../AI_HANDOFF_TEMPLATE.md).
