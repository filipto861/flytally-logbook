import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ForgotPasswordForm } from "./forgot-form";
export const metadata={title:"Reset password | FlyTally"};
export default async function ForgotPasswordPage(){if(await getSession())redirect("/dashboard");return <main className="login-shell"><section className="login-card"><div className="brand-mark"><img src="/logbook_icon.png" alt="FlyTally"/></div><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Forgot password?</h1><p className="login-lead">Enter your FlyTally email. We will send a secure one-time link if the account uses a password.</p><ForgotPasswordForm/></section></main>}
