import { redirect } from "next/navigation";
import { getSession,tokenHash } from "@/lib/auth/session";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { sql } from "@/lib/db";
import { ResetPasswordForm } from "./reset-form";
export const metadata={title:"Choose a new password | FlyTally"};
export default async function ResetPasswordPage({searchParams}:{searchParams:Promise<{token?:string}>}){if(await getSession())redirect("/dashboard");const token=String((await searchParams).token||"").slice(0,200);await ensureDatabaseOptimizations();const rows=token?await sql`SELECT 1 FROM auth_password_resets WHERE token_hash=${tokenHash(token)} AND used_at IS NULL AND expires_at>NOW() LIMIT 1`:[];return <main className="login-shell"><section className="login-card"><div className="brand-mark"><img src="/logbook_icon.png" alt="FlyTally"/></div><p className="eyebrow">ACCOUNT RECOVERY</p><h1>{rows[0]?"Choose a new password":"Reset link unavailable"}</h1>{rows[0]?<ResetPasswordForm token={token}/>:<><p className="login-lead">This link is invalid, expired or has already been used.</p><a href="/forgot-password" className="secondary-link">Request a new link</a></>}</section></main>}
