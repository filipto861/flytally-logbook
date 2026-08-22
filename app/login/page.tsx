import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in | FlyTally" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark"><img src="/logbook_icon.png" alt="FlyTally" /></div>
        <p className="eyebrow">PILOT LOGBOOK</p>
        <h1>FlyTally</h1>
        <LoginForm />
      </section>
    </main>
  );
}
