# FlyTally Security and Restore Evidence

Version: 1.33.2

This document describes the automated evidence added for cross-user ownership boundaries and portable-backup restoration. It is an engineering evidence note, not a statement of regulatory approval.

## 1. Cross-user ownership model

FlyTally server actions obtain the acting account from `requireUser()` and then constrain mutable database operations using that account identifier. Critical object identifiers such as `flightId`, `participationId` and `verificationId` are therefore not sufficient on their own to authorize a mutation.

The v1.33.2 PostgreSQL acceptance harness reads the exact SQL template blocks from the current production action files and executes them with multiple actor identities against an isolated PostgreSQL 16 database.

Covered boundaries include:

- certified-correction lookup requires `flights.user_id = actor user`;
- participant review lookup requires `flight_participations.participant_user_id = actor user`;
- verification revocation requires `flight_verifications.signer_user_id = actor user`;
- source-side participation cancellation requires `flight_participations.source_user_id = actor user` and the expected source flight;
- flight locking requires `flights.user_id = actor user`.

The tests deliberately submit valid object IDs belonging to another account. The mutation or lookup must return no authorized row and the protected record must remain unchanged.

### Scope limitation

The PostgreSQL test starts after authentication: it injects the actor identifier that production receives from `requireUser()`. It does not emulate the browser cookie/session handshake or Next.js routing layer. A later HTTP-level test suite may add that outer layer, but v1.33.2 already exercises the production ownership predicates against real PostgreSQL rather than checking only source text.

## 2. Portable backup integrity layers

FlyTally uses several different integrity mechanisms with different purposes.

### Portable file SHA-256

The complete portable backup payload carries a SHA-256 digest. This detects accidental corruption and ordinary modification of the exported file. SHA-256 here is an integrity checksum, not a secret-key authenticity mechanism; a person able to edit the JSON could also calculate a new ordinary SHA-256 digest.

### Certified flight SHA-256

Each certified flight revision carries its own version-aware certification fingerprint. Restored current and archived revisions are re-evaluated using the certification version stored with that revision. A changed regulatory payload therefore does not become valid merely because the outer backup checksum was recalculated.

### Verification HMAC-SHA-256

Instructor/supervising-pilot verification evidence is protected by a server-keyed HMAC-SHA-256 over the canonical verification payload. That payload includes the flight owner, optional signer account, exact record revision, certified flight hash, verification role and credential snapshot.

From v1.33.2, backup certification validation also verifies stored HMAC evidence before an exact restore is accepted. A `signed` or `revoked` verification without valid server signature evidence is rejected. For verifications belonging to the restored pilot's own flight, the signed `flight_hash` must additionally match either the current certification fingerprint or the corresponding archived revision fingerprint.

This closes an important distinction: recomputing the outer unkeyed backup digest cannot be used to forge instructor-signature evidence.

## 3. Automated restore fixture

The v1.33.2 acceptance fixture represents a small but deliberately complete regulatory chain:

- pilot-owned EASA flight;
- certified R1 snapshot;
- correction and current certified R2;
- structured `LAPL_FCL140A_REFRESHER` purpose;
- R1 in-person handwritten verification evidence;
- R2 authenticated FlyTally instructor verification evidence;
- flight participation bound to the R2 hash;
- GPS track with three stored coordinates.

Before database restore, the portable payload is parsed, its outer SHA-256 is checked, certified R1/R2 history is verified and both HMAC signatures are checked.

## 4. PostgreSQL restore evidence

The integration test does not maintain an independent restore implementation. It reads and executes the production SQL blocks from `lib/account-restore-v6.ts`, including the `json_populate_record` paths used for:

- `flights`;
- `flight_certified_revisions`;
- `flight_tracks`;
- `flight_participations`;
- `flight_verifications`.

The certified flight is restored in the same staged form used by production and then receives its stored certification/locking fields through the production update block.

After restoration the test verifies:

- current R2 certification SHA-256 recalculates to `verified`;
- archived R1 certification SHA-256 recalculates to `verified`;
- structured purpose is unchanged;
- both stored verification HMAC values recalculate to `verified`;
- in-person credential/signature evidence remains present;
- participation remains bound to the exact R2 source hash;
- GPS point count and coordinate payload are unchanged;
- replaying the tested restore blocks does not duplicate these evidence rows.

## 5. Tamper cases

Two separate negative cases are automated.

1. A normal modification to the backup without updating its outer digest is rejected by `parsePortableBackup()`.
2. A stored instructor signature is replaced and the attacker then recomputes the ordinary outer SHA-256. File-level parsing succeeds, but the keyed HMAC verification fails and certification-history validation rejects the backup.

This distinction should be retained in authority-facing explanations: the backup checksum and verification signature solve different integrity problems.

## 6. Evidence retention

The main GitHub verification workflow stores PostgreSQL test output as a commit-specific Actions artifact for 90 days. Evidence is therefore tied to a specific Git SHA and can be associated with the corresponding controlled software release.

## 7. Remaining work

The next evidence layers should concentrate on:

- full workflow testing from draft through certification, signature, correction and re-certification;
- consistency of the resulting state across Flight detail, Audit, Authority Verification Report and Print;
- HTTP/session-level security tests when an appropriate isolated application-test harness is available;
- performance evidence with mature datasets.
