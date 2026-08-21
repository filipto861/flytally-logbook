import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Přihlášení | Letový zápisník" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark"><img src="/logbook_icon_32.png" alt="Logo Letového zápisníku" /></div>
        <p className="eyebrow">PILOT LOGBOOK</p>
        <h1>Letový zápisník</h1>
        <p className="muted">Přihlaste se ke svému pilotnímu profilu.</p>
        <LoginForm />
      </section>
    </main>
  );
}
