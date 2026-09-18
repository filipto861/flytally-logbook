export const FLYTALLY_ENTITLEMENT_VERSION = 1 as const;

export type FlyTallyEntitlementKey = "logbook.access" | "training.access";
export type FlyTallyEntitlementSource = "private-beta" | "admin" | "billing" | "organization" | "manual";
export type FlyTallyEntitlementStage = "private-beta" | "external-validation" | "commercial";

export type FlyTallyEntitlementGrant = Readonly<{
  key: FlyTallyEntitlementKey;
  source: FlyTallyEntitlementSource;
  validUntil: number | null;
}>;

export type AccountEntitlementSnapshot = Readonly<{
  version: typeof FLYTALLY_ENTITLEMENT_VERSION;
  subject: string;
  stage: FlyTallyEntitlementStage;
  issuedAt: number;
  grants: readonly FlyTallyEntitlementGrant[];
}>;

const BASE_ACCESS: readonly FlyTallyEntitlementKey[] = ["logbook.access", "training.access"];

export function entitlementPolicyForStage(
  stage: FlyTallyEntitlementStage,
  role: "admin" | "user",
): readonly FlyTallyEntitlementGrant[] {
  const source: FlyTallyEntitlementSource | null =
    role === "admin" ? "admin" : stage === "commercial" ? null : "private-beta";
  return source
    ? BASE_ACCESS.map((key) => ({ key, source, validUntil: null } satisfies FlyTallyEntitlementGrant))
    : [];
}

export function mergeEntitlementGrants(
  ...sets: readonly (readonly FlyTallyEntitlementGrant[])[]
): readonly FlyTallyEntitlementGrant[] {
  const merged = new Map<FlyTallyEntitlementKey, FlyTallyEntitlementGrant>();
  for (const set of sets) {
    for (const grant of set) if (!merged.has(grant.key)) merged.set(grant.key, grant);
  }
  return [...merged.values()];
}

export function hasAccountEntitlement(
  snapshot: AccountEntitlementSnapshot,
  key: FlyTallyEntitlementKey,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return snapshot.grants.some((grant) =>
    grant.key === key && (grant.validUntil === null || grant.validUntil > nowSeconds));
}
