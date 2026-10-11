# FlyTally Logbook — branch pruning preflight (NO DELETIONS EXECUTED)

**Date:** 11 October 2026. **Repository:** `filipto861/flytally-logbook`. **Source of truth:** `main@b1763ee6d928cd6e1920e3f739ce371439c969a2` before this docs-only preflight. **Status: PREPARED / OWNER-LOCAL EXECUTION PENDING.**

The owner approved retiring the legacy Satellite R1/R2 experiments, and PRs #271–#279 and #281 were closed **without merge**. Live GitHub audit at this source snapshot returned **0 open PRs**, **44 branches** (including `main`), **12 existing tags**, **12 releases** and none of the ten retired branch heads were a direct tag target. GitHub's connected toolset can **read/compare branches but has no branch-delete operation**. This audit **did not delete any branch, create a tag, modify production or execute local git push**. Counts are time-scoped, not post-deletion claims.

## Proposed deletion batch A — 10 branches behind discarded R1/R2 PRs

These are pinned to immutable heads. All ten corresponding PRs were independently verified closed/unmerged with reasoned comments on 11 October. `main...branch` compares showed divergence (ahead >0), so deleting without preserving commit reachability is *not* equivalent to removing an already-merged branch.

| Closed PR | Branch | Head SHA | Ahead/behind vs main |
| --- | --- | --- | --- |
| #271 | `docs/3.7.0-phase2-satellite-readiness` | `b08905b5a0e10276fcab1f48dcfac121e8d5428d` | 10 / 21 |
| #272 | `feat/3.7.0-satellite-selector-trial` | `b88aa8da92a65cb08195269983458ff17a8806b4` | 35 / 21 |
| #273 | `feat/3.7.0-satellite-r2-functional-integration` | `a29d4e4f0fe091e449d4df10fd0bdd39d289767a` | 51 / 21 |
| #274 | `feat/3.7.0-satellite-r2-server-auth` | `8a0589ad9f6bc90f50472c6ff5d0db5fbd2b0237` | 62 / 21 |
| #275 | `feat/3.7.0-satellite-r2-provider-fixture` | `1a3fe5d4c783cca2cc12115802b3322e890a9067` | 79 / 21 |
| #276 | `feat/3.7.0-satellite-r2-http-integration` | `8e0851012e271927157e7d5f3ae6a1aca76d6715` | 105 / 21 |
| #277 | `feat/3.7.0-satellite-r2d-ops-design` | `62a74e82c4fdf9ddc9bc2403e3dc93967e752a5c` | 113 / 21 |
| #278 | `feat/3.7.0-satellite-r2d-upstream-disable` | `8d8e45b83e9a6fea8806e49d2af3f4468f9f5087` | 136 / 21 |
| #279 | `feat/3.7.0-satellite-r2d2-bounded-provider-io` | `096b86d8800ac763f2d74bbcba5cb54f978b0984` | 509 / 21 |
| #281 | `docs/3.7.0-s1-satellite-architecture-gate` | `25fe505dedaaa521b20b5f3579cf9dcb4dc66451` | 12 / 20 |

### Preserve unique historical commits with only three lightweight archival tags

GitHub compare confirms all **eight** #272–#279 branch heads are ancestors of #279 HEAD, `096b86d8` (their individual comparisons each have `behind=0`). The independent #271 and #281 documentation branch tips are **not** ancestors of #279 (`behind=10` and `behind=13` respectively). Preserve three reachability roots **before** removing any branch:

| Proposed new tag | Exact target |
| --- | --- |
| `archive/2026-10-11-satellite-r2-final` | `096b86d8800ac763f2d74bbcba5cb54f978b0984` |
| `archive/2026-10-11-satellite-readiness` | `b08905b5a0e10276fcab1f48dcfac121e8d5428d` |
| `archive/2026-10-11-satellite-s1-review` | `25fe505dedaaa521b20b5f3579cf9dcb4dc66451` |

