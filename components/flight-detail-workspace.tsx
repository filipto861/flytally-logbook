"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { POST_SAVE_REVIEW_KEY, POST_SAVE_REVIEW_MAX_AGE_MS } from "@/lib/flight-review-navigation";

type Tab = "overview" | "gps" | "logbook";

export function FlightDetailWorkspace({ overview, gps, logbook, gpsCount = 0, initialTab = "overview" }: { overview: ReactNode; gps: ReactNode; logbook: ReactNode; gpsCount?: number; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [postSaveReview, setPostSaveReview] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const raw = sessionStorage.getItem(POST_SAVE_REVIEW_KEY); if (!raw) return;
    sessionStorage.removeItem(POST_SAVE_REVIEW_KEY);
    const savedAt = Number(raw), age = Date.now() - savedAt;
    if (initialTab === "overview" && Number.isFinite(savedAt) && age>=0 && age<=POST_SAVE_REVIEW_MAX_AGE_MS) { setTab("logbook"); setPostSaveReview(true); }
  }, [initialTab]);
  const selectTab = (value: Tab) => { setTab(value); setPostSaveReview(false); };
  const item = (value: Tab, label: string, badge?: number) => <button type="button" role="tab" id={`flight-tab-${value}`} aria-controls={`flight-panel-${value}`} className={tab === value ? "active" : ""} aria-selected={tab === value} onClick={() => selectTab(value)}><span>{label}</span>{badge !== undefined ? <b>{badge}</b> : null}</button>;
  return <section className="flight-detail-workspace">
    <nav className="detail-tabs" role="tablist" aria-label="Flight detail sections">{item("overview", "Overview")}{item("gps", "GPS track", gpsCount)}{item("logbook", "Logbook data")}</nav>
    {postSaveReview && tab === "logbook" ? <div className="saved-next-flight" role="status"><strong>Flight saved.</strong><span>Review the final Logbook data below. When it is correct, open Overview to certify the record; sharing becomes available after certification.</span></div> : null}
    <div className="detail-tab-content" role="tabpanel" id={`flight-panel-${tab}`} aria-labelledby={`flight-tab-${tab}`}>{tab === "overview" ? overview : tab === "gps" ? gps : logbook}</div>
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:22,paddingTop:14,borderTop:"1px solid var(--line)"}}><Link href={`${pathname}/share`} style={{color:"var(--muted)",fontSize:".82rem",fontWeight:750,padding:"8px 4px"}}>↗ Share flight</Link></div>
  </section>;
}
