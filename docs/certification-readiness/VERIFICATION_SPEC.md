# Certification and Verification Specification

Version: 1.33.0

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

v1.33 introduces a report-time check of this stored HMAC instead of merely displaying the stored signature string.

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

## 9. Failure behavior

An integrity mismatch must be displayed as a problem. FlyTally must not silently rewrite the stored hash to make the mismatch disappear.

If the server signing secret is unavailable, verification-signature checking reports an unavailable state rather than claiming the stored HMAC is valid.
