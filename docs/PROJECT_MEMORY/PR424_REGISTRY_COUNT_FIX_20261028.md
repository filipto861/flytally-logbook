# 2026-10-28 — PR #424 owner-local full Node test failed on missing module registry ownership

**Evidence:** User ran `npm test` under Windows Node v24.19.0, on pinned #424 source `a79e8d44df89d52bfd4363adf42050a4fb0c3319`, and reported process EXIT CODE **1**. Visible assertion is `actual:414, expected:413`. npm version notice is unrelated. User's full test log was not uploaded, therefore number of failing tests is **UNKNOWN**, not asserted as exactly one.

**Source diagnosis:** `tests/development-scope.test.ts` enumerates `.ts/.tsx/.css` under `app/,components/,lib/` and compares to `tooling/development-modules.json#ownership.auditedTotal`. #424 added `app/flights-balanced-glassless.css` but its registered audited count remained 413 and file had no module owner. Its new `tests/flights-balanced-glassless.test.ts` also was not registered in `ui-contract` group.

**Staged fix (untested):** code commit `f2081e057bfe349e3e0d944d702931265175ecad` on `feat/flights-balanced-glassless-trial-20261028` updates ONLY `tooling/development-modules.json`: owned Flights CSS under `flight-records`, count 413 → 414, dedicated source-contract test added to `ui-contract` group. The guard test `tests/development-scope.test.ts` itself is not weakened or changed. No runtime/CSS/flight-data logic changes. This is a GitHub source edit, **NOT a GitHub Actions or Vercel test run**.

**Verifications before this checkpoint:** canonical main `484d84c33f34c5049a30a28aecc0a957bc6d9d07`; PR #424 Draft, base main; PR #425 Draft, stacked on #424 (its branch is still based on old #424 SHA and needs future history/registry reconciliation before merge); production READY Logbook `dpl_isy3ZVcV3pN9H7gwLpBDku9iYhHU` source `f8d412171a8cbb12cdfcae88d9c23735938fcb53` unchanged.

**Evidence statuses:** owner prior #424 target/typecheck/build PASS; **full Node FAIL at old SHA**, amended source full Node **NOT RUN**; #424 browser acceptance NOT RUN. #425 previous owner-local UI/full Node/typecheck/build PASS at previous source SHA; future reconciliation still pending. PostgreSQL acceptance N/A for preliminary UI scope, no production DB/flags or migration changes; readback UNKNOWN. Native iPad/desktop prior visual owner review, not functional browser acceptance.

**DO NOT:** merge, deploy, change production DB/migrations/flags, trigger cloud tests, or modify Training. No remote database tests.

**ONE NEXT STEP:** on owner's Windows PC, fetch pinned source commit `f2081e057bfe349e3e0d944d702931265175ecad`, run targeted `tests/development-scope.test.ts` and full `npm test`, report exact exit codes and any remaining failure names from local logs. Browser acceptance to follow using isolated, verified localhost fixture if required.
