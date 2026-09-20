import Link from "next/link";

export default function NotFound(){
  return <main className="login-shell page-shell">
    <section className="panel ui-page-stack">
      <h1>Page not found</h1>
      <p className="muted">The page you requested doesn’t exist or is no longer available.</p>
      <Link className="primary-button" href="/">Go to FlyTally</Link>
    </section>
  </main>;
}
