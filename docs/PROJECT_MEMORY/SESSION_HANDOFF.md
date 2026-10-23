# FlyTally Logbook — rolling session handoff

## 2026-10-23T06:08:20.871Z — Navigation/global design audit checkpoint (docs only)

- Repo: `filipto861/flytally-logbook`. Independently verified canonical `main=c68e6a2758423ab862cf9b03f5623515d07433e4`; work branch `docs/logbook-navigation-design-audit-20261023` from main, initial docs audit commit `6db33983bd1d40f57c0bc06a53d4302ea9faee12`. This checkpoint advances work HEAD; independently re-fetch after write. PR for this branch: **NONE** (no PR created). Other Draft PRs #377–#380/#389 remain independent. Main contains merged skills PRs #388/#390.
- Scope/files: read-only source audit captured in `docs/product/LOGBOOK_NAVIGATION_UI_AUDIT_2026-10-23.md`; this checkpoint edits only `ROADMAP.md`, `docs/PROJECT_MEMORY/ACTIVE_WORK.md`, `docs/PROJECT_MEMORY/SESSION_HANDOFF.md`. Owner insists on avoiding unrelated bugs and features. No runtime implementation before video/owner design approval.
- Evidence: GitHub main/PR/deployment metadata, current sidebar, AppShell, CSS imports/selectors, design-language and navigation tests inspected; complete Apple Design V2 playbook and relevant skills read. **PASS = read-only GitHub/source inspection only.** Typecheck, source tests, build, Playwright/screenshots, real Safari, accessibility hardware: **NOT RUN**. Video: **NOT RECEIVED**. Vercel project `filipito/logbook` production READY deployment `dpl_4XGBawGy187VyJpG5nyRFe2p2fKW` points to `34b865bb0ced1222945cecb107589826890ee31a`; no authenticated runtime verification. DB/migrations/flags **UNKNOWN/UNTOUCHED**; deploy not changed.
- DO NOT: edit Training, unrelated Draft PRs/flows, data/flight integrity, auth, SQL, schema, brand tokens, dependencies, auto-fill, merge, deploy, production DB or flags. No private user/flight/GPS data.
- **ONE NEXT STEP:** inspect user's forthcoming UI recording against source and record observed interaction problems; present a frozen scope-limited redesign proposal for explicit owner approval.

## 2026-10-22T19:14:39.210Z — Apple Design V2 proposal, Draft PR #390 (docs only)

- **Verified repo:** filipto861/flytally-logbook; main `f1052cac8d518342bfdf10c6f03b51199d78ad69`; work branch `docs/logbook-apple-design-v2-20261022` before checkpoint `17c157ea8f0d31d2d994ec43c7c909c06d2c18b5`; PR #390 OPEN/DRAFT, base main. The checkpoint commit advances work SHA; refresh after push. Existing PR #389 is an independent docs-only merge checkpoint — leave unchanged.
- **Scope:** Dedicated .agents/skills/apple-design/SKILL.md plus references/APPLE_DESIGN_PLAYBOOK.md, registry, design-engineering and ui-ux-design, AGENTS.md, ROADMAP.md, docs/skills/THIRD_PARTY_SOURCES.md and CHATGPT_PROJECT_INSTRUCTIONS_ADDENDUM.md. Full 17 sections adapted from user-provided MIT source. No app, config, package, schema, auth, aircraft, flight records, or Training changes.
- **Owner instruction:** Apple Design should be used frequently for Logbook UI, including micro-fixes. Apple guidance defines quality and interactive review; motion/brand changes/new dependencies remain optional and require separate scope. Owner has NOT approved this V2 merge or any prod action.
- **GitHub source checks (before checkpoint, exact 17c157ea8f0d31d2d994ec43c7c909c06d2c18b5): PASS** first-class frontmatter, full required playbook, 17/17 chapters, AGENTS/registry routing, source MIT attribution and compact Project Instructions addition. **NOT RUN:** local risk planner, Node/typecheck/build, PG, Playwright/CI/native Safari, production smoke; production DB/flags/deploy status UNKNOWN (not inspected) and unchanged by work. No claimed runtime PASS.
- **Risks:** PR #389 also edits ROADMAP and Project Memory but is unmerged; avoid accidental scope mixing. Original Apple source includes example numeric physics and canned initial response; our adaptation treats them as illustrative and does not import the vendor interaction prompt. ChatGPT Project settings require a separate manual edit after merge.
- **DO NOT:** no main direct push, unrelated PR merges, production deploy/DB/migration/flags, Training edit, new dependency, automatic data prefill/auto-apply, UI redesign or private pilot data.
- **ONE NEXT STEP:** read-only review of Draft PR #390, then owner decision whether to approve its merge; update ChatGPT Project Instructions separately if merged.

