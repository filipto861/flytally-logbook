# GPS Detection 2.0 — I2-B1 read-only Windows host inventory

**Date:** 2026-10-17. **Repo:** `filipto861/flytally-logbook`. **PR:** #359 (Draft, unmerged). **Status:** I2-B1 offline Node/TypeScript **OWNER-LOCAL 20/20 PASS on exact tested executable SHA**; actual Windows PowerShell probe/OS attestation **NOT RUN**. Historical authored-only status preserved below.

## Owner-local exact-SHA I2-B1 verification (2026-10-17)

**EXECUTED ON OWNER WINDOWS HOST, VERIFIED BOUNDED SCOPE** — full clean tested HEAD `ae1eb81c35ea27b56798e30b37ce4cacc2ef46a8`. Both I2-B1 `node --check` validations PASS; targeted Node **20/20 PASS** (I1 12 + I2-A 3 + I2-B1 5), 0 failed/skipped/cancelled/todo; `npm run typecheck` / `tsc --noEmit` PASS. These were owner-local, **not CI**. The GitHub branch equals that exact SHA before the documentation follow-up.

**OPEN / NOT EXECUTED:** Windows PowerShell 5.1 positive parser/CLI execution, actual read-only Windows observations, independent token/ACL proof, PostgreSQL cluster creation/start/stop, SQL/RLS assertions, browser/build/full Node suites, real owner GPS, migrations, merge and production release.

**Post-acceptance source concern:** The Node launcher builds the path of the PowerShell binary from inherited `SystemRoot`, merely checking it is an absolute Windows non-UNC path. This is not strong executable identity/pinning. Do **not** run `--read-only-inventory` until this launch-path trust issue and PS5 compatibility receive independent review and, if necessary, a small correction with fresh local verification.

Independent reviewer packet, exact file blob hashes and constraints: [I2-B1 source review](GPS_DETECTION_2_0_I2B1_INDEPENDENT_REVIEW_HANDOFF_2026-10-17.md). The file contents after this section's addition are docs-only changes; they are **not new executable acceptance evidence**.

---

## Intended boundary

This is a narrow incremental I2-B1 research step after owner-local I2-A 15/15 PASS at exact clean `eb02936be35e8c0590ab4de66cf4b781eeb515e2`. It does NOT implement the I2-B2 privileged OS adapter or I2-C PostgreSQL security proof.

The new ASCII Windows PowerShell 5.1 probe requires `-InventoryOnly`, rejects inherited database/PG/Docker connection overrides and only reads:
- Effective admin status via `WindowsPrincipal.IsInRole(Administrator)` — **not** an attested safe process token.
- `--version` of the five exact `C:\Program Files\PostgreSQL\16\bin` executables (no `initdb` initialization, `pg_ctl` start/stop or `psql` connection).
- Windows service status (Running/Stopped/Absent) for `postgresql-x64-16` and `postgresql-x64-18`; no service control, no port/PID discovery.
- Exist/reparse/ACL-*readability* signals for user-profile, AppData, LocalAppData and potential `FlyTallySyntheticPG16` root. **Always sets `aclTrusted=false`**, does not emit ACL owner/entries or private filesystem paths. No directory creation/deletion.

The Node CLI `--read-only-inventory` invokes only this pinned PowerShell script, with a bounded wait and output size, sanitized failures and an allowlisted process environment; it prints only a bounded status, never raw secrets or captured paths. It rejects every other flag and non-Windows platforms. `validateReadOnlyWindowsInventory` requires strict shape, exact PG16.15 version strings, no trust claim and `runtimeAuthorization=false`; `evaluateReadOnlyInventory` refuses elevation/reparse/environment overrides. **An accepted inventory does NOT imply trusted ACL, exclusive run directory, current system identifier, owner PID or SQL role isolation.** It is incompatible with the I2-A native run-attestation schema intentionally.

## Changed scope

- `research/gps-r21-p0-d3-synthetic-security/native-pg16-i2b1-inventory.mjs`
- `research/gps-r21-p0-d3-synthetic-security/native-pg16-i2b1-inventory.d.mts`
- `research/gps-r21-p0-d3-synthetic-security/read-native-pg16-i2b1-inventory.ps1`
- `research/gps-r21-p0-d3-synthetic-security/run-native-pg16-i2b1-inventory.mjs`
- `tests/gps-r21-p0-d3-native-pg16-i2b1-inventory.test.ts` (five authored tests)

No `lib/`, app, auth, database schema, production GPS code, Docker runner, RLS fixture, GPS datasets, Training, migrations, main merge or deploy change.

## Owner-local verification required

Run on the exact clean topic branch, first confirming HEAD and `git status --short`:

```powershell
node --check research/gps-r21-p0-d3-synthetic-security/native-pg16-i2b1-inventory.mjs
node --check research/gps-r21-p0-d3-synthetic-security/run-native-pg16-i2b1-inventory.mjs
npm run test:target -- tests/gps-r21-p0-d3-native-pg16-guards.test.ts tests/gps-r21-p0-d3-native-pg16-i2-offline.test.ts tests/gps-r21-p0-d3-native-pg16-i2b1-inventory.test.ts
npm run typecheck
```

Expected target **20 tests** (12 I1 + 3 I2-A + 5 I2-B1), NOT RUN on latest HEAD. PowerShell 5.1 actual command-parse and read-only probe validation are separate owner-local steps **NOT RUN**. Do NOT call the PowerShell probe before source review if a local privilege/ACL policy requires additional approval; invoking inventory is not required to verify the five mocked/static tests.

## Next / security review request (I2-B2 before executable runtime)

Ask DeepSeek for an independent **read-only review** of actual PowerShell 5.1 syntax, token elevation interpretation, ACL and reparse limitations, process environment isolation and the strict non-mutating guarantee. Must not assert effective ACL trust based on `Get-Acl` readability. Demand a fully separate reviewed source/contract for: exclusive owner-only ACLs and run UUID PGDATA, start-only-on-owned cluster, nonce/system identifier/port/server readback before any DDL, and fail-closed PID identity and cleanup. Existing PostgreSQL16 and PostgreSQL18 Windows services remain untouchable. No `initdb`, `pg_ctl start/stop`, SQL/RLS or actual real GPS until separate owner runtime approval and safety review.

**Overall P0-D3:** OPEN. **Actual PostgreSQL RLS:** NOT RUN. **Real GPS/Neon/driver/authorization:** NO-GO. **Release:** NOT READY.
