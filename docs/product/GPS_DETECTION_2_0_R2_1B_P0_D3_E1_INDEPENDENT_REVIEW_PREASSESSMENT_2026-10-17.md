# GPS Detection 2.0 D3 E1 — pre-independent-review source assessment

**2026-10-17. Status: CHATGPT SOURCE AUDIT DONE / DEEPSEEK REVIEW REQUEST PACKET READY / DEEPSEEK RESPONSE NOT RECEIVED.**
**Pinned code:** PR #355 source on `83eaec732b5a6190a959b0dfd356006939e70edf` (last recorded docs-only E1 HEAD).
**Independent review packet:** [self-contained DeepSeek source review](GPS_DETECTION_2_0_R2_1B_P0_D3_E1_DEEPSEEK_INDEPENDENT_SOURCE_REVIEW_PACKET_2026-10-17.md), with four exact source files and Git blob SHAs. This preassessment is **not** an independent second-AI opinion.

## Evidence and scope

- Owner local clean `2e362aeeafe7d816c53c74c61d4c761927d56a22`: `node --check` PASS; **24/24** Node mock/static/early-refusal PASS, 0 skipped/failures; `npm run typecheck` PASS. E1 follow-up commits after this pin were documentation-only.
- No Docker/PG SQL was executed; actual inspector behavior, PostgreSQL effective RLS, restricted login and driver semantics remain **NOT RUN**; this is not a real-data security clearance.
- Only E1 synthetic SQL runner/tests/docs reviewed. No `flytally-training`, production auth, database/Neon or real GPS changes.
- Project default continues without Docker. No Postgres native binaries available on owner PATH by previous D3 diagnostics.

## Independent ChatGPT source review notes and proposed falsification focus

| ID | Observation / uncertainty | Status and suggested proof |
| --- | --- | --- |
| E1-R01 | `docker inspect` `Mounts` can be an array of tmpfs records for `--mount` or a mapping of destinations for `--tmpfs`. E1 accepts both. | **Source matches documented Docker behavior**, but exact desktop/daemon runtime result is **NOT RUN**. Source: https://docs.docker.com/engine/storage/tmpfs/ |
| E1-R02 | In map representation, E1 checks only expected destination keys and not the mapping values. `HostConfig.Tmpfs` likewise checks exact paths but not its documented options (`rw,nosuid,noexec,size`). | **Coverage gap (source confirmed)**, not proven attack. Reviewer should decide strict value/options validation to avoid false PASS without brittle false negatives. |
| E1-R03 | `NetworkMode=none`, zero explicit port mappings and local pipe/unix heuristics do not attest physical host, container OS-level isolation or real account authorization. | **Risk bounded by synthetic-only data**, not empirical proof. Review trust model and avoid misleading labels. |
| E1-R04 | Attestation occurs after `docker run -d` and before *runner-issued* `psql`/fixture. It does not prevent official Postgres entrypoint initialization before inspection. | **Source ordering confirmed**; amend wording if reviewer considers "pre-SQL" too broad. |
| E1-R05 | New E1 Node tests search source text for `container inspect` and relative position rather than exercising runtime parser with malformed/wrong-ID/mount/config JSON. | **Test limitation confirmed**; candidate for small black-box fake-Docker subprocess regressions without installing Docker (not implemented). |
| E1-R06 | Cleanup verifies absence of randomly named container using a new `docker ps -aq --filter name=^/...$` call. Effectiveness depends on Docker daemon/context continuity and filtering. | **NOT RUNTIME VERIFIED**; reviewer to suggest robust exact ID-based tests, and whether check has false PASS/FAIL risk. |
| E1-R07 | Runner uses a locally resolved immutable Docker image ID with `--pull=never`, but no publisher-signature/content-origin attestation. | **Source correct to its limited claim**; never call it trusted image supply-chain verification. |
| E1-R08 | Existing `psql` uses superuser + `SET SESSION AUTHORIZATION`; valid for synthetic policy-context falsification, not login credentials or Neon HTTP/pool behavior. | **Known earlier-review limitation**; independent true RLS testing remains unrun. |

## Recommendations frozen until reviewer replies

1. **Do not claim E1 Docker runtime PASS** or RLS PASS based on Node 24/24. Distinguish syntax, static/mock/early refusal, Docker config semantics, Postgres policy and real identity as separate gates.
2. **Do not make Docker mandatory.** Optional native PostgreSQL remains design only, no silent substitution with ambient DB, Neon or shared cluster.
3. **Do not implement speculative major cleanup/mount normalization changes before the second-AI review.** Prefer targeted *mock-Docker black-box* negative tests if reviewer confirms value and risk; keep original tested E1 code untouched in separate PR #355.
4. **Before any actual Docker runtime execution**, reconcile reviewer findings against concrete source plus Docker documentation and require explicit owner selection of safe disposable environment. No user data/production credentials.
5. **Real GPS remains NO-GO**, regardless of synthetic P0-D3 outcome, until DB owner scope, true principal/consent, no-write driver proof, source completeness, privacy and audit gates are all independently satisfied.

**Status:** Review packet prepared; independent E1 findings **NOT RECEIVED**. No code/tests/DB executed in this documentation-only branch; no main merge or deploy.
