import { NextRequest,NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { encodeGoogleFlow,googleAuthorizationUrl,googleConfigured,googleOidc,GOOGLE_FLOW_COOKIE,type GoogleFlow } from "@/lib/auth/google";
import { safeLocalReturnTo } from "@/lib/auth/return-to";

export const runtime="nodejs";
async function start(request:NextRequest,inviteValue=""){
  const intent=request.nextUrl.searchParams.get("intent")==="link"?"link":"login",session=intent==="link"?await getSession():null;
  const returnTo=intent==="login"?safeLocalReturnTo(request.nextUrl.searchParams.get("returnTo")):"/dashboard";
  if(!googleConfigured()){
    const target=new URL("/login",request.url);target.searchParams.set("error","google_unavailable");if(intent==="login")target.searchParams.set("returnTo",returnTo);return NextResponse.redirect(target);
  }
  if(intent==="link"&&!session)return NextResponse.redirect(new URL("/login",request.url));
  const invite=(inviteValue||request.nextUrl.searchParams.get("invite")||"").slice(0,200);
  const flow:GoogleFlow={state:googleOidc.randomState(),nonce:googleOidc.randomNonce(),verifier:googleOidc.randomPKCECodeVerifier(),intent,...(session?{userId:session.userId}:{}),...(invite?{invite}:{}),...(intent==="login"?{returnTo}:{}),exp:Date.now()+10*60*1000};
  const target=await googleAuthorizationUrl(request.nextUrl.origin,flow),response=NextResponse.redirect(target);
  response.headers.set("Referrer-Policy","no-referrer");response.cookies.set(GOOGLE_FLOW_COOKIE,encodeGoogleFlow(flow),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:600});return response;
}
export async function GET(request:NextRequest){return start(request);}
export async function POST(request:NextRequest){const form=await request.formData();return start(request,String(form.get("invite")||""));}
