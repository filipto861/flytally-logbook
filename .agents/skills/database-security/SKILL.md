---
name: database-security
description: Apply to Neon/PostgreSQL schema, transactions, migrations, recovery, auth, authorization, PII/GPS containment, server actions and protected endpoints in FlyTally Logbook.
---
# Database and Security

## When to load
Persistence changes, SQL, auth/session, sharing permissions, credential handling, deleted-record recovery and external service integration.

## Procedure
1. Trace the real request from UI/API to authentication, server authorization, parsing, DB transaction and audit side effects. Do not infer safety from UI guards.
2. Review schema, migrations, indexes, constraints, read/write contracts, feature flags and backward-compatible rollout; identify exact deployment database environment before any SQL.
3. Prefer additive compatibility, strict parsers, parameterized queries, least privilege, idempotency and atomic transactions across multi-record mutations. Define rollback/restore boundaries.
4. Check cross-user leaks, flight/GPS personal data, object-level authorization, permission revocation, stale sessions, race conditions and partial failures.
5. Keep test and production DB separate; destructive fixtures allowed ONLY on positively identified isolated loopback databases according to DEVELOPMENT.md.
6. DB schema version and runtime rollout are separate facts; build/test results do not prove migrations are applied.

## Hard stops
No remote/production destructive test, migration, restore, deletion, auth weakening, production flag or deployment without separately explicit owner approval. UNKNOWN target means STOP; do not test connectivity by mutating anything. Never put credentials or private pilot data into Git, chat handoff or fixtures.

## References and verification
ARCHITECTURE.md, DEVELOPMENT.md, sql/, lib/, targeted tests, actual environment identity. Select isolated PostgreSQL/auth tests by exact candidate risk; report unverified production state as UNKNOWN.