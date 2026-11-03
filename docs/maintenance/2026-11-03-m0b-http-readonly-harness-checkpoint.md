# M0-B — HTTP read-only harness checkpoint (2026-11-03 UTC)

Repository: `filipto861/flytally-logbook`.
Main verified: `c9c2f60303236113a223942072311f5e37f876f7`.
Work: `test/logbook-m0b-http-readonly-20261103`, Draft PR #468 stacked on Draft PR #467 (base `cbc3c2067570917e29c2e62fde2bcd935f200d0b`).
Working executable changed paths: `tooling/m0b-b1b2c-neon-http-readonly-probe.mjs`, `tooling/m0b-b1b2c-neon-http-readonly-probe.test.mjs`. Design: `docs/maintenance/2026-11-03-m0b-neon-serverless-http-readonly-harness.md`.

Owner scope: independent NEW empty Neon PostgreSQL 16.15 project only, strictly read-only SQL for current live driver probe. No production data copy, production SQL, migration, merge, deploy, production flags, full-account Restore, Training changes or DeepSeek review.

Target: isolated Neon project `blue-haze-29352938`, branch `br-patient-sound-bacf0trt`, DB `flytally_m0b_isolated`, operator `flytally_m0b_operator`, unpooled compute `ep-quiet-smoke-babbdfv9`; provider metadata reconfirmed. Existing M0-A production Vercel `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` READY at app `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`. Prod DB/schema/flags UNKNOWN.

Tests/evidence:
- PASS only for manually reproduced *source-equivalent* offline checks: local Node 22.16.0, `node --check` for local probe and test, `node --test` 13/13 PASS. Reproduction is NOT byte-verified against exact GitHub SHA; treat as PARTIAL local diagnostic, not CI pass.
- NOT RUN on exact GitHub SHA: new 13 offline test definitions under Node24, app TS/build/Playwright, full native PG16 candidate suite, actual `@neondatabase/serverless` HTTP transaction/true two-client overlap, auth/role privilege proof, V14 issuer/B2 evidence, prod authenticated smoke.
- An attempt to add a temporary branch-specific GitHub Actions workflow was blocked by tool safety checks; no workflow created and no bypass attempted.
- Previous Draft #467 Neon connector read-only PG16 evidence remains only PARTIAL P0/P5/P8, never actual serverless HTTP transport proof.
- No credentials, connection strings, private flights or GPS used in this work.

Risk: Neon operator has broad grants; exact driver script may run only after explicit scope metadata, opt-in, correct unpooled host, private test credentials, and READ ONLY preflight. Both direct expired Trash writers unchanged, `DATABASE_SCHEMA_VERSION=21`, full-account Restore still fail-closed. Retention A 90-day Trash + working further 12 months minimal UID needs lawful/privacy review before release.

ONE NEXT STEP: run exact-source Node24 offline test suite and protected live READ ONLY `@neondatabase/serverless` two-client probe in an authorized isolated executor with provider identity reverified; do not touch production or run remote destructive DML.
