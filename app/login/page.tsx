import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { googleConfigured } from "@/lib/auth/google";
import { safeLocalReturnTo } from "@/lib/auth/return-to";

export const metadata = { title: "Sign in | FlyTally" };

const messages:Record<string,string>={google_unavailable:"Google sign-in is not configured yet.",google_expired:"Google sign-in expired. Please try again.",google_unverified:"Google did not provide a verified email address.",invite_required:"FlyTally is currently invitation only.",invite_invalid:"This invitation is invalid, expired or already used.",google_link_required:"This email already has a FlyTally account. Sign in with your password, then connect Google in Settings.",google_in_use:"This Google account is already connected to another FlyTally account.",account_inactive:"This FlyTally account is inactive.",google_failed:"Google sign-in could not be completed. Please try again."};
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string;reset?:string;returnTo?:string}>}) {
  const params=await searchParams,returnTo=safeLocalReturnTo(params.returnTo),error=messages[String(params.error||"")],success=params.reset==="success"?"Password changed. Sign in with your new password.":undefined;
  if (await getSession()) redirect(returnTo);
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark"><img src="/logbook_icon.png" alt="FlyTally" /></div>
        <p className="eyebrow">PILOT LOGBOOK</p>
        <h1>FlyTally</h1>
        <p className="login-lead">Your flights stay private. Sign in to continue.</p>
        <LoginForm google={googleConfigured()} externalError={error} success={success} returnTo={returnTo}/>
      </section>
    </main>
  );
}
