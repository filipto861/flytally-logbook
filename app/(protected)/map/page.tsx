import Link from "next/link";
import { TracksMap } from "@/components/tracks-map";
import { RouteOverviewMap } from "@/components/route-overview-map";
import { requireUser } from "@/lib/auth/require-user";
import { getMapFilterOptions,getOverviewTracks,getRouteOverview } from "@/lib/data/tracks";

export const metadata={title:"Mapa | Letový zápisník"};
type Params={mode?:string;scope?:string;registration?:string;evidence?:string;airport?:string;route?:string;year?:string};
const scopes={rychla:50,stredni:150,vse:500};
function query(params:Params,changes:Params){const q=new URLSearchParams();Object.entries({...params,...changes}).forEach(([key,value])=>{if(value)q.set(key,value)});return `/map?${q}`}

export default async function MapPage({searchParams}:{searchParams:Promise<Params>}){
  const {userId}=await requireUser(),params=await searchParams,mode=params.mode==="tracks"?"tracks":"overview",selected=String(params.scope??"rychla"),limit=scopes[selected as keyof typeof scopes]??scopes.rychla;
  const [options,data]=await Promise.all([getMapFilterOptions(userId),mode==="tracks"?getOverviewTracks(userId,limit,params):getRouteOverview(userId,params)]);
  const trackData=mode==="tracks"?data as Awaited<ReturnType<typeof getOverviewTracks>>:null,routeData=mode==="overview"?data as Awaited<ReturnType<typeof getRouteOverview>>:null;
  return <>
    <header className="page-header"><div><p className="eyebrow">MAPA LETŮ</p><h1>{mode==="overview"?"Letiště a tratě":"GPS tracky"}</h1><p className="muted">{mode==="overview"?`${routeData?.routes.length??0} přímých tratí · ${routeData?.airports.length??0} letišť`:`Vykresleno ${trackData?.tracks.length??0} z ${trackData?.total??0} tracků · ${(trackData?.totalDistanceKm??0).toFixed(0)} km`}</p></div></header>
    <div className="period-control map-mode-control"><Link className={mode==="overview"?"active":""} href={query(params,{mode:"overview",scope:undefined})}>Orientační mapa letišť</Link><Link className={mode==="tracks"?"active":""} href={query(params,{mode:"tracks"})}>GPS tracky</Link></div>
    <details className="panel map-filter-expander"><summary>Filtry mapy</summary><form className="map-filters" method="get"><input type="hidden" name="mode" value={mode}/><input type="hidden" name="scope" value={selected}/><label>Rok<select name="year" defaultValue={params.year||""}><option value="">Všechny</option>{options.years.map(v=><option key={v}>{v}</option>)}</select></label><label>Letadlo<select name="registration" defaultValue={params.registration||""}><option value="">Všechna</option>{options.registrations.map(v=><option key={v}>{v}</option>)}</select></label><label>Evidence<select name="evidence" defaultValue={params.evidence||""}><option value="">Vše</option>{options.evidence.map(v=><option key={v}>{v}</option>)}</select></label><label>Letiště<select name="airport" defaultValue={params.airport||""}><option value="">Všechna</option>{options.airports.map(v=><option key={v}>{v}</option>)}</select></label><label>Trasa<select name="route" defaultValue={params.route||""}><option value="">Všechny</option>{options.routes.map(v=><option key={v}>{v}</option>)}</select></label><button className="primary-button">Použít</button><Link className="secondary-link" href={`/map?mode=${mode}`}>Vymazat</Link></form></details>
    {mode==="tracks"?<div className="scope-links map-scope-links"><Link className={selected==="rychla"?"active":""} href={query(params,{mode:"tracks",scope:"rychla"})}>Rychlá</Link><Link className={selected==="stredni"?"active":""} href={query(params,{mode:"tracks",scope:"stredni"})}>Střední</Link><Link className={selected==="vse"?"active":""} href={query(params,{mode:"tracks",scope:"vse"})}>Vše</Link></div>:null}
    {routeData&&routeData.routes.length?<><div className="map-interaction-help"><span>● Letiště</span><span>━ Trať</span><small>Klepnutím na letiště zobrazíte jeho lety. Klepnutím na trať zobrazíte lety v obou směrech.</small></div><section className="map-panel"><RouteOverviewMap routes={routeData.routes} airports={routeData.airports}/></section></>:routeData?<section className="panel"><p>Pro vybrané filtry chybí tratě s uloženými souřadnicemi letišť.</p></section>:null}
    {trackData&&trackData.tracks.length?<section className="map-panel"><TracksMap tracks={trackData.tracks}/></section>:trackData?<section className="panel"><p>Filtrům neodpovídá žádný GPS track.</p></section>:null}
    {trackData?<details className="panel map-track-table"><summary>Tabulka GPS tracků</summary><div className="table-scroll"><table><thead><tr><th>Datum</th><th>Letadlo</th><th>Trasa</th><th>Vzdálenost</th><th></th></tr></thead><tbody>{trackData.tracks.map(track=><tr key={track.id}><td>{track.date}</td><td>{track.registration}</td><td>{track.departure}–{track.arrival}</td><td>{track.distanceKm.toFixed(1)} km</td><td><Link href={`/flights/${track.flightId}`}>Detail</Link></td></tr>)}</tbody></table></div></details>:null}
  </>;
}
