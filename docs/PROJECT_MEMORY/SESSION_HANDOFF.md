# FlyTally Logbook — rolling session handoff

## 2026-10-22T19:38:16.522Z — Apple Design V2 PR #390 merged, post-merge verification

- **Verified:** Logbook main `c68e6a2758423ab862cf9b03f5623515d07433e4`, squash merge of PR #390 (MERGED/CLOSED); PR source HEAD `b795b78e886308183481b164ded7365342996cb1`. Work checkpoint branch `docs/logbook-skills-v1-merge-checkpoint-20261022` @ `b6354f389d5018a0dffd8aab03afc18f98918428` before this docs-only update, base main; PR #389 OPEN/DRAFT and NOT AUTHORIZED TO MERGE. Refresh branch full SHA after commit. #390 and #389 are separate approvals.
- **Content now on main:** first-class .agents/skills/apple-design/SKILL.md, references/APPLE_DESIGN_PLAYBOOK.md (17 domains), .agents/skills/README.md activation routing, updated design-engineering/ui-ux-design skills and AGENTS.md, attribution/MIT and ChatGPT Project Instructions addendum. Only source/docs/governance; no Training, app runtime, new library, database/schema, feature flag or deploy changes.
- **Verification for PR #390 exact head:** static read-back source checks PASS (17/17 playbook headings, frontmatter, registry + AGENTS routing, MIT attribution, 11/11 changed paths docs only). Post-merge readback PASS on main `c68e6a2758423ab862cf9b03f5623515d07433e4` (skill/playbook/AGENTS), GitHub PR MERGED. **NOT RUN:** local candidate risk planner, Node, TypeScript, build, PostgreSQL, Playwright/CI/native Safari, public/authenticated runtime smoke. No claim of product runtime PASS.
- **Environment:** Vercel project `filipito/logbook` read-only queried after merge: latest returned deployment `dpl_6kBKjGoUv1ss1evi15wvVbqgnpn1` state CANCELED; no deployment action performed. Production Git SHA/DB/flags not verified = UNKNOWN. Vercel git.deploymentEnabled remains false in verified repo config (prod provider-specific switch not mutated).
- **Owner authority:** approval applied only to squash merge PR #390. Do not merge PR #389, deploy, migrate/restore/delete DB, modify flags, change Training, add packages or auto-apply/prefill aviation data without separate approval.
- **Next step (ONE):** manually update/verify ChatGPT FlyTally project UX instructions to load apple-design/SKILL.md and its entire references/APPLE_DESIGN_PLAYBOOK.md for EVERY Logbook UI task.

---


## 2026-10-22T18:52:44.393Z — Agent Skills V1 PR #388 merged; optional post-merge docs-only checkpoint branch

- **Verified:** Logbook main `f1052cac8d518342bfdf10c6f03b51199d78ad69` after squash merge of [PR #388](https://github.com/filipto861/flytally-logbook/pull/388) (state CLOSED/MERGED); merged original docs PR head `7b2aaa16a0faba6f31cb3b3c0a1d9a26a8d4c4f6`. Work branch `docs/logbook-skills-v1-merge-checkpoint-20261022` is a new docs-only follow-up FROM main; its full HEAD must be refreshed after this checkpoint commit. No merge approval for this follow-up.
- **Scope:** record accurate post-merge facts in ROADMAP and Project Memory only. Skills V1 already in main: nine .agents/skills SKILL.md, README router, AGENTS.md, MIT attribution, ChatGPT Project Instructions addendum. Training untouched. User approval was PR #388 merge only.
- **Evidence:** exact PR candidate 9/9 skill frontmatter and hard stops, full 18/18 changed paths docs-only, AGENTS registry source checks PASS. Post-merge main SHA/closed merged PR/main AGENTS/design skill readback PASS. No executable tests, typecheck, build, PG, browser or runtime smoke run in this documentation session (NOT RUN). Vercel/Neon deployment runtime UNKNOWN / NOT RECHECKED. No migration, feature flag, DB action, app change or production deploy was initiated.
- **Design caveat:** apple-design in attached ZIP covers 17 thematic sections; current design-engineering SKILL.md preserves broad design principles but omits detailed velocity/gesture/haptic/rubberband formulas. Optional V2 playbook is separate future scope, not implied by V1 merge.
- **DO NOT:** no direct main push, do not alter prod DB/flags, merge/deploy, Training, source libraries or unrelated PRs; no private flight/GPS data in docs. User must manually save ChatGPT Project Instructions; this was not changed via GitHub.
- **ONE NEXT STEP:** manually confirm/insert approved Logbook Agent Skills routing in existing ChatGPT Project Instructions (8k limit) and verify next session pulls skills from main.

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
