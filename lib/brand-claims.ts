export type ClaimStatus="ALLOWED"|"ALLOWED_WITH_SCOPE"|"EXTERNAL_EVIDENCE_REQUIRED";

export type PublicClaim=Readonly<{
  id:string;
  label:string;
  status:ClaimStatus;
  approvedWording:readonly string[];
  boundary:string;
}>;

export const BRAND_CLAIMS_POLICY_VERSION="2026-09-18-c5-v1";
export const BRAND_CLAIMS_EXTERNAL_EVIDENCE_VERSION:string|null=null;

export const flyTallyBrandStatus=Object.freeze({
  name:"FlyTally",
  registeredTrademarkClaimed:false,
  trademarkSymbolAllowed:false,
  registrationStatus:"UNVERIFIED" as const,
  note:"FlyTally is used as the product and service brand. No registered-trademark status or exclusive-rights claim is published without external evidence.",
});

export const publicClaimRegistry:readonly PublicClaim[]=[
  {
    id:"digital-pilot-logbook",
    label:"Product description",
    status:"ALLOWED",
    approvedWording:["Digital pilot logbook","Electronic pilot logbook"],
    boundary:"Describes the product category only; it does not imply authority approval or regulatory acceptance.",
  },
  {
    id:"source-backed-training",
    label:"Training source model",
    status:"ALLOWED_WITH_SCOPE",
    approvedWording:["Source-backed aircraft training","Source-backed training and reference aid"],
    boundary:"Use only where published content retains source provenance and governed applicability. It does not imply manufacturer or authority approval.",
  },
  {
    id:"fcl050-style",
    label:"FCL.050 record structure",
    status:"ALLOWED_WITH_SCOPE",
    approvedWording:["FCL.050-style logbook records","FCL.050-style record and export workflow"],
    boundary:"Describes engineering alignment with the record structure; do not shorten this to EASA-approved, certified, official or guaranteed-compliant.",
  },
  {
    id:"authority-approval",
    label:"Authority approval",
    status:"EXTERNAL_EVIDENCE_REQUIRED",
    approvedWording:[],
    boundary:"Claims that FlyTally is approved, certified, endorsed or officially accepted by EASA, ÚCL/Czech CAA, LAA ČR or another authority require exact external evidence and published scope.",
  },
  {
    id:"manufacturer-approval",
    label:"Manufacturer/operator approval",
    status:"EXTERNAL_EVIDENCE_REQUIRED",
    approvedWording:[],
    boundary:"A source document or content review does not establish that FlyTally is manufacturer- or operator-approved.",
  },
  {
    id:"electronic-signature-status",
    label:"Advanced / qualified e-signature",
    status:"EXTERNAL_EVIDENCE_REQUIRED",
    approvedWording:[],
    boundary:"Current FlyTally attestations and integrity evidence are not represented as AES or QES.",
  },
  {
    id:"registered-trademark",
    label:"Registered trademark",
    status:"EXTERNAL_EVIDENCE_REQUIRED",
    approvedWording:[],
    boundary:"Do not use the registered-trademark symbol or state that FlyTally is a registered trademark unless the registration and territorial scope are verified.",
  },
] as const;

const prohibitedPublicMarketingPatterns=[
  /\bFlyTally\b[^.\n]{0,80}\b(?:EASA|ÚCL|UCL|Czech CAA|LAA(?: ČR| CZ)?)\b[^.\n]{0,40}\b(?:approved|certified|endorsed|official|compliant)\b/i,
  /\bFlyTally\b[^.\n]{0,60}\b(?:approved|certified|endorsed|official|compliant)\b[^.\n]{0,60}\b(?:EASA|ÚCL|UCL|Czech CAA|LAA(?: ČR| CZ)?)\b/i,
  /\b(?:EASA|ÚCL|UCL|Czech CAA|LAA(?: ČR| CZ)?)\b[^.\n]{0,40}\b(?:approved|certified|endorsed|official|compliant)\b[^.\n]{0,80}\bFlyTally\b/i,
  /\b(?:EASA|ÚCL|UCL|Czech CAA|LAA(?: ČR| CZ)?)\b[^.\n]{0,80}\bFlyTally\b[^.\n]{0,40}\b(?:approved|certified|endorsed|official|compliant)\b/i,
  /\bofficial\b[^.\n]{0,40}\b(?:EASA|ÚCL|UCL|Czech CAA|LAA(?: ČR| CZ)?)\b[^.\n]{0,40}\blogbook\b/i,
  /\bFlyTally\b[^.\n]{0,80}\b(?:qualified electronic signature|QES|advanced electronic signature|AES)\b/i,
  /\bFlyTally\b[^.\n]{0,80}\b(?:registered trademark|registered trade mark)\b/i,
  /\bFlyTally®\b/i,
  /\bFlyTally\b[^.\n]{0,80}\b(?:fully|guaranteed) compliant\b/i,
] as const;

export function unsafePublicMarketingClaims(text:unknown):readonly string[]{
  const value=String(text??"");
  return prohibitedPublicMarketingPatterns
    .filter(pattern=>pattern.test(value))
    .map(pattern=>pattern.source);
}

type Env=Readonly<Record<string,string|undefined>>;

function normalized(value:string|undefined):string|null{
  const result=value?.trim();
  return result||null;
}

function decisionResolved(value:string|undefined):boolean{
  const result=value?.trim().toUpperCase();
  return result==="APPROVED"||result==="NOT_REQUIRED";
}

export type BrandClaimsReadiness=Readonly<{
  policyVersion:string;
  requestedVersion:string|null;
  externalEvidenceVersion:string|null;
  trademarkDecisionResolved:boolean;
  marketingClaimsDecisionResolved:boolean;
  registeredTrademarkClaimed:false;
  commercialReady:boolean;
  blockers:readonly string[];
}>;

export function getBrandClaimsReadiness(env:Env=process.env):BrandClaimsReadiness{
  const requestedVersion=normalized(env.COMMERCIAL_BRAND_CLAIMS_POLICY_VERSION);
  const trademarkDecisionResolved=decisionResolved(env.COMMERCIAL_TRADEMARK_STATUS);
  const marketingClaimsDecisionResolved=decisionResolved(env.COMMERCIAL_MARKETING_CLAIMS_STATUS);
  const blockers:string[]=[];

  if(requestedVersion!==BRAND_CLAIMS_POLICY_VERSION)blockers.push("brand-claims-policy-version");
  if(!trademarkDecisionResolved)blockers.push("trademark-strategy-decision");
  if(!marketingClaimsDecisionResolved)blockers.push("marketing-claims-decision");
  if(BRAND_CLAIMS_EXTERNAL_EVIDENCE_VERSION!==BRAND_CLAIMS_POLICY_VERSION)blockers.push("brand-claims-external-evidence");

  return{
    policyVersion:BRAND_CLAIMS_POLICY_VERSION,
    requestedVersion,
    externalEvidenceVersion:BRAND_CLAIMS_EXTERNAL_EVIDENCE_VERSION,
    trademarkDecisionResolved,
    marketingClaimsDecisionResolved,
    registeredTrademarkClaimed:false,
    commercialReady:blockers.length===0,
    blockers,
  };
}