---


## 2026-10-22T18:39:44.269Z — Agent Skills V1 final docs checkpoint before handoff

- **Verified GitHub identity before checkpoint commit:** main 34b865bb0ced1222945cecb107589826890ee31a; branch docs/logbook-agent-skills-v1-20261022 @ e4a8aef733e93819f0dda95b3c8159c1b60701f4; Draft PR #388 against main. Branch/PR remain unmerged; this checkpoint advances branch HEAD and requires a subsequent read-only SHA recheck.
- **Doc-only scope:** 9 SKILL.md and registry, AGENTS.md, docs/README.md, ROADMAP.md, Project Memory, third-party MIT attribution, validation plan and compact ChatGPT Project Instructions snippet. Features/Architecture/Development/CHANGELOG reviewed; no actual product capability/runtime release from skills, so no unrelated capability or shipped history entry fabricated.
- **Evidence:** GitHub source/read-back 9/9 unique skill frontmatters, stops/verification 9/9, AGENTS router/registry/addendum and MIT attribution present; PR changed paths docs-only 18/18. PASS static checks for e4a8aef733e93819f0dda95b3c8159c1b60701f4. **NOT RUN:** local risk planner, Node, TypeScript, build, PG, Playwright/native Safari, CI or Vercel smoke. No assertion about production state (UNKNOWN, not rechecked).
- **No operations:** DB/migration/flags/deploy UNCHANGED by this work; no production changes; no merge; ChatGPT Project settings NOT CHANGED remotely, manual edit pending after approved merge. No PII/flight/GPS content in handoff.
- **DO NOT:** Training edits, new dependencies, automatic third-party skill installation, runtime refactors, unrelated draft PRs, production operations or direct push to main.
- **ONE NEXT ACTION:** owner/read-only review of Draft PR #388; after verification and explicit merge approval, integrate compact routing text into current ChatGPT FlyTally project instructions (respecting their character limit).

---


## 2026-10-22T18:37:26.054Z — Agent Skills V1 draft PR #388 created (documentation-only)

