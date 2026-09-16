"use client";

import { useState } from "react";

export function SharePublicLink({ token, title }: { token: string; title: string }) {
  const [state, setState] = useState<"idle" | "copied">("idle");
  const path = `/f/${token}`;

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setState("copied");
    window.setTimeout(() => setState("idle"), 1800);
  }

  return <div className="share-link-ready">
    <div className="share-link-box"><code>{path}</code></div>
    <div className="share-link-actions">
      <button type="button" className="primary-button" onClick={share}>{state === "copied" ? "Copied" : "Share link"}</button>
      <a className="secondary-button" href={path} target="_blank" rel="noreferrer">Preview</a>
    </div>
  </div>;
}
