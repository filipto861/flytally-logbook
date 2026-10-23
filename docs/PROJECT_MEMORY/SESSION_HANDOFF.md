# FlyTally Logbook — rolling session handoff

## 2026-10-23 — N1 V2-2 shared protected shell/header candidate checkpoint

- Canonical repo filipto861/flytally-logbook, main c68e6a2758423ab862cf9b03f5623515d07433e4, work feat/logbook-n1a-modern-navigation-20261023 on Draft PR #391 base main. Before checkpoint, work SHA 4693020d002961f42516d607e8076e37468d8aa0; re-fetch full final SHA after writing this handoff.
- Owner liked N1 V2-1 light/dark sidebar screenshots; said mobile cannot be checked personally but allows continuation. New N1 V2-2 scope is ONLY shared protected-app masthead/presentation; still needs visual acceptance. Design follows complete Apple Design V2 + 17 playbook areas, ui-ux-design, design-engineering, mobile-ipad, ui-quality-audit and testing-quality. Motion NONE.
- Runtime changed: components/app-shell.tsx adds one `shell-workspace` class to existing protected children wrapper; app/ui-system.css adds final-cascade CSS for immediate page headers in protected workspace, using theme semantic surfaces, 17px radius, consistent H1/eyebrow/descriptions and contextual links, mobile and flight detail/print safe rules. Test source added tests/logbook-n1-v2-shell.test.ts. ROADMAP.md, CHANGELOG.md and N1 V2 design specification updated. No route/business logic/data/API/auth changes. Existing V2-1 sidebar remains intact; N2 cards and N3 tabs remain outside scope. DO NOT alter other PRs, Training or owner-local ZIP files.
- GitHub in-memory source-only assertions 24/24 PASS prior to docs checkpoint (not executable tests). Node targeted tests, typecheck, build, Playwright, live computed CSS, native Safari/iPad and current candidate responsive screenshots NOT RUN. No production DB, schema migration, feature flags or deploy changes; production Vercel last read-only READY dpl_4XGBawGy187VyJpG5nyRFe2p2fKW at 34b865bb0ced1222945cecb107589826890ee31a, not this branch. No merge approval.
- **ONE NEXT STEP:** owner pulls and runs existing guarded local disposable PostgreSQL preview, evaluates N1 V2-2 header on Dashboard / Flights / Statistics and light/dark + 320/390 emulation, shares visual feedback; only then run selected candidate tests and seek separate explicit merge permission.

## 2026-10-23 - N1 V2-1 local visual feedback (owner)

- Verified canonical main c68e6a2758423ab862cf9b03f5623515d07433e4 and candidate branch f445197bb5e58e00bcbab226c7070c3f398217af; Draft PR #391, base main, not merged.
- Owner shared two real desktop screenshots of localhost N1 V2-1: Statistics in Light and Dashboard in Dark. Reported the menu now looks more unified and better and explicitly likes this direction. This is positive directional feedback, NOT final acceptance or a full desktop/mobile/iPad accessibility PASS.
- Methodology used: complete main Apple Design V2 skill and 17-domain playbook, plus ui-ux-design, design-engineering, mobile-ipad, ui-quality-audit; no new dependencies or brand palette. Preserve theme-adaptive sidebar in light/dark, routes and flight/data logic. No source/runtime code changed at this checkpoint.
- Outstanding: mobile drawer, collapsed sidebar, iPad touch and native Safari, keyboard/focus, reduced-motion, computed CSS/contrast, Node tests/build/Playwright and candidate-bound acceptance NOT RUN. Database/production deployment untouched; no merge authorization. Keep other PRs and user ZIPs out of scope.
- ONE NEXT STEP: complete targeted N1 V2-1 visual review at mobile/iPad/collapsed desktop in both themes, then agree whether to start separate N1 V2-2 shared-shell design without changing page workflows.

## 2026-10-23 — N1 V2-1 approved theme-adaptive navigation candidate

