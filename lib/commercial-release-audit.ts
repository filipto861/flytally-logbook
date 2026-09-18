import { commercialBillingRuntime } from "./billing-readiness.ts";
import { getBrandClaimsReadiness } from "./brand-claims.ts";
import { getCommercialLegalPublicationState } from "./commercial-legal.ts";
import { getCommercialReadiness } from "./commercial-readiness.ts";
import { getCommercialReleaseControl } from "./commercial-release-control.ts";
import { getRegulatoryReadiness } from "./regulatory-validation.ts";

type Env=Readonly<Record<string,string|undefined>>;

export type CommercialReleaseAuditSection=Readonly<{
  id:"c1"|"c2"|"c3"|"c4"|"c5"|"c6";
  label:string;
  foundation:"IMPLEMENTED";
  releaseReady:boolean;
  blockers:readonly string[];
}>;

export type CommercialReleaseAudit=Readonly<{
  auditVersion:string;
  verdict:"CLEARED"|"READY_FOR_TRANSITION"|"BLOCKED";
  effectiveStage:"private-beta"|"external-validation"|"commercial";
  technicalFoundationComplete:true;
  releaseGatesReady:boolean;
  commercialLaunchEnabled:boolean;
  sections:readonly CommercialReleaseAuditSection[];
  blockers:readonly string[];
}>;

export function deriveCommercialReleaseVerdict(commercialEnabled:boolean,releaseGatesReady:boolean):CommercialReleaseAudit["verdict"]{
  return commercialEnabled?"CLEARED":releaseGatesReady?"READY_FOR_TRANSITION":"BLOCKED";
}

export function getCommercialReleaseAudit(env:Env=process.env):CommercialReleaseAudit{
  const readiness=getCommercialReadiness(env);
  const legal=getCommercialLegalPublicationState(env);
  const regulatory=getRegulatoryReadiness(env);
  const brandClaims=getBrandClaimsReadiness(env);
  const releaseControl=getCommercialReleaseControl(env);
  const externalBlockers=readiness.gates.filter(gate=>!gate.cleared).map(gate=>gate.id);

  const billingBlockers=[
    ...(!commercialBillingRuntime.providerSelected?["billing-provider"]:[]),
    ...(!commercialBillingRuntime.checkoutImplemented?["billing-checkout"]:[]),
    ...(!commercialBillingRuntime.lifecycleSyncImplemented?["billing-lifecycle-sync"]:[]),
    ...(!commercialBillingRuntime.customerSelfServiceImplemented?["billing-customer-self-service"]:[]),
  ];

  const sections:CommercialReleaseAuditSection[]=[
    {
      id:"c1",
      label:"Commercial launch contract & external validation ledger",
      foundation:"IMPLEMENTED",
      releaseReady:readiness.externalValidationComplete,
      blockers:externalBlockers,
    },
    {
      id:"c2",
      label:"Commercial legal & consumer publication",
      foundation:"IMPLEMENTED",
      releaseReady:legal.publicationReady,
      blockers:legal.blockers,
    },
    {
      id:"c3",
      label:"Billing & entitlement runtime",
      foundation:"IMPLEMENTED",
      releaseReady:commercialBillingRuntime.commercialReady,
      blockers:billingBlockers,
    },
    {
      id:"c4",
      label:"Signature & regulatory validation",
      foundation:"IMPLEMENTED",
      releaseReady:regulatory.commercialReady,
      blockers:regulatory.blockers,
    },
    {
      id:"c5",
      label:"Brand & public claims",
      foundation:"IMPLEMENTED",
      releaseReady:brandClaims.commercialReady,
      blockers:brandClaims.blockers,
    },
    {
      id:"c6",
      label:"Final commercial release audit",
      foundation:"IMPLEMENTED",
      releaseReady:releaseControl.commercialReady,
      blockers:releaseControl.blockers,
    },
  ];

  const releaseGatesReady=readiness.configurationValid&&sections.every(section=>section.releaseReady);

  return{
    auditVersion:releaseControl.auditVersion,
    verdict:deriveCommercialReleaseVerdict(readiness.commercialEnabled,releaseGatesReady),
    effectiveStage:readiness.effectiveStage,
    technicalFoundationComplete:true,
    releaseGatesReady,
    commercialLaunchEnabled:readiness.commercialEnabled,
    sections,
    blockers:readiness.blockers,
  };
}
