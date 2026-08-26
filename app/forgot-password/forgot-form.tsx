"use client";
import { useActionState } from "react";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm(){const[state,action,pending]=useActionState(requestPasswordReset,{});if(state.sent)return <div className="auth-confirmation"><strong>Check your email</strong><p>If an active password account exists for that address, FlyTally has sent a reset link. It remains valid for 30 minutes.</p><a href="/login" className="secondary-link">Back to sign in</a></div>;return <form action={action} className="login-form"><label>Account email<input name="email" type="email" autoComplete="email" required autoFocus/></label><button className="primary-button" disabled={pending}>{pending?"Sending…":"Send reset link"}</button><a href="/login" className="secondary-link">Back to sign in</a></form>}
