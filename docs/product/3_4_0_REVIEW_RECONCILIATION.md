# 3.4.0 — Independent review reconciliation

**Review verdict:** APPROVE WITH CHANGES  
**Reviewer:** independent second AI (Claude), document-only review  
**Reconciled:** 4 October 2026  
**Repository verification:** performed after the review against `flytally-logbook`

## Reviewer limitations

The independent review explicitly stated that it had not inspected the repository and marked `certifyFlight`, review-checkbox persistence, Training-purpose consumers and versioning details as NOT VERIFIED.

This reconciliation closes those points against the actual repository before runtime implementation.

## Accepted findings

### Same-page certification needs one shared authority path

Accepted.

Repository verification:
- current `certifyFlight` reads the persisted owned row;
- runs `flightCertificationCompliance` and blocking-issue evaluation;
- computes the certification v8 hash from that persisted row;
- updates certification state only for an uncertified owned record.

3.4.0 will extract/reuse one shared certification helper rather than duplicate these rules.

### Certification summary must remain visible

Accepted.

The current post-save page is a real second review surface: it opens the full editable Logbook-data form, shows workflow state and exposes certification blockers. Removing the required second click therefore requires a compact pre-certification summary and blocker surface beside Save & certify.

### Enter-key certification risk

Accepted.

Frozen rule: missing/default submit intent means Save draft. Save & certify requires an explicit action. Pressing Enter must not certify.

### Draft fallback

Accepted with implementation clarification.

Single-flight Save & certify may persist the draft first and then attempt certification from the persisted row. If certification cannot complete, the flight remains a draft and the UI must state why. A successful save may not be rolled back merely because certification was blocked.

### Invitations remain separate

Accepted.

Save & certify must not send Actual-PIC, generic crew or instructor-verification invitations. Those remain explicit post-certification actions bound to the certified revision/hash.

### Regulatory evidence belongs in the primary context

Accepted.

The compact context and pre-certification summary will include regulatory category / evidence basis. Billing remains secondary.

### Collapsed sections need truthful summaries

Accepted.

Progressive disclosure may not make “unset” look like zero/default. Each collapsed section must summarize its actual semantic state.

## Repo findings that refine the review

### Generic GPS reviewed checkbox

Repository result:
- `part_<n>_reviewed` is required by the GPS import server action;
- it is not stored in `flights`;
- it is not part of the certification fingerprint.

Conclusion:
- there is no certification/history requirement to preserve the generic checkbox;
- removing it requires an intentional server contract change, not merely CSS/UI removal;
- 3.4.0 replaces it with deterministic evidence readiness plus a targeted acknowledgement only for non-blocking GPS-quality warnings.

### Touch-and-go / SERA / profile acknowledgement

The reviewer suggested possible acknowledgement for T&G, near-twilight classification and profile configuration.

Reconciliation:
- T&G count remains visibly editable; Save & certify is sufficient confirmation, so no extra checkbox.
- near-boundary SERA logic already fails closed to manual input; no acknowledgement is needed.
- invalid aircraft profile remains a hard blocker; acknowledgement may not override it.
- only non-blocking GPS-quality warnings require explicit warning review.

### Multi-flight certification

Reviewer preferred atomic draft save followed by all-or-none batch certification.

Repository result:
- current GPS multi-flight creation already atomically saves all draft flights/tracks/required connected-crew rows;
- current certification helper does not operate through a transaction handle suitable for an all-or-none multi-row batch without further architecture work.

Decision:
- 3.4.0 keeps multi-flight import draft-only.
- direct Save & certify is single-flight only.
- batch certification is deferred rather than adding transaction architecture solely for this UX release.

### Duplicate-submit / idempotency risk

Reviewer requested a persisted idempotency token.

Repository result:
- Manual and GPS creates already use a canonical `flightFingerprint`;
- writes are serialized with PostgreSQL advisory xact locks;
- inserts recheck `NOT EXISTS` inside the transaction;
- exact duplicate submission is therefore already blocked server-side.

Decision:
- a new persisted idempotency token is not required as a 3.4.0 prerequisite without evidence that the existing duplicate contract can create duplicate records;
- 3.4.0 adds explicit regression coverage for concurrent/double submission and certification state;
- duplicate detection may never cause an existing unrelated draft to be auto-certified.

### Draft exclusion from authority consumers

Repository result:
- recency service queries only `certified_at IS NOT NULL`;
- public flight sharing resolves only certified flights.

This supports draft fallback and multi-flight draft-only behavior.

### Training purpose

Reviewer advised removing a new generic marker from scope.

Accepted and already frozen by Filip:
- ULL category filtering is correct;
- no generic Training / practice structured purpose will be added in 3.4.0;
- `purpose_code` is certification-protected from payload v3 onward.

Additional repository finding:
- current picker visibility is category-aware;
- server normalization additionally gates purpose persistence by role/evidence context;
- therefore some UI-visible purpose choices can currently be silently discarded.

This parity defect is in 3.4.0 scope. One shared applicability predicate must drive both client visibility and server acceptance.

## Versioning reconciliation

The reviewer correctly identified a collision:
- production package/footer is 2.7.0;
- historical CHANGELOG labels already include v2.8, v2.9, v3.0, v3.2 and v3.3.

Therefore the earlier proposed target 2.8.0 is superseded.

Frozen result:
- current production remains 2.7.0;
- first canonical unified release target is **3.4.0**;
- at ship time package/footer/CHANGELOG/tag move together to 3.4.0;
- future roadmap uses only numeric product versions and numeric phases;
- historical labels remain archived, not reused.

See `docs/product/VERSIONING.md`.

## Final implementation gate

**APPROVED TO IMPLEMENT after this reconciliation.**

Runtime implementation may proceed in small phases under the 3.4.0 contract. Any evidence that the current duplicate protection, certification helper reuse or Training-purpose shared predicate cannot satisfy the frozen contract reopens the design gate before merge.
