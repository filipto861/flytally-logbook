import "server-only";
import { createHmac,timingSafeEqual } from "node:crypto";
import * as oidc from "openid-client";

export const GOOGLE_FLOW_COOKIE="flytally_google_flow";
export type GoogleFlow={state:string;nonce:string;verifier:string;intent:"login"|"link";userId?:number;invite?:string;returnTo?:string;exp:number};

function clientId(){const value=process.env.GOOGLE_CLIENT_ID?.trim();if(!value)throw new Error("GOOGLE_CLIENT_ID is not configured.");return value;}
function clientSecret(){const value=process.env.GOOGLE_CLIENT_SECRET?.trim();if(!value)throw new Error("GOOGLE_CLIENT_SECRET is not configured.");return value;}
function signingSecret(){const value=process.env.SESSION_SECRET?.trim();if(!value||value.length<32)throw new Error("SESSION_SECRET must contain at least 32 characters.");return value;}
function signature(payload:string){return createHmac("sha256",signingSecret()).update(payload).digest("base64url");}

export function googleConfigured(){return Boolean(process.env.GOOGLE_CLIENT_ID?.trim()&&process.env.GOOGLE_CLIENT_SECRET?.trim());}
let configuration:Promise<oidc.Configuration>|undefined;
export async function googleConfiguration(){configuration??=oidc.discovery(new URL("https://accounts.google.com"),clientId(),clientSecret()).catch(error=>{configuration=undefined;throw error;});return configuration;}
export function encodeGoogleFlow(value:GoogleFlow){const payload=Buffer.from(JSON.stringify(value)).toString("base64url");return`${payload}.${signature(payload)}`;}
export function decodeGoogleFlow(raw:string|undefined){
  try{if(!raw)return null;const[payload,sig]=raw.split(".",2),expected=Buffer.from(signature(payload)),actual=Buffer.from(sig||"");if(!payload||expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;const parsed=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as GoogleFlow;if(parsed.exp<Date.now()||!parsed.state||!parsed.nonce||!parsed.verifier)return null;return parsed;}catch{return null;}
}
export async function googleAuthorizationUrl(origin:string,flow:GoogleFlow){
  const config=await googleConfiguration(),challenge=await oidc.calculatePKCECodeChallenge(flow.verifier);
  return oidc.buildAuthorizationUrl(config,{redirect_uri:`${origin}/api/auth/google/callback`,scope:"openid email profile",response_type:"code",state:flow.state,nonce:flow.nonce,code_challenge:challenge,code_challenge_method:"S256",prompt:"select_account"});
}
export const googleOidc=oidc;
