import Link from "next/link";

type Row=Record<string,unknown>;
const text=(value:unknown)=>String(value??"");

export function DataQualityPanel({issues,airportStats,repairAction}:{issues:Row[];airportStats:Row;repairAction:()=>Promise<void>}){
  const problems=issues.filter(issue=>issue.severity==="problem").length;
  const warnings=issues.filter(issue=>issue.severity!=="problem").length;
  return <details className="panel quality-panel" open><summary><span>Podrobná kontrola dat</span><small>{issues.length?`${problems} problémů · ${warnings} upozornění`:"Bez nalezených problémů"}</small></summary>
    <div className="quality-meta"><span>Databáze letišť <b>{Number(airportStats.total||0).toLocaleString("cs-CZ")}</b></span><span>Vlastní letiště <b>{Number(airportStats.own||0).toLocaleString("cs-CZ")}</b></span><small>Kontrola nic sama nemaže ani nepřepisuje.</small><form action={repairAction}><button className="secondary-link">Bezpečně doplnit prázdná pole a chybějící sazby</button></form></div>
    {issues.length?<div className="quality-list">{issues.map((issue,index)=><article className={`quality-issue ${text(issue.severity)}`} key={`${text(issue.id)}-${text(issue.code)}-${index}`}><div><span>{issue.severity==="problem"?"PROBLÉM":"UPOZORNĚNÍ"}</span><strong>{text(issue.title)}</strong><p>{text(issue.detail)}</p><small>{text(issue.date)} · {text(issue.registration)||"bez letadla"} · {text(issue.departure)||"?"} → {text(issue.arrival)||"?"}</small></div><Link className="secondary-link" href={`/flights/${text(issue.id)}`}>Opravit let</Link></article>)}</div>:<p className="empty-state">Základní údaje, profily letadel, časy a GPS metadata jsou v pořádku.</p>}
  </details>;
}
