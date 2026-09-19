"use client";

import { useActionState } from "react";
import { PendingActionButton } from "@/components/pending-action-button";
import { login } from "./actions";

function SubmitButton() {
  return <PendingActionButton className="primary-button" pendingLabel="Signing in…">Sign in</PendingActionButton>;
}

export function LoginForm({google,externalError,success,returnTo}:{google:boolean;externalError?:string;success?:string;returnTo:string}) {
  const [state, action] = useActionState(login, {});
  const googleHref=`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <div className="login-options">
      {google?<a className="google-button" href={googleHref}><span aria-hidden="true">G</span>Continue with Google</a>:null}
      {google?<div className="auth-divider"><span>or use your password</span></div>:null}
    <form action={action} className="login-form">
      <input type="hidden" name="returnTo" value={returnTo}/>
      <label>E-mail<input name="email" type="email" autoComplete="email" required autoFocus /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <a href="/forgot-password" className="auth-text-link">Forgot password?</a>
      {success?<p className="form-success" role="status">{success}</p>:null}
      {externalError||state.error ? <p className="form-error" role="alert">{externalError||state.error}</p> : null}
      <SubmitButton />
    </form>
    <p className="auth-note">FlyTally private beta is invitation only.</p>
    </div>
  );
}
