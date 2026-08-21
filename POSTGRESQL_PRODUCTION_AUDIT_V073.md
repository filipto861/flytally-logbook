# v0.73 PostgreSQL Production Audit

## Scope

Audit performed after the successful v0.72 PostgreSQL production cutover.

Primary goals:
1. remove SQLite-era runtime overhead from PostgreSQL reads
2. reduce network round-trips
3. isolate migration tooling from the normal hot path
4. tighten cache ownership/invalidation
5. make PostgreSQL outages visible instead of returning plausible empty data
6. add low-overhead runtime diagnostics

## Findings and remediation

### 1. Read-only queries paid transaction cleanup round-trips
v0.72 used the transactional PostgreSQL adapter for normal SELECT helpers.

Remediation:
- added explicit read-only PostgreSQL adapter mode
- pooled read checkout uses autocommit
- no trailing COMMIT/ROLLBACK after normal SELECTs
- write SQL is rejected on the read-only path

### 2. Several counters were separate network queries
Remediation:
- combined database header counters into one SQL statement
- Profile uses its already-loaded flight dataframe for flight count
- PostgreSQL table-count diagnostics are batched

### 3. PostgreSQL Admin diagnostics were in the main application monolith
Remediation:
- moved the entire PostgreSQL admin/migration UI to `logbook_ui/postgres_admin.py`
- lazy import occurs only when Admin → PostgreSQL is opened

### 4. Expensive production diagnostics could run too eagerly
Remediation:
- relation/index diagnostics require an explicit button
- table-count diagnostics require an explicit button
- lifecycle diagnostics require an explicit button

### 5. Missing production observability
Remediation:
- bounded in-memory SQL timing
- bounded pool checkout timing
- bounded page-render timing
- p50/p95/max summaries
- safe query tags only; no SQL parameters/secrets

### 6. Cache audit
Remediation:
- removed accidental/unhelpful cache decorators
- verified cached user data uses explicit tenant keys
- added short cache for expensive global Admin aggregate
- invalidate Admin aggregate on durable data changes
- corrected count-cache invalidation after flight mutations

### 7. PostgreSQL errors could be misrepresented as empty data
Remediation:
- critical production reads now re-raise DB errors
- custom-airport production failures are visible
- GPS JSON fallback production failures are visible
- database health production failures are visible
- authenticated profile read failure does not log out the user
- active-page DB failures render a controlled outage state
- no backend fallback is introduced

### 8. Code cleanup
- removed redundant `read_table_count()`
- removed unused imports from AST audit
- migration/shadow recovery tools retained but isolated from normal runtime
- app.py reduced from ~10,046 lines in v0.72 to ~9,718 lines in v0.73

## Static audit results

Validated:
- no read-only helper contains application DML
- no unused imports detected in `app.py`, `logbook_core`, or `logbook_ui`
- cached functions do not implicitly depend on current user without a user key
- cached functions do not render Streamlit UI side effects
- PostgreSQL production database errors are not intentionally converted to zero/empty values in critical read helpers

## Database/schema impact

None.

- SQLite schema remains 10
- PostgreSQL schema remains 1
- no data migration
- no automatic index DDL
- no Secrets format change

## Test coverage

v0.73 adds dedicated regression coverage for:
- read-only PostgreSQL transaction behavior
- write rejection through read-only connection
- query metric privacy
- page timing
- batched counts
- lazy PostgreSQL diagnostics
- cache ownership
- failure visibility
- session preservation during database outage
- PostgreSQL GPS fallback failure visibility
