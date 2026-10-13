# Independent read-only review — FlyTally Logbook A1-T2c

**To DeepSeek / Claude. Review only. No code, no branch, no DB or Neon actions.**

## Context

- Repository `filipto861/flytally-logbook`; main baseline `4ca2847795435549f36d44f253eb7c105eea6d25`; runtime schema version 20. Currency D1–D4 frozen; candidate v21 SQL #322 unregistered.
- A1-T1 validators PR #323, A1-T2a catalog PR #324 and nested A1-T2b disposable PG16 rehearsal PR #325 are unmerged Draft. Owner-local A1-T2b exact SHA `2d4699deb4e31630f5b719cef9cdf6b61258bdc3`: Node24 project typecheck PASS; 8 safety + 3 actual PG16 catalog tests PASS; this is NOT a restore acceptance.
- Primary contract to review: `docs/product/3_8_0_CURRENCY_A1T2C_ATOMIC_TRASH_CONTRACT.md`, source `lib/flight-trash.ts`, `lib/db.ts`, `lib/local-postgres.ts`, `lib/db-optimization.ts`, `lib/v159-schema.ts`, unregistered v21 candidate and reviewer reconciliation in docs draft #319. No assumption should replace exact source.

## Questions for reviewer

1. Can a static Neon HTTP `sql.transaction([...])` batch deliver the proposed same-row `FOR UPDATE` lock, transaction-local staging and deterministic PL/pgSQL assertions? Identify exact PostgreSQL syntax constraints and separately what only real Neon HTTP tests can prove.
2. What is the smallest design that guarantees archive eligibility, original user/flight ownership, protected history, and no mutation of malformed or stale archived JSON, while preserving current new numeric restored IDs?
3. How would you distinguish no-eligible-candidate, natural-key duplicate, and data-integrity conflict without relying on an existing unique natural-key index? What anomalies remain for two different trash IDs / unrelated flight writers?
4. How can the batch prove full child record preservation (IDs remapped, content intact, exact JPY/EUR/KWD monetary tuples, no CZK fallback) rather than only equal counts?
5. Does local `psql` transaction emulation truly represent the HTTP client's SQL behavior? List any differences requiring gate-specific tests.
6. Which corruption, protected-revision and concurrency tests are missing from T2c-01..16? Separate P0 blockers from eventual enhancements.

## Output required

Use **ACCEPT / CHANGE REQUIRED / REJECT** per issue with file/SQL evidence and severity. Provide a minimal corrected contract and acceptance-test deltas, not speculative full-code rewrites. Mark unverifiable parts explicitly and identify decisions requiring owner review. Do not claim actual PG16, Neon, CI, merge or deploy success from a document. No silent changes to `flytally-training`, no registry v21 registration, no automatic FX or inferred currency. No source-backed ISO registry approval until origin verified.