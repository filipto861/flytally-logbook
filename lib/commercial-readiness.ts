export type FlyTallyLaunchStage = "private-beta" | "external-validation" | "commercial";
export type ExternalValidationStatus = "PENDING" | "APPROVED" | "NOT_REQUIRED";

type Env = Readonly<Record<string, string | undefined>>;

export type CommercialReadinessGate = Readonly<{
  id: string;
  label: string;
  status: ExternalValidationStatus;
  cleared: boolean;
  requirement: "approval-required" | "decision-required";
}>;

export type CommercialReadiness = Readonly<{
  requestedStage: FlyTallyLaunchStage;
  effectiveStage: FlyTallyLaunchStage;
  externalValidationComplete: boolean;
  commercialEnabled: boolean;
  operatorIdentityComplete: boolean;
  configurationValid: boolean;
  gates: readonly CommercialReadinessGate[];
  blockers: readonly string[];
}>;

// C1 deliberately keeps public commercial mode impossible until C2 replaces the
// private-beta legal surface with externally reviewed commercial terms.
const COMMERCIAL_LEGAL_SURFACE_IMPLEMENTED = false;

const mandatoryApprovalGates = [
  ["legal-review", "Jurisdiction-appropriate lawyer review", "COMMERCIAL_LEGAL_REVIEW_STATUS"],
  ["consumer-law-adr", "Consumer law, cancellation/refund and ADR review", "COMMERCIAL_CONSUMER_LAW_ADR_STATUS"],
  ["privacy-processors", "Privacy, processor/DPA and international-transfer review", "COMMERCIAL_PRIVACY_PROCESSOR_STATUS"],
  ["training-source-rights", "Training source/publication rights review", "COMMERCIAL_TRAINING_SOURCE_RIGHTS_STATUS"],
  ["support-operations", "DSAR, incident, security and content-report operations", "COMMERCIAL_SUPPORT_OPERATIONS_STATUS"],
  ["commercial-policies", "Commercial policies approved", "COMMERCIAL_POLICIES_STATUS"],
  ["commercial-terms", "Commercial terms published", "COMMERCIAL_TERMS_PUBLISHED_STATUS"],
] as const;

const decisionGates = [
  ["billing", "Billing/subscription model decision", "COMMERCIAL_BILLING_STATUS"],
  ["qes", "Electronic-signature/QES strategy decision", "COMMERCIAL_QES_STATUS"],
  ["aviation-validation", "ÚCL/LAA/regulatory validation strategy decision", "COMMERCIAL_AVIATION_VALIDATION_STATUS"],
  ["trademark", "Trademark/brand protection decision", "COMMERCIAL_TRADEMARK_STATUS"],
  ["marketing-claims", "Marketing and regulatory claims review", "COMMERCIAL_MARKETING_CLAIMS_STATUS"],
] as const;

function readStatus(value: string | undefined): ExternalValidationStatus {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "APPROVED" || normalized === "NOT_REQUIRED") return normalized;
  return "PENDING";
}

function readRequestedStage(value: string | undefined): {
  stage: FlyTallyLaunchStage;
  valid: boolean;
} {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "private-beta") return { stage: "private-beta", valid: true };
  if (normalized === "external-validation") return { stage: "external-validation", valid: true };
  if (normalized === "commercial") return { stage: "commercial", valid: true };
  return { stage: "private-beta", valid: false };
}

function hasOperatorIdentity(env: Env): boolean {
  const values = [
    env.LEGAL_OPERATOR_NAME,
    env.LEGAL_OPERATOR_ADDRESS,
    env.LEGAL_OPERATOR_ID,
    env.LEGAL_CONTACT_EMAIL,
  ].map((value) => value?.trim() || "");

  return values.every(Boolean)
    && values[3].includes("@")
    && !values.some((value) => /private beta|pending|not yet published/i.test(value));
}

export function getCommercialReadiness(env: Env = process.env): CommercialReadiness {
  const requested = readRequestedStage(env.FLYTALLY_LAUNCH_STAGE);
  const operatorIdentityComplete = hasOperatorIdentity(env);

  const gates: CommercialReadinessGate[] = [
    {
      id: "operator-identity",
      label: "Formal operator/controller identity",
      status: operatorIdentityComplete ? "APPROVED" : "PENDING",
      cleared: operatorIdentityComplete,
      requirement: "approval-required",
    },
    ...mandatoryApprovalGates.map(([id, label, key]) => {
      const status = readStatus(env[key]);
      return {
        id,
        label,
        status,
        cleared: status === "APPROVED",
        requirement: "approval-required" as const,
      };
    }),
    ...decisionGates.map(([id, label, key]) => {
      const status = readStatus(env[key]);
      return {
        id,
        label,
        status,
        cleared: status === "APPROVED" || status === "NOT_REQUIRED",
        requirement: "decision-required" as const,
      };
    }),
  ];

  const externalBlockers = gates.filter((gate) => !gate.cleared).map((gate) => gate.id);
  const externalValidationComplete = externalBlockers.length === 0;
  const blockers = [...externalBlockers];

  if (!COMMERCIAL_LEGAL_SURFACE_IMPLEMENTED) blockers.push("commercial-legal-surface");
  if (!requested.valid) blockers.unshift("launch-stage-configuration");

  const commercialEnabled = requested.valid
    && requested.stage === "commercial"
    && blockers.length === 0;

  const effectiveStage: FlyTallyLaunchStage = commercialEnabled
    ? "commercial"
    : requested.stage === "private-beta"
      ? "private-beta"
      : "external-validation";

  return {
    requestedStage: requested.stage,
    effectiveStage,
    externalValidationComplete,
    commercialEnabled,
    operatorIdentityComplete,
    configurationValid: requested.valid,
    gates,
    blockers,
  };
}

export function assertCommercialLaunchEnabled(env: Env = process.env): void {
  const readiness = getCommercialReadiness(env);
  if (!readiness.commercialEnabled) {
    throw new Error(`Commercial FlyTally capabilities are disabled; unresolved launch gates: ${readiness.blockers.join(", ") || "launch stage not set to commercial"}.`);
  }
}
