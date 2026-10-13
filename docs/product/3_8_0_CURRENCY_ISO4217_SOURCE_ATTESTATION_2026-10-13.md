# Currency #136 — ISO 4217 List One source attestation (13 October 2026)

## Exact source evidence
- User uploaded `list-one.xml` in project conversation and authorized use of this file, following explicit confirmation it was downloaded from the official SIX website. **Origin statement: owner-attested**, not independently authenticated from HTTP/TLS capture by our tooling.
- XML declares `<ISO_4217 Pblshd="2026-09-17">` and has **280** `CcyNtry` rows.
- Uploaded file SHA-256: `33139b438657d1cee116ba737807ea71d19d6de4b90f799a09c56f0cc6a1b0ff`.
- Uploaded file Git blob SHA-1: `1b8df1bec436592b955286d4e39c72518be9e444`.
- The above Git blob SHA-1 equals the tracked `data/iso4217/list-one-2026-09-17.xml` in Currency registry PR #337, so **source content is byte-identical**. Do not copy/replace/reformat the pinned XML.
- The XML itself does not cryptographically establish its download domain. Therefore `verifiedDirectlyWithSIX:false` remains **unchanged** (meaning independent origin authentication is not established); do not interpret this flag as denial of the owner's explicit source attestation.

## Bounded technical verification
- On exact PR HEAD `ff6fd97e3f1b8f246a59416c72ad20c298f0b766`, owner-local Windows: `node tooling/generate-iso4217-registry.mjs --check` PASS (155 current eligible monetary codes, 10 excluded funds, 13 excluded no-scale codes); `npm.cmd test` **1497/1497 PASS**. The earlier `npm.cmd run typecheck` was PASS on an earlier SHA, **NOT RUN** on current commit.
- XML source format and row count confirmed by separate local Python XML parse; Git blob comparison confirms uploaded bytes exactly match code source.
- This review **does not** approve schema v21, activate selection/write flows, auto-assign currencies to legacy amounts, deploy a change, or perform FX conversion.
- If an independent authenticated SIX fetch later differs, stop and review publication date, revision and affected codes before updating the snapshot.

## Decision and scope
- The owner authorized **using this exact supplied XML** for the offline read-only ISO monetary registry.
- Source data accepted under **owner-attested** provenance for this isolated registry; technical approval of future billing storage, legacy attestation and migration still requires M2/M3 review.
