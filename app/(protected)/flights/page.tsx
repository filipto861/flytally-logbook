import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { formatDuration } from "@/lib/data/dashboard";
import { getFlightFilterOptions,getFlightsPage } from "@/lib/data/flights";
export const metadata={title:"Lety | Letový zápisník"};

type Params={page?:string;size?:string;q?:string;evidence?:string;role?:string;registration?:string;aircraftClass?:string;airport?:string;route?:string;gps?:string;year?:string;sort?:string;from?:string;to?:string};
function href(params:Params,changes:Params){const out=new URLSearchParams();for(const [key,value] of Object.entries({...params,...changes}))if(value)out.set(key,value);return `/flights?${out}`;}
function detailHref(id:number,params:Params){const out=new URLSearchParams();for(const [key,value] of Object.entries(params))if(value&&key!=="page"&&key!=="size")out.set(key,value);const query=out.toString();return `/flights/${id}${query?`?${query}`:""}`;}

export default async function FlightsPage({searchParams}:{searchParams:Promise<Params>}){
  const session=await requireUser(),params=await searchParams;
  const all=params.size==="all",filters={...params,page:Number(params.page||1),size:all?5000:Number(params.size||50)};
  const [result,options]=await Promise.all([getFlightsPage(session.userId,filters),getFlightFilterOptions(session.userId)]),pages=Math.max(1,Math.ceil(result.total/result.size));
  const active=[params.q,params.year,params.evidence,params.role,params.aircraftClass,params.registration,params.airport,params.route,params.gps,params.from,params.to].filter(Boolean).length;
  return <>
    <header className="page-header"><div><p className="eyebrow">LETOVÝ DENÍK</p><h1>Lety</h1><p className="muted">Vyhledávání, filtry a kompletní historie</p></div><Link className="primary-link" href="/flights/new">＋ Přidat let</Link></header>
    <details className="panel filter-panel filter-expander"><summary><span>Filtry a řazení</span><small>{active?`${active} aktivní`:"Volitelné filtry"}</small></summary><form method="get"><div className="filter-grid">
      <label className="search-field">Hledat<input name="q" defaultValue={params.q} placeholder="Registrace, letiště, typ, funkce…"/></label>
      <label>Rok<select name="year" defaultValue={params.year||""}><option value="">Všechny</option>{options.years.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Evidence<select name="evidence" defaultValue={params.evidence||""}><option value="">Vše</option>{options.evidence.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Funkce<select name="role" defaultValue={params.role||""}><option value="">Vše</option>{options.roles.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Třída<select name="aircraftClass" defaultValue={params.aircraftClass||""}><option value="">Všechny</option>{options.classes.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Letadlo<select name="registration" defaultValue={params.registration||""}><option value="">Všechna</option>{options.registrations.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Letiště<select name="airport" defaultValue={params.airport||""}><option value="">Všechna</option>{options.airports.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Trasa<select name="route" defaultValue={params.route||""}><option value="">Všechny</option>{options.routes.map(value=><option key={value}>{value}</option>)}</select></label>
      <label>GPS<select name="gps" defaultValue={params.gps||""}><option value="">Vše</option><option value="with">Pouze s GPS</option><option value="without">Pouze bez GPS</option></select></label>
      <label>Řazení<select name="sort" defaultValue={params.sort||"newest"}><option value="newest">Nejnovější</option><option value="oldest">Nejstarší</option><option value="longest">Nejdelší BLOCK</option><option value="cost">Nejvyšší náklady</option><option value="gps">Nejdelší GPS</option></select></label>
      <label>Od<input type="date" name="from" defaultValue={params.from}/></label><label>Do<input type="date" name="to" defaultValue={params.to}/></label>
      <label>Řádků<select name="size" defaultValue={all?"all":String(result.size)}>{[25,50,100,200].map(value=><option key={value}>{value}</option>)}<option value="all">Vše</option></select></label>
      <div className="filter-actions"><button className="primary-button">Použít filtry</button><Link className="secondary-link" href="/flights">Vymazat</Link></div>
    </div></form></details>
    <section className="flight-summary"><div><span>Lety</span><strong>{result.summary.flights}</strong><small>{result.summary.tracks} GPS tracků</small></div><div><span>BLOCK</span><strong>{formatDuration(result.summary.blockMinutes)}</strong><small>celkový čas</small></div><div><span>PIC</span><strong>{formatDuration(result.summary.picMinutes)}</strong><small>velitelský čas</small></div><div><span>Náklady</span><strong>{Math.round(result.summary.cost).toLocaleString("cs-CZ")} Kč</strong><small>po započtení podílů</small></div><div><span>Přistání</span><strong>{result.summary.landings}</strong><small>{result.summary.gpsKm.toFixed(0)} GPS km</small></div></section>
    <section className="table-panel"><div className="table-scroll"><table><thead><tr><th>Detail</th><th>Datum</th><th>Letadlo</th><th>Trasa</th><th>Časy</th><th>BLOCK</th><th>Cena</th><th>Funkce</th><th>Přist.</th><th>GPS</th></tr></thead><tbody>{result.rows.map(f=><tr key={f.id}><td><Link className="detail-button" href={detailHref(f.id,params)}>Otevřít</Link></td><td>{new Date(`${f.date}T00:00:00`).toLocaleDateString("cs-CZ")}</td><td><strong>{f.registration||"—"}</strong><small>{f.aircraft_type||f.evidence}</small></td><td><strong>{f.departure||"—"} → {f.arrival||"—"}</strong><small>{f.task||""}</small></td><td>{f.off_block||"—"}–{f.on_block||"—"}<small>{f.takeoff&&f.landing?`${f.takeoff}–${f.landing}`:""}</small></td><td><strong>{formatDuration(f.block_minutes)}</strong><small>AIR {formatDuration(f.air_minutes)}</small></td><td><strong>{f.price_per_hour?`${Math.round(f.calculated_price).toLocaleString("cs-CZ")} Kč`:"—"}</strong><small>{f.billing_basis||"BLOCK"}</small></td><td>{f.role||"—"}<small>{f.evidence}</small></td><td>{f.starts}</td><td>{f.track_count?<Link className="gps-badge" href={detailHref(f.id,params)}>● {f.track_count}<small>{f.gps_km.toFixed(0)} km</small></Link>:<span className="muted">—</span>}</td></tr>)}{!result.rows.length?<tr><td colSpan={10} className="empty-state">Filtrům neodpovídá žádný let.</td></tr>:null}</tbody></table></div>
      <div className="pagination"><span>{result.total} záznamů</span>{all?null:<><Link aria-disabled={result.page<=1} href={href(params,{page:String(Math.max(1,result.page-1))})}>← Předchozí</Link><strong>{result.page} / {pages}</strong><Link aria-disabled={result.page>=pages} href={href(params,{page:String(Math.min(pages,result.page+1))})}>Další →</Link></>}</div>
    </section>
  </>;
}
