export type SignatureAssuranceKind =
  | "flytally-account-attestation"
  | "in-person-handwritten-capture"
  | "server-integrity-binding";

export type SignatureAssurance = Readonly<{
  kind: SignatureAssuranceKind;
  label: string;
  identityAssurance: string;
  integrityBinding: string;
  qes: false;
  advancedElectronicSignatureClaimed: false;
}>;

export const REGULATORY_STRATEGY_VERSION = "2026-09-18-c4-v1";
export const REGULATORY_EXTERNAL_EVIDENCE_VERSION: string | null = null;

export const signatureAssuranceCatalog: readonly SignatureAssurance[] = [
  {
    kind: "flytally-account-attestation",
    label: "FlyTally account attestation",
    identityAssurance: "Signer acted through an authenticated FlyTally account; recorded licence/qualification data may still require independent authority verification.",
    integrityBinding: "The attestation is bound to the exact stored record/revision and protected by FlyTally server HMAC evidence.",
    qes: false,
    advancedElectronicSignatureClaimed: false,
  },
  {
    kind: "in-person-handwritten-capture",
    label: "In-person handwritten capture",
    identityAssurance: "Signer identity and credential details are entered in person and are not independently authenticated by FlyTally.",
    integrityBinding: "The captured drawing is stored with the credential snapshot and bound to the exact record/revision by FlyTally server HMAC evidence.",
    qes: false,
    advancedElectronicSignatureClaimed: false,
  },
  {
    kind: "server-integrity-binding",
    label: "FlyTally server integrity binding",
    identityAssurance: "This is a platform integrity mechanism, not a signer identity or electronic-signature credential.",
    integrityBinding: "HMAC-SHA-256 detects modification of the exact verification payload stored by FlyTally.",
    qes: false,
    advancedElectronicSignatureClaimed: false,
  },
] as const;

export type RegulatoryAuthorityStatus = Readonly<{
  id: "easa-part-fcl" | "czech-caa" | "laa-cz";
  label: string;
  status: "REFERENCE_BASELINE" | "EXTERNAL_VALIDATION_PENDING" | "SCOPE_CONFIRMATION_PENDING";
  approvalClaimed: false;
  note: string;
}>;

export const regulatoryAuthorityStatuses: readonly RegulatoryAuthorityStatus[] = [
  {
    id: "easa-part-fcl",
    label: "EASA Part-FCL / FCL.050",
    status: "REFERENCE_BASELINE",
    approvalClaimed: false,
    note: "FlyTally implements FCL.050-style record and evidence features, but EASA does not thereby approve FlyTally or any individual record. Electronic-record acceptability remains subject to the competent authority.",
  },
  {
    id: "czech-caa",
    label: "Czech CAA / ÚCL",
    status: "EXTERNAL_VALIDATION_PENDING",
    approvalClaimed: false,
    note: "FlyTally has no recorded ÚCL approval for replacing required handwritten/countersignature evidence with the current electronic attestation model.",
  },
  {
    id: "laa-cz",
    label: "LAA ČR / ULL",
    status: "SCOPE_CONFIRMATION_PENDING",
    approvalClaimed: false,
    note: "The exact LAA ČR acceptance scope for FlyTally electronic logbook/signature evidence has not been formally validated and must remain separate from Part-FCL assumptions.",
  },
] as const;

type Env = Readonly<Record<string,string|undefined>>;

export type RegulatoryReadiness = Readonly<{
  strategyVersion: string;
  requestedVersion: string | null;
  externalEvidenceVersion: string | null;
  qesImplemented: false;
  qesDecisionResolved: boolean;
  aviationValidationDecisionResolved: boolean;
  commercialReady: boolean;
  blockers: readonly string[];
}>;

function normalized(value:string|undefined):string|null{
  const v=value?.trim();
  return v||null;
}

function decisionResolved(value:string|undefined):boolean{
  const v=value?.trim().toUpperCase();
  return v==="APPROVED"||v==="NOT_REQUIRED";
}

export function getRegulatoryReadiness(env:Env=process.env):RegulatoryReadiness{
  const requestedVersion=normalized(env.COMMERCIAL_REGULATORY_STRATEGY_VERSION);
  const qesDecisionResolved=decisionResolved(env.COMMERCIAL_QES_STATUS);
  const aviationValidationDecisionResolved=decisionResolved(env.COMMERCIAL_AVIATION_VALIDATION_STATUS);
  const blockers:string[]=[];

  if(requestedVersion!==REGULATORY_STRATEGY_VERSION)blockers.push("regulatory-strategy-version");
  if(!qesDecisionResolved)blockers.push("qes-strategy-decision");
  if(!aviationValidationDecisionResolved)blockers.push("aviation-validation-decision");
  if(REGULATORY_EXTERNAL_EVIDENCE_VERSION!==REGULATORY_STRATEGY_VERSION)blockers.push("regulatory-external-evidence");

  return{
    strategyVersion:REGULATORY_STRATEGY_VERSION,
    requestedVersion,
    externalEvidenceVersion:REGULATORY_EXTERNAL_EVIDENCE_VERSION,
    qesImplemented:false,
    qesDecisionResolved,
    aviationValidationDecisionResolved,
    commercialReady:blockers.length===0,
    blockers,
  };
}

export function signatureAssuranceForSource(source:unknown,signerUserId:unknown):SignatureAssurance{
  const value=String(source??"").trim().toLowerCase();
  if(value.includes("in-person handwritten"))return signatureAssuranceCatalog[1];
  if(signerUserId!==null&&signerUserId!==undefined&&String(signerUserId).trim()!=="")return signatureAssuranceCatalog[0];
  return signatureAssuranceCatalog[2];
}
