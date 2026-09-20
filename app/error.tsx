"use client";

import Link from "next/link";

export default function ErrorPage({reset}:{reset:()=>void}){
  return <main className="login-shell page-shell">
    <section className="panel ui-page-stack">
      <h1>Something went wrong</h1>
      <p className="muted">FlyTally couldn’t load this page.</p>
      <button className="primary-button" type="button" onClick={()=>reset()}>Try again</button>
      <Link className="secondary-button" href="/">Go to FlyTally</Link>
    </section>
  </main>;
}
