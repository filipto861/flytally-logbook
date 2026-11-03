# M0-B B1b.2c — owner retention-A policy direction and exact PG16 window evidence

**UTC checkpoint:** 2026-11-03T07:51:52.146Z. **Repo:** `filipto861/flytally-logbook`. **main verified** `c9c2f60303236113a223942072311f5e37f876f7`. **Work** `test/logbook-m0b-b1b2c-retention-a-window-20261103`, stacked **Draft [PR #463](https://github.com/filipto861/flytally-logbook/pull/463)** on Draft #462 `5fd3a4e36c02a7d27be0e6816ada5a5016e492f5`; ancestors #461→#455, B0 #454 separate. **Work HEAD before this checkpoint:** `a8ac64f2ddfcb4a625db4ca9da33bed6f8955183` (GitHub); **exact executable/test SHA:** `f18e873aa549160e0ee876fb1d825d28ca3a2131`. Reverify final work HEAD/PR and ensure post-test changes only Markdown/removed temporary CI. GitHub push must be confirmed, else UNPERSISTED.

## Owner scope/frozen direction

Owner expressly **approved variant A as design direction** (“dobre tak souhlasim”) and previously **declined DeepSeek review**. Preserved 90-day Trash; on stored `purge_after` cutoff expunge flight/GPS/expense archive atomically while keeping minimum scoped owner/kind/UID marker for **working 12 calendar months from that cutoff**. The 12-month period is **NOT proven legally justified or authorized for deployment**; lawful basis/data minimization and erasure exceptions require privacy/legal assessment and may revise it. Account erasure removes owner-linked markers absent specific verified basis; independent other-pilot/signed Void/audit material is separate. Signed source trust unverified/expired means full-account Restore UNAVAILABLE, never inferred.

## Actual files and evidence

- New: `tooling/m0b-b1b2c-retention-a-window-probe.mjs` (test-only random disposable schema), `docs/maintenance/2026-11-03-m0b-b1b2c-retention-a-owner-decision.md`, this checkpoint.
- Temporary branch-only `.github/workflows/m0b-b1b2c-retention-a-window.yml` created for test and then deleted. Changed Markdown: `ROADMAP.md`, `ARCHITECTURE.md`, `docs/PROJECT_MEMORY/{SESSION_HANDOFF,ACTIVE_WORK}.md`, earlier retention proposal annotation.
- **[GitHub Actions #41598681099](https://github.com/filipto861/flytally-logbook/actions/runs/41598681099)** `f18e873aa549160e0ee876fb1d825d28ca3a2131`: Node24 syntax **PASS**, safe-target **7/7 PASS**, actual disposable PostgreSQL16.15 retention A **8/8 PASS**, own schema dropped. Synthetic boundary tests: before/on 90-day cutoff, strict original DELETE rejected, atomic state/payload transition, 12 calendar-month marker from stored cutoff, duplicate UID prevention until expiry, at-expiry marker removal, owner-scope erase with unrelated owner protected, legacy NULL UID expiry. This does not validate DB privileges for real erasure.
- **NOT RUN:** real app writer and actual PG catalog/Neon HTTP parity, native Windows PG 164/164, full Node/TS/build/Playwright/risk, V14 signed issuer/coherent backup, native/imported B2 audit, production authenticated smoke. Production Vercel **READY M0-A** `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub`, app SHA `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`, `fly-tally.com`; production DB/schema/flags **UNKNOWN**.

## Hard stops and one next step

**DO NOT:** merge, deploy, run any remote/production database SQL/migrations/restores/deletes, change production flags, enable full-account Restore, rewrite audit/certification, claim lawful 12-month retention without review, touch Training, or request DeepSeek review. Full Restore stays M0-A fail-closed. Test-only PG16 is not production acceptance.

**ONE NEXT STEP:** design a separately gated, backward-compatible V22 schema-first plan that atomically migrates **both** expired Trash deletion entrypoints and privileged owner erasure without enabling Restore; prepare real-schema/Neon parity acceptance, retain legal/privacy signoff as blocker.
