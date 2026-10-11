# Documentation consistency checker (report-only)

Manual, local, read-only tooling for `flytally-logbook`. It does not touch the application, Postgres, Vercel, browser or network; it **never edits repository files**. The user approved an initially **non-blocking** audit, not an additional release gate.

Run from repository root on Node.js 24.x:

```bash
node docs/scripts/check-documentation.mjs
node --test docs/scripts/check-documentation.test.mjs
```

Optional isolated-fixture root for diagnostics:

```bash
node docs/scripts/check-documentation.mjs --root /path/to/repo
```

Checks: package.json version against top-level and workspace-root package-lock version; ordinary inline relative Markdown link targets from root Markdown and active docs. It skips external URLs, anchors and root-relative application routes; historical snapshots under `docs/history/`, dated audits under `docs/maintenance/` and historical `docs/certification-readiness/` are excluded **as sources** but linked targets can still be checked.

**Evidence limits:** it is not a complete Markdown parser; link titles, reference-style syntax, fragment/heading anchors, external website availability, semantic correctness, provider permissions and claimed release/runtime state need independent checks. A missing target or version mismatch prints `WARN` yet exits **0** to keep report-only mode. An invalid invocation or unreadable root exits **2**, never a false PASS. No automatic CI/merge-blocking enforcement is configured.

`docs/` ownership keeps this **documentation-only helper** outside runtime/`tooling/` pipelines. If it becomes a mandatory gate or moves into tooling, review `tooling/development-modules.json` and the actual risk policy first. Do not bypass runtime test requirements by moving application code under docs.
