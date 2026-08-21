"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="primary-button" disabled={pending}>{pending ? "Přihlašuji…" : "Přihlásit se"}</button>;
}

export function LoginForm() {
  const [state, action] = useActionState(login, {});
  return (
    <form action={action} className="login-form">
      <label>E-mail<input name="email" type="email" autoComplete="email" required autoFocus /></label>
      <label>Heslo<input name="password" type="password" autoComplete="current-password" required /></label>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
