# Certification and Verification Specification

Version: 1.33.3

## 1. Pilot record certification

FlyTally certification means that the signed-in pilot finalises one revision of their own logbook record. It is an internal integrity mechanism and must not be described as EASA or competent-authority certification.

On certification:

1. the record is validated;
2. the current `record_revision` is retained;
3. FlyTally serialises the version-specific canonical certification payload;
4. SHA-256 is calculated over the JSON representation of that payload;
5. the hash, certification-format version and timestamp are stored;
6. database-level protection prevents ordinary UPDATE operations from mutating the certified record.

## 2. Certification payload versions

- **v1** — original core flight payload.
- **v2** — adds revision and correction reason.
- **v3** — adds structured `purpose_code` while preserving v2 content.

Verification always uses the certification version stored with the record. New payload versions must not reinterpret old hashes.

## 3. Correction lifecycle

The intended lifecycle is:

`Draft R1 → Certified R1 → Correction R2 draft → Certified R2 → ...`

Before opening a correction, the certified row is copied to `flight_certified_revisions` with its original snapshot, hash, certification version and timestamps. The editable live row then moves to the next revision. The previous certified revision is not overwritten.

Verification evidence references the exact revision and flight hash that was signed. A later correction therefore cannot silently inherit an earlier signature as if it applied to the new revision.

## 4. Instructor / supervising-pilot verification

The canonical verification payload is:

- `flightId`;
- `flightUserId`;
- `signerUserId` (nullable for same-device in-person signature);
- `recordRevision`;
- `flightHash`;
- `verificationRole`;
- `credentialSnapshot`.

The server signs the canonical, recursively key-sorted representation with **HMAC-SHA-256** using the server signing secret. Verification evidence therefore contains both:

- the SHA-256 fingerprint of the certified flight revision; and
- a server-authenticated HMAC over the verification event payload.

v1.33 introduced a report-time check of this stored HMAC instead of merely displaying the stored signature string.

## 5. Credential snapshot

The credential snapshot preserves the identity/credential information presented at signing time so later profile edits do not rewrite historical evidence.

For a FlyTally-account signer it can include:

- display identity;
- source `FlyTally account`;
- active licences and issuing authorities;
- active qualifications/certificate references.

For same-device handwritten signing it can include:

- entered instructor identity;
- licence number;
- qualification;
- optional certificate/qualification reference;
- capture method;
- handwritten stroke data.

## 6. Identity-assurance distinction

**FlyTally-account signature**: signer acts through an authenticated FlyTally account. The stored credential snapshot is derived from that account's current FlyTally credential records.

**In-person same-device signature**: FlyTally binds the entered identity details and handwritten stroke evidence to the exact certified revision, but FlyTally does **not** independently prove that the physical person holding the device is the named instructor. User-facing and authority-facing documentation must preserve this distinction.

## 7. Revocation

Revocation changes verification status to `revoked`, records a timestamp and requires a reason. It does not delete the historical verification row. A revoked verification must not count as a current signed verification.

A later re-signing may reactivate/update the same unique verification relation while retaining the database audit fields required by the implementation.

## 8. Authority verification report

The v1.33 authority verification report is owner-authenticated and printable. It shows:

- flight and pilot identity;
- report reference;
- current certification state;
- every preserved certified revision and SHA-256 verification result;
- correction reasons;
- signed/revoked verification evidence;
- captured credential identity/source;
- bound revision and flight hash;
- server HMAC value and live cryptographic verification status;
- handwritten signature preview when stored.

The report is technical evidence only. It is not a certificate issued by an aviation authority.

## 9. Backup and restore verification

The portable backup has an outer SHA-256 integrity checksum covering the JSON payload. This checksum detects ordinary corruption or modification, but it is not a secret-key authenticity mechanism.

Certified flight revisions retain their individual certification fingerprints independently of the outer backup checksum. During certification-history validation, current and archived flight revisions must still recalculate to their stored SHA-256 values.

From v1.33.2, stored flight-verification evidence contained in a portable backup is also validated cryptographically before certified backup history is accepted:

- a `signed` or `revoked` verification must contain a server signature;
- any stored server signature must verify against the canonical verification payload using HMAC-SHA-256;
- when the verification belongs to the restored account's own flight, `record_revision` and `flight_hash` must bind to the current certification fingerprint or the corresponding archived certified revision.

Therefore, changing verification evidence and merely recalculating the outer portable-file SHA-256 does not create valid instructor verification evidence.

The v1.33.2 PostgreSQL restore acceptance test additionally confirms that current R2, archived R1, verification HMAC evidence, structured purpose, participation binding and GPS data survive the tested exact-restore path.

## 10. Current versus historical verification semantics

From v1.33.3, the complete R1→R2 acceptance scenario explicitly verifies the read semantics used across the application.

A verification is **current** for Flight detail / operational print purposes only when all of the following match the live flight:

- `flight_id` and `flight_user_id`;
- `record_revision`;
- `flight_hash = certification_hash`;
- `status = signed`;
- the applicable verification role.

An earlier signed verification remains valid historical evidence for the certified revision it was bound to, but it must not become current evidence for a later correction revision.

Audit and Authority Verification Report intentionally retain the complete revision/signature history. Flight detail and Print intentionally resolve the current revision/hash only. v1.33.3 executes those production read queries against the same PostgreSQL workflow state to verify that distinction.

## 11. Failure behavior

An integrity mismatch must be displayed or rejected as a problem. FlyTally must not silently rewrite the stored hash to make the mismatch disappear.

If the server signing secret is unavailable, verification-signature checking reports an unavailable state rather than claiming the stored HMAC is valid. Exact restore of signed evidence should fail closed when that evidence cannot be cryptographically validated.