- Repo filipto861/flytally-logbook, main full SHA c68e6a2758423ab862cf9b03f5623515d07433e4; branch feat/logbook-n1a-modern-navigation-20261023, base main, Draft PR #391. V2-1 implementation before this documentation checkpoint: 01f53bae2a519063a70348141e2f08c410476900; refresh current full HEAD after push.
- Owner approved a more substantial N1 V2 UI after rejecting visually-small N1-A. Frozen LIGHT sidebar in light theme / DARK sidebar in dark theme for sun-readable cockpit use, including system appearance. Exact implementation is a preview candidate, not production acceptance.
- Runtime changed ONLY components/sidebar.tsx (brand copy and Workspace section label), components/sidebar.module.css (nav heading, readable rows, responsive/collapsed), app/ui-system.css (sidebar-only adaptive light/dark palette, wide/collapsed nav, larger targets/mobile header and accessible focus). Source regression updated in tests/logbook-n1-navigation-style.test.ts. Proposal documented in docs/product/LOGBOOK_N1_V2_VISUAL_REDESIGN_PROPOSAL_2026-10-23.md; ROADMAP checkpoint updated. No route, auth, notification semantics, data, aviation or Training changes.
- Source-only in-memory inspection: 22/22 checks PASS for URL sets, active/focus, storage, theme selectors, responsive touch and scope. Node tests, typecheck, build, Playwright, exact browser computed cascade, native Safari and actual owner V2 screenshots NOT RUN. No DB, migrations, flags or deploy action. Production status unchanged by this work, runtime verification UNKNOWN.
- DO NOT: merge/deploy, production DB/flags, alter flight workflows or page content, add libraries, implement N1 V2-2 shared page shell until owner visually reviews V2-1, or delete unrelated ZIPs in the user's local checkout.
- ONE NEXT STEP: owner pulls updated Draft PR #391, restarts local guarded disposable-PostgreSQL preview, inspects mobile/desktop light/dark and sends visual feedback. Then decide next visual batch before tests.

## 2026-10-23 - Owner frozen theme behavior for N1 V2

Owner requires the global sidebar and mobile drawer to match LIGHT/DARK appearance, including system appearance. No permanent navy sidebar against a light workspace; sunny-day cockpit readability is the reason. Use current theme tokens, opaque backgrounds, high legibility for small nav text/icons, visible active/focus cues and touch targets. This does not authorize a brand/color redesign. Updated design: docs/product/LOGBOOK_N1_V2_VISUAL_REDESIGN_PROPOSAL_2026-10-23.md. Draft PR #391 remains a not-yet-accepted N1-A candidate; no N1 V2 runtime changes or testing. No merge, deploy, DB, flags or unrelated scope.
ONE NEXT STEP: visually approve the revised theme-adaptive N1 V2 shell concept before V2 code.

## 2026-10-23 — N1 V2 visual direction requested; proposal checkpoint

- Canonical repo filipto861/flytally-logbook; main verified c68e6a2758423ab862cf9b03f5623515d07433e4. Existing work feat/logbook-n1a-modern-navigation-20261023, Draft PR #391. No merge or deploy.
- Owner successfully opened localhost preview and provided four desktop/light screenshots. Explicitly rejected V1's visual magnitude; wants a much more modern overall look. This approval of a stronger outcome does NOT approve a specific new visual composition.
- Scope-limited revised spec: docs/product/LOGBOOK_N1_V2_VISUAL_REDESIGN_PROPOSAL_2026-10-23.md. Proposal only: deep-navy sidebar against light workspace, more structured brand/header/chrome, navigation type/spacing/active states, coherent shell. Preserve brand palette, all routes/roles/keyboard/mobile behaviors. Shared page cards/tabs deferred to N2/N3 as separate product decisions.
- Runtime code unchanged in this checkpoint; existing N1-A CSS candidate remains on branch and is not visually accepted. Screenshots are not committed. V2 testing/typecheck/build/Playwright/native Safari NOT RUN. Actual user preview is user-reported only. Production DB/migrations/flags/deploy not touched.
- DO NOT expand into unrelated fixes, Training, business logic, authentication, DB, experimental effects or new libraries. Preserve owner-local unrelated ZIP files.
- ONE NEXT STEP: owner approves/revises new N1 V2 shell design (navy rail with light content, reorganized visual header) before any V2 implementation.

## 2026-10-23 — owner-requested local visual preview before automated tests

- User explicitly requested to view N1-A in browser **before** running release/targeted tests. This is a sequencing change only, not scope expansion. Working branch `feat/logbook-n1a-modern-navigation-20261023`, Draft PR #391, base main `c68e6a2758423ab862cf9b03f5623515d07433e4`.
- Scoped tool added: `tooling/run-n1-preview-local.ps1`. Windows PowerShell local developer command; Node24, PG16/18 bins and npm deps required. Creates own GUID-qualified TEMP local PG cluster (localhost dynamic nonstandard port) and `flytally_currency_test`; verifies physical data-directory, DB identity and empty public schema **before** invoking existing destructive browser fixture/bootstrap; seeds synthetic pilot credentials and v20/v21 canonical SQL; runs `npm run dev` on localhost only. No remote DB path, no test runner, no Vercel.
- **Evidence:** script authored and GitHub source reviewed only. Actual PowerShell runtime, DB fixture bootstrap, dev server and rendered pages **NOT RUN**; typecheck/build/Playwright/native Safari **NOT RUN**. Production DB/migrations/flags/deploy **UNCHANGED BY THIS WORK**; current live state UNKNOWN beyond earlier read-only deployment check. Since the script includes destructive fixture SQL under a physically verified *new* local cluster, never run it with existing PG instances, never manually invoke the fixture bootstrap, never bypass identity checks.
- DO NOT: change aviation behavior, other PRs, Training, brand, DB schema in production, merge/deploy, or start N1-B/N2 before owner has inspected N1-A locally.
- **ONE NEXT STEP:** user runs `powershell -NoProfile -ExecutionPolicy Bypass -File .\tooling\run-n1-preview-local.ps1` from a clean checkout of this exact N1 feature branch and provides non-sensitive screenshot/feedback. If the preview aborts, inspect error before another action.

