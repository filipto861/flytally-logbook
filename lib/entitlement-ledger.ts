import "server-only";

import { getCommercialReadiness } from "@/lib/commercial-readiness";
import { sql } from "@/lib/db";
import {
  FLYTALLY_ENTITLEMENT_VERSION,
  entitlementPolicyForStage,
  mergeEntitlementGrants,
  type AccountEntitlementSnapshot,
  type FlyTallyEntitlementGrant,
  type FlyTallyEntitlementKey,
  type FlyTallyEntitlementSource,
} from "@/lib/entitlements";
import { ensureV290Schema } from "@/lib/v290-schema";

const DURABLE_SOURCES = new Set<FlyTallyEntitlementSource>(["billing","organization","manual"]);
const KNOWN_KEYS = new Set<FlyTallyEntitlementKey>(["logbook.access","training.access"]);

type Env = Readonly<Record<string,string|undefined>>;
type LedgerRow={entitlement_key:string;source:string;valid_until:number|string|null};

export async function loadDurableEntitlements(
  userId:number,
  nowSeconds=Math.floor(Date.now()/1000),
):Promise<readonly FlyTallyEntitlementGrant[]>{
  await ensureV290Schema();
  const rows=await sql`
    SELECT entitlement_key,source,EXTRACT(EPOCH FROM valid_until)::bigint valid_until
    FROM account_entitlements
    WHERE user_id=${userId}
      AND revoked_at IS NULL
      AND valid_from<=to_timestamp(${nowSeconds})
      AND (valid_until IS NULL OR valid_until>to_timestamp(${nowSeconds}))
    ORDER BY entitlement_key,valid_until DESC NULLS FIRST,created_at DESC,id DESC
  ` as LedgerRow[];

  const grants:FlyTallyEntitlementGrant[]=[];
  const seen=new Set<string>();
  for(const row of rows){
    if(!KNOWN_KEYS.has(row.entitlement_key as FlyTallyEntitlementKey))continue;
    if(!DURABLE_SOURCES.has(row.source as FlyTallyEntitlementSource))continue;
    if(seen.has(row.entitlement_key))continue;
    seen.add(row.entitlement_key);
    grants.push({
      key:row.entitlement_key as FlyTallyEntitlementKey,
      source:row.source as FlyTallyEntitlementSource,
      validUntil:row.valid_until===null?null:Number(row.valid_until),
    });
  }
  return grants;
}

export async function resolveAccountEntitlementSnapshot(
  userId:number,
  role:"admin"|"user",
  env:Env=process.env,
  nowSeconds=Math.floor(Date.now()/1000),
):Promise<AccountEntitlementSnapshot>{
  const readiness=getCommercialReadiness(env);
  const policy=entitlementPolicyForStage(readiness.effectiveStage,role);
  const durable=await loadDurableEntitlements(userId,nowSeconds);
  return{
    version:FLYTALLY_ENTITLEMENT_VERSION,
    subject:String(userId),
    stage:readiness.effectiveStage,
    issuedAt:nowSeconds,
    grants:mergeEntitlementGrants(policy,durable),
  };
}

export async function upsertDurableEntitlement(input:{
  userId:number;
  key:FlyTallyEntitlementKey;
  source:Extract<FlyTallyEntitlementSource,"billing"|"organization"|"manual">;
  externalReference:string;
  validFrom?:Date;
  validUntil?:Date|null;
}):Promise<void>{
  await ensureV290Schema();
  const externalReference=input.externalReference.trim();
  if(!externalReference||externalReference.length>200)throw new Error("A durable entitlement requires a stable external reference.");
  const validFrom=input.validFrom??new Date();
  const validUntil=input.validUntil??null;
  await sql`
    INSERT INTO account_entitlements(user_id,entitlement_key,source,external_reference,valid_from,valid_until,created_at,updated_at)
    VALUES(${input.userId},${input.key},${input.source},${externalReference},${validFrom.toISOString()},${validUntil?.toISOString()??null},NOW(),NOW())
    ON CONFLICT(user_id,source,entitlement_key,external_reference)
    DO UPDATE SET valid_from=EXCLUDED.valid_from,valid_until=EXCLUDED.valid_until,revoked_at=NULL,updated_at=NOW()
  `;
}

export async function revokeDurableEntitlement(input:{
  userId:number;
  key:FlyTallyEntitlementKey;
  source:Extract<FlyTallyEntitlementSource,"billing"|"organization"|"manual">;
  externalReference:string;
}):Promise<void>{
  await ensureV290Schema();
  await sql`
    UPDATE account_entitlements SET revoked_at=COALESCE(revoked_at,NOW()),updated_at=NOW()
    WHERE user_id=${input.userId}
      AND entitlement_key=${input.key}
      AND source=${input.source}
      AND external_reference=${input.externalReference.trim()}
  `;
}
