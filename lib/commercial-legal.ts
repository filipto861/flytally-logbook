export type CommercialLegalArtifactKey =
  | "terms"
  | "pricing-billing"
  | "cancellation-refunds"
  | "withdrawal"
  | "adr";

export type CommercialLegalArtifact = Readonly<{
  key: CommercialLegalArtifactKey;
  title: string;
  purpose: string;
  requiredForCommercialLaunch: true;
}>;

export type CommercialLegalPublicationState = Readonly<{
  candidateVersion: string | null;
  reviewedVersion: string | null;
  publishedVersion: string | null;
  implementedContentVersion: string | null;
  versionChainComplete: boolean;
  publicationReady: boolean;
  blockers: readonly string[];
  artifacts: readonly CommercialLegalArtifact[];
}>;

type Env = Readonly<Record<string, string | undefined>>;

export const commercialLegalArtifacts: readonly CommercialLegalArtifact[] = [
  {
    key: "terms",
    title: "Commercial Terms",
    purpose: "Contract terms governing a paid/public FlyTally service.",
    requiredForCommercialLaunch: true,
  },
  {
    key: "pricing-billing",
    title: "Pricing & billing disclosure",
    purpose: "Final price, billing period, renewal and payment information presented before purchase.",
    requiredForCommercialLaunch: true,
  },
  {
    key: "cancellation-refunds",
    title: "Cancellation & refunds",
    purpose: "Reviewed cancellation, refund and termination rules for the chosen commercial model.",
    requiredForCommercialLaunch: true,
  },
  {
    key: "withdrawal",
    title: "Withdrawal rights",
    purpose: "Jurisdiction-reviewed consumer withdrawal information where applicable.",
    requiredForCommercialLaunch: true,
  },
  {
    key: "adr",
    title: "Dispute resolution / ADR",
    purpose: "Reviewed dispute-resolution and ADR information required for the chosen market.",
    requiredForCommercialLaunch: true,
  },
] as const;

// C2 introduces the versioned publication architecture, but intentionally does
// not ship lawyer-reviewed commercial text. A later PR must set this constant to
// the exact reviewed content version that is committed in the repository.
export const COMMERCIAL_LEGAL_IMPLEMENTED_CONTENT_VERSION: string | null = null;

function normalizeVersion(value: string | undefined): string | null {
  const normalized=value?.trim();
  return normalized ? normalized : null;
}

export function getCommercialLegalPublicationState(env: Env = process.env): CommercialLegalPublicationState {
  const candidateVersion=normalizeVersion(env.COMMERCIAL_LEGAL_BUNDLE_VERSION);
  const reviewedVersion=normalizeVersion(env.COMMERCIAL_LEGAL_REVIEWED_VERSION);
  const publishedVersion=normalizeVersion(env.COMMERCIAL_LEGAL_PUBLISHED_VERSION);
  const implementedContentVersion=COMMERCIAL_LEGAL_IMPLEMENTED_CONTENT_VERSION;

  const blockers:string[]=[];
  if(!candidateVersion) blockers.push("commercial-legal-version");
  if(!implementedContentVersion) blockers.push("commercial-legal-content");
  if(candidateVersion && implementedContentVersion && candidateVersion!==implementedContentVersion) blockers.push("commercial-legal-content-version-mismatch");
  if(!reviewedVersion) blockers.push("commercial-legal-review-version");
  if(candidateVersion && reviewedVersion && candidateVersion!==reviewedVersion) blockers.push("commercial-legal-review-version-mismatch");
  if(!publishedVersion) blockers.push("commercial-legal-published-version");
  if(candidateVersion && publishedVersion && candidateVersion!==publishedVersion) blockers.push("commercial-legal-published-version-mismatch");

  const versionChainComplete=Boolean(
    candidateVersion
    && implementedContentVersion
    && reviewedVersion
    && publishedVersion
    && candidateVersion===implementedContentVersion
    && candidateVersion===reviewedVersion
    && candidateVersion===publishedVersion
  );

  return {
    candidateVersion,
    reviewedVersion,
    publishedVersion,
    implementedContentVersion,
    versionChainComplete,
    publicationReady: versionChainComplete && blockers.length===0,
    blockers,
    artifacts: commercialLegalArtifacts,
  };
}
