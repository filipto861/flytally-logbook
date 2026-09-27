# FlyTally v1.65 — Advanced Qualifications

Candidate scope:
- extend the existing `pilot_qualifications` model with explicit structured classification rather than creating a parallel credential system;
- store qualification family, regulatory category, privilege role, qualification scope, classification source, issue date and limitations as additive fields;
- keep all legacy qualification labels readable and usable without automatic regulatory backfill;
- use conservative classifier hints for display only; regulatory structure becomes authoritative only after explicit user confirmation;
- provide a compact Advanced qualification structure editor in Licences with progressive disclosure;
- provide a central qualification catalogue for Part-FCL, Part-SFCL and Part-BFCL qualification families and common privileges;
- let confirmed structured qualifications take precedence over legacy label parsing in Aeroplane, Sailplane/TMG, Helicopter and Balloon recency services;
- preserve legacy label parsing as a compatibility fallback;
- keep structured qualification fields inside the existing portable qualification backup graph;
- expose runtime schema migration through the normal schema gate.

Safety boundaries:
- FlyTally does not issue, extend, revalidate or renew a qualification;
- classification alone never changes qualification validity, recency or expiry dates;
- unknown aircraft/type labels are not automatically promoted to type ratings;
- IR(A), IR(H), IRI and other instructor/examiner privileges remain distinct;
- confirmed classification takes precedence only for qualification identity/scope, never as evidence of current privileges;
- existing certification fingerprints and certified flight records are unchanged;
- no legacy qualification row is regulatorily backfilled by migration;
- existing ULL, Part-FCL, Part-SFCL and Part-BFCL recency rules remain authoritative.

Release gate:
- TypeScript passes;
- full regression suite passes;
- Next.js production build passes;
- Vercel candidate is READY;
- GitHub PostgreSQL acceptance workflow passes before merge;
- production deployment is verified after squash merge.
