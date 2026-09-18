import "server-only";
import { createECDH,createHmac,createPrivateKey,sign } from "node:crypto";
import { sql } from "@/lib/db";
import { ensurePushSchema } from "@/lib/push-schema";

export type PushCategory="compliance"|"activity"|"security";
export type PushPreferences={enabled:boolean;compliance:boolean;activity:boolean;security:boolean};

const PUSH_HOST_SUFFIXES=["googleapis.com","push.services.mozilla.com","push.apple.com","notify.windows.com"];
const b64=(value:Buffer|string)=>Buffer.isBuffer(value)?value.toString("base64url"):Buffer.from(value).toString("base64url");
const bool=(value:unknown,fallback=true)=>value===null||value===undefined?fallback:Boolean(value);

function sessionSecret(){const value=process.env.SESSION_SECRET?.trim();if(!value||value.length<32)throw new Error("SESSION_SECRET must contain at least 32 characters.");return value}
function derivedPrivateKey(){
  const ecdh=createECDH("prime256v1");
  for(let counter=0;counter<64;counter+=1){
    const candidate=createHmac("sha256",sessionSecret()).update(`flytally:web-push:v1:${counter}`).digest();
    try{ecdh.setPrivateKey(candidate);return{privateKey:candidate,publicKey:ecdh.getPublicKey()}}catch{}
  }
  throw new Error("Unable to derive FlyTally Web Push key.");
}
export function pushPublicKey(){return derivedPrivateKey().publicKey.toString("base64url")}

function endpointAllowed(endpoint:string){
  try{
    const url=new URL(endpoint);
    if(url.protocol!=="https:")return false;
    const host=url.hostname.toLowerCase();
    return PUSH_HOST_SUFFIXES.some(suffix=>host===suffix||host.endsWith(`.${suffix}`));
  }catch{return false}
}

function vapidAuthorization(endpoint:string){
  const{privateKey,publicKey}=derivedPrivateKey();
  if(publicKey.length!==65||publicKey[0]!==4)throw new Error("Invalid VAPID public key.");
  const x=publicKey.subarray(1,33).toString("base64url"),y=publicKey.subarray(33,65).toString("base64url"),d=privateKey.toString("base64url");
  const key=createPrivateKey({key:{kty:"EC",crv:"P-256",x,y,d},format:"jwk"});
  const header=b64(JSON.stringify({typ:"JWT",alg:"ES256"})),payload=b64(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+12*60*60,sub:"https://fly-tally.com"}));
  const unsigned=`${header}.${payload}`,signature=sign("sha256",Buffer.from(unsigned),{key,dsaEncoding:"ieee-p1363"}).toString("base64url");
  return`vapid t=${unsigned}.${signature}, k=${publicKey.toString("base64url")}`;
}

export function pushCategoryForKind(kind:unknown):PushCategory{
  const value=String(kind??"").trim().toLowerCase();
  if(value==="recency_warning"||value.startsWith("credential_")||value.includes("expiry"))return"compliance";
  if(value.startsWith("security_")||value.startsWith("auth_"))return"security";
  return"activity";
}

export async function getPushPreferences(userId:number):Promise<PushPreferences>{
  await ensurePushSchema();
  const rows=await sql`SELECT enabled,compliance,activity,security FROM push_preferences WHERE user_id=${userId} LIMIT 1` as Array<Record<string,unknown>>;
  const row=rows[0]??{};
  return{enabled:bool(row.enabled),compliance:bool(row.compliance),activity:bool(row.activity),security:bool(row.security)};
}

export async function savePushPreferences(userId:number,input:PushPreferences){
  await ensurePushSchema();
  await sql`INSERT INTO push_preferences(user_id,enabled,compliance,activity,security,updated_at) VALUES(${userId},${input.enabled},${input.compliance},${input.activity},${input.security},NOW()) ON CONFLICT(user_id) DO UPDATE SET enabled=EXCLUDED.enabled,compliance=EXCLUDED.compliance,activity=EXCLUDED.activity,security=EXCLUDED.security,updated_at=NOW()`;
}

export async function savePushSubscription(input:{userId:number;sessionId:string;endpoint:string;p256dh?:string;auth?:string;userAgent?:string}){
  await ensurePushSchema();
  if(!endpointAllowed(input.endpoint))throw new Error("Unsupported push service endpoint.");
  await sql`INSERT INTO push_subscriptions(user_id,session_id,endpoint,p256dh,auth,user_agent,updated_at) VALUES(${input.userId},${input.sessionId},${input.endpoint.slice(0,2000)},${String(input.p256dh??"").slice(0,500)},${String(input.auth??"").slice(0,500)},${String(input.userAgent??"").slice(0,500)},NOW()) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,session_id=EXCLUDED.session_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,user_agent=EXCLUDED.user_agent,updated_at=NOW(),failure_count=0`;
}

export async function removePushSubscription(userId:number,endpoint:string){
  await ensurePushSchema();
  await sql`DELETE FROM push_subscriptions WHERE user_id=${userId} AND endpoint=${endpoint.slice(0,2000)}`;
}

export async function pushDeviceCount(userId:number){
  await ensurePushSchema();
  const rows=await sql`SELECT COUNT(*)::int count FROM push_subscriptions p JOIN auth_sessions s ON s.id=p.session_id WHERE p.user_id=${userId} AND s.revoked_at IS NULL AND s.expires_at>NOW()` as Array<{count:number|string}>;
  return Number(rows[0]?.count)||0;
}

export async function deliverPushNotification(userId:number,kind:string){
  try{
    await ensurePushSchema();
    const category=pushCategoryForKind(kind),preferences=await getPushPreferences(userId);
    if(!preferences.enabled||!preferences[category])return;
    const rows=await sql`SELECT p.id,p.endpoint FROM push_subscriptions p JOIN auth_sessions s ON s.id=p.session_id WHERE p.user_id=${userId} AND s.user_id=p.user_id AND s.revoked_at IS NULL AND s.expires_at>NOW() ORDER BY p.updated_at DESC LIMIT 20` as Array<{id:number|string;endpoint:string}>;
    await Promise.allSettled(rows.map(async row=>{
      if(!endpointAllowed(row.endpoint)){await sql`DELETE FROM push_subscriptions WHERE id=${Number(row.id)} AND user_id=${userId}`;return}
      try{
        const response=await fetch(row.endpoint,{method:"POST",headers:{Authorization:vapidAuthorization(row.endpoint),TTL:"86400",Urgency:category==="security"?"high":category==="compliance"?"normal":"low"}});
        if(response.status===404||response.status===410){await sql`DELETE FROM push_subscriptions WHERE id=${Number(row.id)} AND user_id=${userId}`;return}
        if(response.ok){await sql`UPDATE push_subscriptions SET last_success_at=NOW(),failure_count=0 WHERE id=${Number(row.id)} AND user_id=${userId}`;return}
        await sql`UPDATE push_subscriptions SET failure_count=LEAST(failure_count+1,100),updated_at=NOW() WHERE id=${Number(row.id)} AND user_id=${userId}`;
      }catch{
        await sql`UPDATE push_subscriptions SET failure_count=LEAST(failure_count+1,100),updated_at=NOW() WHERE id=${Number(row.id)} AND user_id=${userId}`;
      }
    }));
  }catch(error){console.error("push-delivery-failed",userId,kind,error)}
}