- **GitHub verified at checkpoint:** main 34b865bb0ced1222945cecb107589826890ee31a; scoped work branch docs/logbook-agent-skills-v1-20261022 code/docs baseline 7887c31cbd285954a29941cda3c057982fda44c4, PR #388 OPEN/DRAFT, base main, https://github.com/filipto861/flytally-logbook/pull/388. This checkpoint commit will advance work HEAD; re-fetch exact SHA after push. No merge or deploy approved.
- **Scope/files:** nine task-specific .agents/skills/*/SKILL.md, registry README, AGENTS.md routing, ROADMAP.md proposal pointer, docs/README.md, docs/skills/{THIRD_PARTY_SOURCES,VALIDATION,CHATGPT_PROJECT_INSTRUCTIONS_ADDENDUM}.md. This checkpoint also updates Project Memory handoff/active pointers. Third-party MIT design principles adapted from user-provided skills-main.zip, no library changes.
- **Verified GitHub source evidence for 7887c31cbd285954a29941cda3c057982fda44c4:** nine skill frontmatters 9/9, matching unique name and description 9/9, hard stops and verification sections 9/9, registry references all skills, AGENTS.md routing present; PR file-list audit docs-only 16/16 PASS. GitHub read-only checks PASS. **NOT RUN:** local Node test suite, typecheck, build, PostgreSQL, Playwright, native Safari, Vercel production smoke, candidate risk planner. No execution PASS implied by documentation checks.
- **DB/migration/flags/deploy:** no DB, migration, flag or deployment changes made; present production state NOT RECHECKED / UNKNOWN for this task. No Flight/GPS records included. ChatGPT Project Instructions NOT APPLIED remotely; only manual paste addendum prepared for after explicit merge.
- **DO NOT:** do not modify Training, app runtime, auth/DB/Vercel, auto-prefill behavior, unrelated draft PRs or main. No merge, deployment, production DB migration/restore/delete or flag without separate owner approval.
- **One next step:** owner/read-only reviewer inspects Draft PR #388 and addendum, then decides revisions or explicit merge approval after appropriate docs-only risk planning.

---


## 2026-10-22T17:29:23.438Z — 3.8.1 release blocked at required candidate build/quality evidence

- **Repository / exact SHA before this docs-only checkpoint:** main `db8abbd90d28ce70fc3c7ae5ba89c00242bab75b`; release branch `release/logbook-v3.8.1-20261022` @ `7cdb01f3c22e22fc6eb9992da541e0c629af38ba`, PR **#386 OPEN/DRAFT**, base `main`, no unrelated work. This checkpoint changes only this handoff document, so exact release HEAD must be refreshed when testing.
- **Changes:** `package.json` and lock root `3.8.0→3.8.1`, exact version assertion in `tests/versioning-governance.test.ts`, `ROADMAP.md`, `FEATURES.md`, `CHANGELOG.md`, `SESSION_HANDOFF.md`, `ACTIVE_WORK.md`. PR changed-file audit found 8 such files, **no application runtime, auth, certification, DB schema, flag or GPS module changed by release PR**. The app footer reads `packageMetadata.version`. User explicitly asked to deploy distinguishable version. Baseline includes already merged U3 + cumulative GPS changes from older production.
- **Verification evidence on pre-checkpoint candidate:** static **11/11 PASS** GitHub source checks for semver 3.8.1, package/lock alignment, updated regression assertion, app footer link, preserved 3.7.0/3.8.0 roadmap lines, unchanged dependency list and policy/history references. **NOT RUN:** actual `node --test`, TypeScript, risk plan, Next production build for this candidate; prior main/U3 exact-executable risk release PASS is historical, not current release candidate PASS.
- **Preview build:** explicit preview Vercel create returned deployment `dpl_5hMPFe4juhUL6Jd4LemmwURBGNpu` for exact release SHA, then **CANCELED** by intentional `tooling/vercel-ignore-build.mjs` (non-production refs skip). GitHub Vercel status `success` accompanies ignored build and **does not mean a build ran or passed**. Do NOT change `vercel.json` ignore policy or global Vercel settings merely to obtain green preview. No production deployment created.
- **Read-only production DB preflight:** exact Neon project `muddy-dust-14049657`, production primary/default `br-raspy-fog-b1btvu5t`, database `neondb`: migration 21, 21 rows, exact v21 registry 1, expected 12 monetary cols and four validated CHECKs. No production SQL mutation performed. Target Vercel team `filipito`, project `logbook`, source GitHub `filipto861/flytally-logbook`; latest production READY Git SHA `6a67a02475ab09c3271f8646427f7956ed6e590a` as inspected. Current user-approved deployment still **NOT RUN**, no production smoke, live version remains from previous deployment.
- **DO NOT:** no production DB migration/restore/delete, no feature-flag change, no deployment without exact-head release gate; no Training modifications, no main direct commit. Deployment user-authorized, but governance still requires appropriate evidence. GitHub branch release PR merge waits until local tests.
- **ONE NEXT ACTION:** owner fetches/checks out clean release branch and runs read-only `npm run verify:plan -- --base origin/main`, then required non-DB local `npm run verify:app -- --base origin/main` and targeted `npm run test:target -- tests/versioning-governance.test.ts`; return output for exact-head gate and safe manual production deploy.

---

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
