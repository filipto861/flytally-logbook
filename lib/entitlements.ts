import { getCommercialReadiness, type FlyTallyLaunchStage } from "./commercial-readiness.ts";

export const FLYTALLY_ENTITLEMENT_VERSION = 1 as const;

export type FlyTallyEntitlementKey = "logbook.access" | "training.access";
export type FlyTallyEntitlementSource = "private-beta" | "admin" | "billing" | "organization" | "manual";

export type FlyTallyEntitlementGrant = Readonly<{
  key: FlyTallyEntitlementKey;
  source: FlyTallyEntitlementSource;
  validUntil: number | null;
}>;

export type AccountEntitlementSnapshot = Readonly<{
  version: typeof FLYTALLY_ENTITLEMENT_VERSION;
  subject: string;
  stage: FlyTallyLaunchStage;
  issuedAt: number;
  grants: readonly FlyTallyEntitlementGrant[];
}>;

type Env = Readonly<Record<string, string | undefined>>;

const BASE_ACCESS: readonly FlyTallyEntitlementKey[] = ["logbook.access", "training.access"];

export function entitlementPolicyForStage(
  stage: FlyTallyLaunchStage,
  role: "admin" | "user",
): readonly FlyTallyEntitlementGrant[] {
  const source: FlyTallyEntitlementSource | null =
    role === "admin" ? "admin" : stage === "commercial" ? null : "private-beta";
  return source
    ? BASE_ACCESS.map((key) => ({ key, source, validUntil: null } satisfies FlyTallyEntitlementGrant))
    : [];
}

export function resolveAccountEntitlementSnapshot(
  subject: string,
  role: "admin" | "user",
  env: Env = process.env,
  nowSeconds = Math.floor(Date.now() / 1000),
): AccountEntitlementSnapshot {
  if (!subject || subject.length > 128) throw new Error("Invalid FlyTally account subject.");

  const stage = getCommercialReadiness(env).effectiveStage;
  const grants = entitlementPolicyForStage(stage, role);

  return {
    version: FLYTALLY_ENTITLEMENT_VERSION,
    subject,
    stage,
    issuedAt: nowSeconds,
    grants,
  };
}

export function hasAccountEntitlement(
  snapshot: AccountEntitlementSnapshot,
  key: FlyTallyEntitlementKey,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return snapshot.grants.some((grant) =>
    grant.key === key && (grant.validUntil === null || grant.validUntil > nowSeconds));
}
