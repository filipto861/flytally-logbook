# DATA-1E2 — DeepSeek offline frozen-source review package handoff (2026-10-30T09:51:44.561Z)

## Scope and artifact

Owner requested `TAK ZKUS PRIPRAVIT BALICEK PRO DEEPSEEK`, because DeepSeek cannot access private GitHub. Prepared a **Windows Node24 local SOURCE EXPORT BUILDER**, delivered as this conversation's verified `FlyTally_DATA1E_DeepSeek_Builder_20261030.zip` attachment. SHA-256 of the starter ZIP: `49ad62e8002e1e31ed2a328604a597c392d57e3fd0bda74591f72bf1b5350cb8`. This starter ZIP is **NOT a complete source bundle**. ChatGPT's current runtime cannot fetch the private repository directly as a Git binary archive; the owner must run the builder against their already cloned private GitHub repository to produce the final **self-contained source ZIP** and 6 Markdown review volumes.

**Source identity independently verified:** canonical `main@807f281e5870164b794d001480ecc84e0b45aea5`; executable frozen [Draft PR #443](https://github.com/filipto861/flytally-logbook/pull/443) `16a94e051037b680f7b08e97e8880e7967ada062` with parent `bb60178bebdbb7b0242474bc7b0fedfd99268567`; frozen design source `3edcfceea5561ef296fbf66e00c703c6a67e2811` and new docs-only [Draft PR #444](https://github.com/filipto861/flytally-logbook/pull/444). Parent stack remains Draft, not production.

## Exact files and integrity checks

- Using the connected GitHub repository source API (not memory), independently fetched and recorded **45 allowlisted file identities** (Git blob SHA-1 and source commit) at the two frozen SHAs: 7 AUTH, 11 BACKUP, 3 RESTORE, 4 DB, 9 TESTS, 6 GUIDANCE, 4 REFERENCE, 1 DESIGN. No `.env`, external customer documents, live flight exports or GPS records are allowlisted.
- The starter ZIP contains `build-deepseek-package.mjs` (Node24, no dependencies), `locked-files.json` (path/git-blob SHA1 allowlist), `PROMPT_FOR_DEEPSEEK.md` (independent Q1–Q9, P0–P3, A0–A11 and do-not rules), and `README_FOR_OWNER.md` (Windows commands, privacy cautions).
- Builder reads only Git objects `git show COMMIT:path` from a positively verified clone of `filipto861/flytally-logbook`; verifies every original Git blob SHA-1, scans for common obvious embedded credential formats (not a guarantee of absence), then writes outside the repository: `FlyTally_DATA1E_DeepSeek_FROZEN_SOURCE.zip`, six independently uploadable line-numbered Markdown volumes, `00_MASTER_PROMPT.md`, `MANIFEST.json` with per-file SHA-256, and preserved exact raw sources in the ZIP. It does **not** checkout, commit, run SQL, access a DB, deploy or automatically upload to DeepSeek. Git fetch of specific branches is a separate owner-controlled step.
- Generated volumes: `01_AUTH_SESSION_API.md`, `02_BACKUP_V13_SIGNATURE.md`, `03_RESTORE_ENGINE.md`, `04_POSTGRES_SCHEMA.md`, `05_EXISTING_TESTS.md`, `06_GUIDANCE_DESIGN.md`. These support DeepSeek Free phased review if needed. Source line numbers are retained, and raw exact bytes are separately available in ZIP.

## Local artifact verification (NOT an application or Claude/DeepSeek review)

- `node --check build-deepseek-package.mjs`: **PASS**.
- `node build-deepseek-package.mjs --self-test`: **PASS** for ZIP writer/CRC32 known vector.
- Synthetic temporary Git repository fixture: script successfully exported two fictional files at frozen fixture SHAs, generated all six volumes and manifest; Python `zipfile.testzip()` / raw bytes / source list and final ZIP verified **PASS**. Wrong blob identity case correctly failed before creating any output directory, **PASS**. These are **tooling tests**, not review of 45 live repo files in the owner's clone.
- Starter ZIP `unzip -t`: **PASS**; content four files; independent `sha256sum` matched above.
- Real full 45-file **owner-side package construction NOT RUN**. Actual DeepSeek review **NOT RUN**. Actual signed-v13 authenticated application GET/restore, local isolated PG16 app fixture, release-risk **NOT RUN**. Previously completed **real Neon HTTP stored** 1/4/12MiB **PASS 3/3** and approved disposable project cleanup **PASS**, distinct earlier executable SHA `60affbabda8e377656c9a6ec82e63e227803929d`. Do not treat any of these as release readiness.

## Boundaries

No private repository source content has been uploaded to DeepSeek or another third-party reviewer by this handoff. The owner must separately choose to share proprietary source files, after checking privacy/retention policies. Do not upload secrets, `.env`, credentials, real flights or GPS data. No new code in the FlyTally app, GitHub `main` changes, Neon project, DB/migration/feature flags, merge, Vercel deployment or Training action. Production DB/schema/flags UNKNOWN, provider hard payload maximum UNKNOWN.

**ONE NEXT STEP:** owner downloads the starter ZIP, extracts and runs builder against their trusted local cloned repo using exact SHA checks, verifies `PACKAGE_BUILD PASS`, then sends only the six generated Markdown source volumes plus `00_MASTER_PROMPT.md` to DeepSeek (never credentials). Collect DeepSeek's actual read-only report and reconcile its claims against frozen GitHub code before owner approves any changes.