## 2026-10-23 — N1-A Draft PR #391 checkpoint (implementation candidate only)

- Repo `filipto861/flytally-logbook`. Verified base `main=c68e6a2758423ab862cf9b03f5623515d07433e4`. Work branch `feat/logbook-n1a-modern-navigation-20261023`, Draft [PR #391](https://github.com/filipto861/flytally-logbook/pull/391), base `main`. Pre-checkpoint work SHA `f03cf383d7537c9402a837d56440c10323d0732c`; this checkpoint advances HEAD. Re-fetch full SHA before ending.
- Owner approved N1 Modern Aviation Utility design and permitted scoped visual candidate, **not** merge/deploy. Files: `components/sidebar.module.css`, `app/ui-system.css`, `tests/logbook-n1-navigation-style.test.ts`, `tests/v300-sidebar-polish.test.ts` (update precisely changed semantic group-title color expectation), `docs/product/LOGBOOK_N1_MODERN_NAVIGATION_DESIGN_2026-10-23.md`, `ROADMAP.md`, Project Memory docs.
- Scope/DO NOT: change only sidebar action hierarchy, active/secondary link visuals and spacing; keep all URLs/labels/IA, brand tokens, mobile/desktop/iPad focus and drawer behavior. No page content, N1-B motion, N2/N3, unrelated PRs, Training, flights/auth/DB/infrastructure, dependencies, auto-prefill, migrations, flags, merge or deploy.
- Evidence: 20/20 in-memory GitHub source assertions PASS on updated candidate (not Node test execution), token color ratios calculated **6.45:1 dark / 5.69:1 light** (not rendered); updated legacy assertion checked by source inspection. **NOT RUN**: Node24 targeted tests, typecheck, build, candidate risk planner, authenticated Playwright, computed CSS, responsive screenshots, real Safari/VoiceOver/CI. Production DB/migrations/flags current state **UNKNOWN**, no mutations. Read-only Vercel project `filipito/logbook` latest production READY `dpl_4XGBawGy187VyJpG5nyRFe2p2fKW` still references `34b865bb0ced1222945cecb107589826890ee31a`; **no deploy performed**.
- Risks: style cascade and actual visual usability not proven by source inspection. PR remains Draft awaiting local targeted tests and screenshots; do not transfer historical test PASS to new SHA.
- **ONE NEXT STEP:** run exact-head owner-local Node24 targeted tests + candidate risk plan and authenticated browser visual inspection, then request owner's N1-A visual acceptance before any merge.

## 2026-10-23 — N1-A modern navigation candidate (owner-approved design, not merged)

- Workstream: `feat/logbook-n1a-modern-navigation-20261023` from verified `main=c68e6a2758423ab862cf9b03f5623515d07433e4`; N1-A **visual only** following the approved [design](../product/LOGBOOK_N1_MODERN_NAVIGATION_DESIGN_2026-10-23.md).
- Touched UI: `components/sidebar.module.css` and sidebar-only block appended to `app/ui-system.css`; new source regression `tests/logbook-n1-navigation-style.test.ts`. Keep all nav URLs/labels/group membership and keyboard/touch behavior intact. N1-B mobile animations and N2/N3 pages not started.
- Evidence: GitHub in-memory 14/14 source assertions PASS; hex design tokens contrast 6.45:1 dark/5.69:1 light **calculated, not browser rendered**. Node24 targeted tests, TypeScript, build, Playwright/browser screenshots, iPad/native Safari = **NOT RUN**. DB/migrations/flags/deploy = **UNTOUCHED / runtime state UNKNOWN**. No merge permission.
- **ONE NEXT STEP:** run exact-head targeted tests and authenticated visual/browser review across mobile, desktop and themes; seek owner approval of actual appearance before merging.

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
