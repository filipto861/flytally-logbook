import { redirect } from "next/navigation";
import { getSession,tokenHash } from "@/lib/auth/session";
import { googleConfigured } from "@/lib/auth/google";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { sql } from "@/lib/db";
import { JoinForm } from "./join-form";
import { LegalFooter } from "@/components/legal-footer";

export const metadata={title:"Join private beta | FlyTally"};
export default async function JoinPage({searchParams}:{searchParams:Promise<{token?:string}>}){
  if(await getSession())redirect("/dashboard");const token=String((await searchParams).token||"").slice(0,200);await ensureDatabaseOptimizations();
  const rows=token?await sql`SELECT email,expires_at FROM auth_invites WHERE token_hash=${tokenHash(token)} AND used_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() LIMIT 1` as Array<{email:string;expires_at:string}>:[];
  const invite=rows[0];return <main className="login-shell"><section className="login-card"><div className="brand-mark"><img src="/logbook_icon.png" alt="FlyTally"/></div><p className="eyebrow">PRIVATE BETA</p><h1>{invite?"Welcome to FlyTally":"Invitation unavailable"}</h1>{invite?<><p className="login-lead">Your invitation is reserved for <strong>{invite.email}</strong>.</p><JoinForm token={token} email={invite.email} google={googleConfigured()}/></>:<><p className="login-lead">This invitation is invalid, expired or has already been used.</p><a href="/login" className="secondary-link">Back to sign in</a></>}<div style={{marginTop:"18px"}}><LegalFooter compact/></div></section></main>;
}
