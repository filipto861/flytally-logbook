import Link from "next/link";

type Row=Record<string,unknown>;
const text=(value:unknown)=>String(value??"");

export function DataQualityPanel({issues,airportStats}:{issues:Row[];airportStats:Row}){
  const problems=issues.filter(issue=>issue.severity==="problem").length;
  const warnings=issues.filter(issue=>issue.severity!=="problem").length;
  return <details className="panel quality-panel" open><summary><span>Detailed data check</span><small>{issues.length?`${problems} problems · ${warnings} warnings`:"No issues found"}</small></summary>
    <div className="quality-meta"><span>Airport catalogue <b>{Number(airportStats.total||0).toLocaleString("en-GB")}</b></span><span>Custom airports <b>{Number(airportStats.own||0).toLocaleString("en-GB")}</b></span></div>
    {issues.length?<div className="quality-list">{issues.map((issue,index)=><article className={`quality-issue ${text(issue.severity)}`} key={`${text(issue.id)}-${text(issue.code)}-${index}`}><div><span>{issue.severity==="problem"?"PROBLEM":"WARNING"}</span><strong>{text(issue.title)}</strong><p>{text(issue.detail)}</p><small>{text(issue.date)} · {text(issue.registration)||"no aircraft"} · {text(issue.departure)||"?"} → {text(issue.arrival)||"?"}</small></div><Link className="secondary-link" href={`/flights/${text(issue.id)}`}>Fix flight</Link></article>)}</div>:<p className="empty-state">Flight, aircraft, time and GPS data are valid.</p>}
  </details>;
}
