import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth/require-user";
import { formatDuration } from "@/lib/data/dashboard";
import { sql } from "@/lib/db";
import { LOGBOOK_PRINT_SCOPES,logbookPrintScopeLabel,matchesLogbookPrintScope,normalizeLogbookPrintScope,parsePilotPreferences,pilotInCommandName,withAccumulatedFlightTime } from "@/lib/logbook-print";
import styles from "./print.module.css";
export const metadata={title:"Print logbook | FlyTally"};
type Params={scope?:string};
const text=(value:unknown)=>String(value??"").trim();
const time=(value:unknown)=>text(value)||"—";
const duration=(value:unknown)=>formatDuration(Math.max(0,Number(value)||0));
function verification(row:Record<string,unknown>){const name=text(row.verification_name),reference=text(row.verification_reference);return [name,reference].filter(Boolean).join(" · ")}
function aircraftIdentity(row:Record<string,unknown>){return [text(row.aircraft_make),text(row.aircraft_model)||text(row.aircraft_type),text(row.aircraft_variant)].filter(Boolean).join(" ")||"—"}

export default async function PrintPage({searchParams}:{searchParams:Promise<Params>}){
  const {userId}=await requireUser(),params=await searchParams,scope=normalizeLogbookPrintScope(params.scope);
  const [rawRows,profiles]=await Promise.all([
    sql`SELECT date,evidence,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,aircraft_class,operation_type,engine_type,departure,arrival,off_block,takeoff,landing,on_block,landings_day,landings_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,commander,instructor,role,verification_name,verification_reference,task,note,certified_at,certification_hash,CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END block_minutes FROM flights WHERE user_id=${userId} ORDER BY date,off_block,id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT u.display_name,u.email,s.preferences_json FROM users u LEFT JOIN user_settings s ON s.user_id=u.id WHERE u.id=${userId}` as Promise<Array<Record<string,unknown>>>,
  ]);
  const profile=profiles[0]??{},preferences=parsePilotPreferences(profile.preferences_json),pilotName=text(profile.display_name),pilotAddress=text(preferences.pilot_address),licenceNumber=text(preferences.licence_number);
  const rows=withAccumulatedFlightTime(rawRows.filter(row=>matchesLogbookPrintScope(row.evidence,scope)));
  const sum=(key:string)=>rows.reduce((total,row)=>total+Math.max(0,Number(row[key])||0),0),minutes=sum("block_minutes"),landings=sum("landings_day")+sum("landings_night"),uncertified=rows.filter(row=>!row.certified_at).length;
  return <div className="print-logbook easa-print">
    <section className={`${styles.controls} print-trigger`} aria-label="Print options"><form method="get"><label>Logbook content<select name="scope" defaultValue={scope}>{LOGBOOK_PRINT_SCOPES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="secondary-button">Apply</button></form><PrintButton/></section>
    {!pilotAddress?<p className={`${styles.missing} print-trigger`}>Pilot address is not set. Add it in Profile before producing an official logbook copy.</p>:null}{uncertified?<p className={`${styles.missing} print-trigger`}>{uncertified} flight records are not pilot-certified and will be marked DRAFT.</p>:null}
    <header className={styles.header}><div><p className="eyebrow">FLYTALLY · FCL.050</p><h1>Pilot logbook</h1><p className={styles.scope}>{logbookPrintScopeLabel(scope)}</p></div></header>
    <section className={styles.identity}><div><span>Pilot</span><strong>{pilotName||"—"}</strong></div><div><span>Address</span><strong className={styles.address}>{pilotAddress||"—"}</strong></div><div><span>Licence / certificate</span><strong>{licenceNumber||"—"}</strong></div></section>
    <section className="print-totals"><span>Flights <b>{rows.length}</b></span><span>Total <b>{formatDuration(minutes)}</b></span><span>PIC <b>{formatDuration(sum("pic_minutes"))}</b></span><span>Co-pilot <b>{formatDuration(sum("copilot_minutes"))}</b></span><span>Dual <b>{formatDuration(sum("dual_minutes"))}</b></span><span>Night <b>{formatDuration(sum("night_minutes"))}</b></span><span>IFR <b>{formatDuration(sum("ifr_minutes"))}</b></span><span>Landings <b>{landings}</b></span></section>
    <table className={styles.table}><thead><tr><th>Date</th><th>Departure<br/><small>place / UTC</small></th><th>Arrival<br/><small>place / UTC</small></th><th>Aircraft<br/><small>make / model / variant / registration</small></th><th>Operation<br/><small>SP/MP · SE/ME</small></th><th>Flight time<br/><small>total / accumulated</small></th><th>Name of PIC</th><th>PIC</th><th>Co-pilot</th><th>Dual</th><th>FI/FE</th><th>Conditions<br/><small>Night / IFR</small></th><th>LDG<br/><small>D / N</small></th><th>Remarks / endorsements / verification</th></tr></thead>
      <tbody>{rows.map((row,index)=>{const verify=verification(row),picName=pilotInCommandName(row,pilotName),cert=text(row.certification_hash);return <tr key={`${text(row.date)}-${text(row.registration)}-${text(row.off_block)}-${index}`}><td>{text(row.date)?new Date(`${text(row.date)}T00:00:00Z`).toLocaleDateString("en-GB",{timeZone:"UTC"}):"—"}</td><td><b>{text(row.departure)||"—"}</b><small>{time(row.off_block)}</small></td><td><b>{text(row.arrival)||"—"}</b><small>{time(row.on_block)}</small></td><td><b>{aircraftIdentity(row)}</b><small>{text(row.registration)||"—"} · {text(row.aircraft_class)||"—"} · {text(row.evidence)||"—"}</small></td><td>{text(row.operation_type)||"SP"}<small>{text(row.engine_type)||"SE"}</small></td><td><b>{duration(row.block_minutes)}</b><small>Σ {duration(row.accumulated_minutes)}</small></td><td>{picName||"—"}</td><td>{duration(row.pic_minutes)}</td><td>{duration(row.copilot_minutes)}</td><td>{duration(row.dual_minutes)}</td><td>{duration(row.instructor_minutes)}</td><td>{duration(row.night_minutes)}<small>{duration(row.ifr_minutes)}</small></td><td>{text(row.landings_day)||"0"}<small>{text(row.landings_night)||"0"}</small></td><td><b>{text(row.role)||"—"}{text(row.task)?` · ${text(row.task)}`:""}</b>{verify?<small>{verify}</small>:null}{text(row.note)?<small>{text(row.note)}</small>:null}<small>{row.certified_at?`CERT ${cert.slice(0,10)}`:"DRAFT"}</small></td></tr>})}</tbody>
    </table>
    {!rows.length?<p className="empty-state">No flight records match this print selection.</p>:null}
    <section className={styles.certification}><div><span>Pilot certification / signature</span><strong>{pilotName||"Pilot"}</strong></div><div><span>Date</span><strong>________________</strong></div><div><span>Signature</span><strong>____________________________</strong></div></section>
    <footer>FlyTally · Electronic flight record structured for FCL.050 · Times UTC</footer>
  </div>;
}
