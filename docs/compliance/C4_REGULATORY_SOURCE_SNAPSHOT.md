# v2.9 C4 — Regulatory source snapshot

Snapshot date: 18 September 2026  
Purpose: engineering evidence for FlyTally signature terminology and external-validation gates. This document is not a legal opinion or an authority approval.

## EASA / EU Part-FCL

Current rule baseline:

- Commission Regulation (EU) No 1178/2011, FCL.050 requires a pilot to keep a reliable record of all flights in a form and manner established by the competent authority.
- EASA Easy Access Rules for Aircrew, revision November 2025, are the latest Aircrew Easy Access Rules located during the C4 review.
- AMC1 FCL.050 states that electronic records should be readily available to the competent authority, contain the relevant FCL.050 items, be certified by the pilot and use a format acceptable to the competent authority.
- AMC1 FCL.050 also requires countersignature/name evidence for SPIC/PICUS and certain other entries in the remarks column.

Official references:
- https://www.easa.europa.eu/en/document-library/easy-access-rules/easy-access-rules-aircrew-regulation-eu-no-11782011
- https://eur-lex.europa.eu/eli/reg/2011/1178/2026-04-30/eng

Engineering conclusion: implementing the FCL.050 data model is not the same as authority acceptance of FlyTally's electronic signature/evidence mechanism.

## Czech CAA / ÚCL

The published CAA-ZLP-163 guidance, section 1.11, states that non-CAT electronic logbooks may be kept in a form meeting AMC1 FCL.050. For licence/rating/certificate applications, its normal path describes printed pages signed by the holder, with dual/SPIC signed by the instructor and PICUS countersigned by the PIC. It also says another electronic form may be recognised after prior approval when the applicant demonstrates the required verified electronic signatures replacing handwritten signatures and a commonly readable file format.

The ÚCL application guide dated 26 February 2026 also explicitly allows an electronic flight logbook to be uploaded to the ÚCL cloud. That upload mechanism does not by itself establish acceptance of FlyTally's present signature assurance.

Official references:
- https://www.caa.cz/wp-content/uploads/2019/07/CAA-ZLP-163-Zpu%CC%8Asobilost-pilotu%CC%8A-letounu%CC%8A.pdf
- https://www.caa.gov.cz/wp-content/uploads/2026/02/Jak-pozadat-o-vydani._26.2.2026.pdf

Engineering conclusion: until ÚCL provides scope-specific confirmation/approval, FlyTally must not state that its current account attestations or in-person captures replace required handwritten/countersignature evidence for authority submissions.

## eIDAS signature terminology

Regulation (EU) No 910/2014 distinguishes ordinary electronic signatures, advanced electronic signatures and qualified electronic signatures. A QES requires an advanced electronic signature, a qualified electronic-signature creation device and a qualified certificate issued by a qualified trust service provider. Article 25 gives a QES the equivalent legal effect of a handwritten signature.

Official reference:
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014R0910

Engineering conclusion:
- FlyTally server HMAC is an integrity mechanism, not a signer's QES.
- FlyTally account attestation is not represented as advanced or qualified.
- An in-person handwritten drawing captured on a device is not represented as advanced or qualified.
- introducing QES later would require an explicit qualified trust-service / certificate / signing-device architecture, not renaming the current HMAC or signature pad.

## LAA ČR / ULL

No formal FlyTally-specific LAA ČR acceptance evidence was identified or obtained during C4. ULL/national recordkeeping must therefore remain a separate validation scope and must not inherit Part-FCL acceptance assumptions.

Engineering conclusion: LAA ČR status remains **scope confirmation pending** until written external evidence is obtained.

## Release evidence rule

C4 strategy version: `2026-09-18-c4-v1`.

Environment statuses are not evidence. The code constant `REGULATORY_EXTERNAL_EVIDENCE_VERSION` remains null until external decisions/confirmations are actually obtained and committed with their exact scope. Therefore C4 cannot accidentally clear the commercial release gate through environment configuration alone.
