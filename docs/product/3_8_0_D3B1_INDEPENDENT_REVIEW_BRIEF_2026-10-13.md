# FlyTally Logbook 3.8.0 — D3b-1 A+ independent reviewer brief

**Status:** REQUEST PREPARED / REVIEW NOT RECEIVED (13 October 2026). This brief is for DeepSeek or Claude as a **read-only independent technical review**; their suggestions are not project authority.

## Provenance and state

Repository `filipto861/flytally-logbook`. Branch `fix/3.8.0-d3b1-atomic-fail-closed-trash`, **Draft PR #333** with base branch `analysis/3.8.0-d3b-protected-trash-evidence` / previous Draft #332. Owner-approved **Option A+ conservative fail-closed ordinary Trash**. Do **not** touch `flytally-training`, propose ordinary Trash deletion of independent evidence, claim production authority, merge, migrate, deploy or change scope without owner approval.

**Exact owner-local tested code SHA `8cf6cb8a5a186cb1e9be21be7607fca7e13731ea`**: Windows PC Node v24.19.0, isolated native PG16 runner: TypeScript PASS, source tests 4/4, actual five-statement Trash SQL 6/6, sequential real runtime optimizer SQL v1..v20 + test cases 11/11, **21/21 PASS, 0 fail/skip**. Correct disposable DB identity `flytally_currency_test|flytally|127.0.0.1|51374` matched and cluster stopped. Same source SHA: `npm.cmd run build` Next.js 16.3.2/Turbopack PASS, 41/41 static pages, TypeScript PASS. Complete `npm test` **1,480/1,480 PASS** and participant/roadmap/Windows safety source tests **13/13 PASS** were on preceding code SHA `ca59d29b54555df9bf545be17ccd71f5998c6a33`; subsequent changes to `8cf6cb8a` were documentation only. **No CI claim**.

Primary frozen contract: `docs/product/3_8_0_D3B1_ATOMIC_FAIL_CLOSED_TRASH_CONTRACT.md`. Evidence history, release status and risks: `ROADMAP.md`, `FEATURES.md`, `CHANGELOG.md`.

## Source files reviewer must read

- `lib/flight-trash.ts` `moveFlightToTrash()`: owned-parent unconditional `SELECT ... FOR UPDATE` before snapshot, A+ eligibility guards on flights and 8 evidence domains in archive and final DELETE; full-transaction SQL invariant via `WITH deleted AS (DELETE ... RETURNING)` and dynamic `1 / CASE` abort when archive exists but DELETE=0. Preserve track/expense archive semantics.
- `lib/flight-sharing.ts`: canonical lazy public-shares schema initialization.
- `app/(protected)/flights/actions.ts` `deleteFlight()`: safe blocked/error redirects; plus `attachKmlTrack()`, `deleteTrack()`, `saveFlightExpenses()`, `applyGpsTimes()`, `updateFlight()`.
- `app/(protected)/flights/[id]/page.tsx`: the prior inline `removeParticipant()` directly unlinked/deleted independent evidence and has been **removed**. Linked participant-owned draft now shows no destructive button and a safe explanation; audited participant-withdrawal lifecycle is a separate unapproved future feature.
- `app/(protected)/flights/shared-actions.ts` and `lib/flight-certification.ts`: acceptance/materialization/provenance and optimistic certification writers.
- `lib/db-optimization.ts` optimizer v1..v20, real FK constraints and immutable recipient provenance triggers.
- `tests/integration/v380-d3b-trash-source-characterization.test.ts`, `tests/integration/postgres-v380-d3b-real-trash-races.test.ts`, `tests/integration/postgres-v380-d3b-migrations-v1-v20-trash.test.ts`, `tooling/run-v380-d3b1-atomic-trash-local.ps1`, `tests/v1311-participant-ownership-lapl.test.ts`, `tests/v1312-hotfix.test.ts`.

## Review questions (please answer with exact evidence)

1. **SQL snapshot/serializability:** Is an unconditional parent `FOR UPDATE` followed by independent child checks under the actual Neon/serverless `sql.transaction([...])` semantics sufficient? Precisely identify races with child INSERT/UPDATE/DELETE, especially writers not constrained by a real parent FK. Do not equate parent lock with locking absent child rows.
2. **Archival invariant:** Does the SQL data-modifying CTE and divide-by-zero assertion reliably enforce archive=final DELETE in one transaction under READ COMMITTED? What fails if the SDK batches differently, yields a retry, or returns a surprising shape? Is there a simpler, verifiable atomic assertion without altering migration or broad refactor?
3. **Coverage of protected evidence:** Do the 8 `NOT EXISTS` domains miss any table with independent legal/shared/verification significance or any source/participant identity ambiguity? Include historical revoked/declined and provenance without source FK. Distinguish conservative false blocks from destructive false allows.
4. **Writer path races:** Analyze `attachKmlTrack`, `deleteTrack`, `saveFlightExpenses`, `applyGpsTimes`, `updateFlight`, participation/instructor acceptance and materialization; for each give actual lock order and a **deterministic two-session SQL or app test plan** and whether a new source lock or exact-parent FK is required. Track archive must never silently omit concurrently attached tracks/points.
5. **Restore, certified and prior behavior:** Could A+ conflict with existing Trash/Restore v20, certified Void/immutable provenance, account backup v13, expenses/tracks, self-owned draft, or read-only shared copies? Are there auth, IDOR, error/redirect, form-action or UX regressions introduced by removing `removeParticipant()`?
6. **Release proof gaps:** Which smallest reproducible **disposable isolated local PostgreSQL + authenticated Next.js SDK** tests would be sufficient, and which tests still cannot make a production historical schema equivalence claim? Can the existing browser harness safely be used without resetting an existing local service/database?

## Output expected

Return a severity-ranked **finding table** with exact path/query, failure interleaving, impact, reproducibility, recommended minimally invasive fix, tests, and any counter-evidence. Separate **proven defect**, **plausible risk requiring reproduction**, and **no issue**. Offer small bounded implementation batches with Do/Do Not, acceptance criteria and migration/deploy implications. If missing source prevents a conclusion, say `NOT VERIFIED` rather than guessing.

**No code changes. No new SQL against production. No merge/deploy.** Owner Filip makes final product decisions; reconcile this review against live repo source and empirical tests before accepting it.