Tags are **proposed**, not created. No existing tag or release is to be deleted or moved. Although closed PRs keep discussions/diffs visible, three new tags make the relevant historical Git objects explicitly reachable independent of deleted branch refs.

## Optional deletion batch B — six branches provably ancestors of main

At the same exact main SHA, compare result for these six was `ahead=0`, `status=behind`. No archival tag is necessary because each head is already reachable from main. Requires an execution-time recheck; no current PR must use the head/base ref.

| Branch | Exact head SHA | Main ahead by |
| --- | --- | --- |
| `codex/v335-batch8-routes-headers-legal` | `8e09aa1469cb535e08ae385757ed60011c4e3ca0` | 893 |
| `docs/flight-entry-f1-closeout` | `5c2af689c74e209358d22eebf05c3f4120a4224f` | 829 |
| `feat/flight-entry-f33-aircraft-authority` | `8031f3d0d12e4da26647e9eb8112ec03d4e6eac7` | 769 |
| `feat/flight-entry-f34-aircraft-context-ux` | `844ce1c4ebb8d59c2b69284336d2d61fbbff18eb` | 729 |
| `fix/story-map-toggle` | `af15f8e59d9a2916bc21f76b882e012a05cfe5f4` | 1067 |
| `test/flight-entry-f35-closeout` | `512e2eb38eab76905c9d2d80f3faeee91da8433a` | 713 |

**Explicitly EXCLUDED:** `chore/pre-f3-integration-anchor@4906c1c3`, also `ahead=0`, `behind=801`, because its name implies a deliberate integration/rollback anchor; do not delete without independent owner decision. All remaining branches (including recent M3 diagnostics, flight entry, maps and testing work) are **UNREVIEWED / RETAIN**. A protected=false flag is not deletion approval.

## Execution / verification boundary

A conservative PowerShell script was delivered as a conversation download on 11 October: `flytally-logbook-branch-cleanup-2026-10-11.ps1`. It is **not** committed to this repository and was **not** executed. It defaults to read-only preflight; `-Apply` creates/verifies the 3 archival tags and deletes batch A with an exact `--force-with-lease` SHA check; `-Apply -IncludeMerged` additionally considers the six already-merged branches. It verifies GitHub origin URL, baseline main ancestry, exact remote SHA per ref, remote existing tag correctness, and absence of open PR head/base branch references (via authenticated `gh` if available, otherwise public GitHub REST; fail closed if unreadable). It aborts without branch deletions if tag preservation fails; it avoids the pre-F3 anchor.

Use on the owner's Windows PC in the actual `flytally-logbook` git checkout; first dry-run, inspect output, then explicit `-Apply`. Do not assume that a downloaded script's static verification makes later remote state safe. If GitHub refs, auth or remote URL differ, stop and reassess instead of overriding leases.

### After owner-local execution, required closing evidence

1. Capture terminal output: successful tag pushes (3) and branch deletions (10, or 16 if optional batch B explicitly chosen); errors must be recorded rather than hidden.
2. Re-query GitHub `main`, open PRs, branch list and tag refs. Expected branches **34** after batch A, or **28** after A+B, assuming no unrelated branch creation/deletion since the preflight snapshot. These are **expected counts only; not verified outcomes**.
3. Update `ROADMAP.md`, `FEATURES.md` if the capability register changed (normally no), `CHANGELOG.md` with **actual** date/action evidence; do not record hypothetical deletes as completed.
4. Post-deletion runtime/source tests/DB/deploy remain **N/A** (no runtime change), not PASS; no release/production state assertion from branch housekeeping.

**Verification performed for this preflight:** GitHub reads and explicit `compare_commits` for 10 retired + 7 legacy zero-ahead candidates; pairwise ancestor checks for seven R2 heads vs #279; three-tag reachability analysis; existing 12 tags/12 releases listing; open-PR list = 0 at snapshot. Local script was produced and inspected but **NOT EXECUTED OR PARSER-TESTED** under PowerShell, and no remote write was made.
