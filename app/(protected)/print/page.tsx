import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { paginateEasaRecords,type EasaPageTotals,type EasaPrintRecord } from "@/lib/easa-print-layout";
import { isAuxiliaryLogbookRole,LOGBOOK_PRINT_SCOPES,logbookPrintScopeLabel,matchesLogbookPrintScope,normalizeLogbookPrintScope,parsePilotPreferences,pilotInCommandName,printIdentity } from "@/lib/logbook-print";
import styles from "./print.module.css";

export const metadata={title:"Print logbook | FlyTally"};
type Params={scope?:string;auxiliary?:string};
const rawText=(value:unknown)=>String(value??"").trim();
const text=(value:unknown)=>{const valueText=rawText(value);return ["nan","null","undefined"].includes(valueText.toLowerCase())?"":valueText};
const minutes=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));
const hm=(value:unknown,blankZero=true)=>{const total=minutes(value);if(!total&&blankZero)return"";return`${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`};
const utc=(value:unknown)=>text(value).replace(":","");
const date=(value:unknown)=>{const match=text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?`${match[3]}/${match[2]}/${match[1].slice(2)}`:""};
const aircraftIdentity=(row:Record<string,unknown>)=>[text(row.aircraft_make),text(row.aircraft_model)||text(row.aircraft_type),text(row.aircraft_variant)].filter(Boolean).join(" ")||text(row.aircraft_type)||"";
const verification=(row:Record<string,unknown>)=>[text(row.verification_name),text(row.verification_reference)].filter(Boolean).join(" · ");
const displayPic=(row:Record<string,unknown>,pilotName:string)=>{const value=pilotInCommandName(row,pilotName);return value&&pilotName&&value.localeCompare(pilotName,undefined,{sensitivity:"accent"})===0?"SELF":value};
const fstdType=(row:Record<string,unknown>)=>{const type=text(row.device_type),qualification=text(row.qualification_number);return qualification?`${type} (${qualification})`:type};
const columnWidths=["4.4%","4.0%","3.5%","4.0%","3.5%","6.1%","4.9%","3.5%","3.5%","3.5%","4.0%","5.7%","3.1%","3.1%","3.2%","3.2%","3.5%","3.6%","3.5%","3.9%","3.8%","5.0%","3.8%","9.8%"];
function flightRemarks(row:Record<string,unknown>){const role=text(row.role).toUpperCase(),verify=verification(row),parts=[] as string[];if(["SPIC","PICUS"].includes(role)&&verify)parts.push(`${role}: ${verify}`);if(isAuxiliaryLogbookRole(role))parts.push(`${role} · NON-CREDITABLE`);if(text(row.task))parts.push(text(row.task));if(text(row.note))parts.push(text(row.note));if(!row.certified_at)parts.push("DRAFT");return parts.join(" · ")}
function fstdRemarks(row:Record<string,unknown>){const parts=[text(row.instruction),text(row.remarks)].filter(Boolean);if(!row.certified_at)parts.push("DRAFT");return parts.join(" · ")}

function TotalsRow({label,total,certify=false}:{label:string;total:EasaPageTotals;certify?:boolean}){
  return <tr className={certify?`${styles.runningTotal} ${styles.signatureTotal}`:styles.pageTotal}>
    <td colSpan={7}>{label}</td><td>{hm(total.spSe)}</td><td>{hm(total.spMe)}</td><td>{hm(total.mp)}</td><td>{hm(total.flight)}</td><td></td>
    <td>{total.landingsDay||""}</td><td>{total.landingsNight||""}</td><td>{hm(total.night)}</td><td>{hm(total.ifr)}</td><td>{hm(total.pic)}</td><td>{hm(total.copilot)}</td><td>{hm(total.dual)}</td><td>{hm(total.instructor)}</td>
    <td></td><td></td><td>{hm(total.fstd)}</td><td className={`${styles.remarksCell} ${certify?styles.signatureCell:""}`}>{certify?<div className={styles.signatureBox}><span>I certify that the entries on this page are correct.</span><b>Pilot&apos;s signature</b><i></i></div>:null}</td>
  </tr>;
}

function Header(){return <thead>
  <tr className={styles.columnNumbers}><th>1</th><th colSpan={2}>2</th><th colSpan={2}>3</th><th colSpan={2}>4</th><th colSpan={3}>5</th><th>6</th><th>7</th><th colSpan={2}>8</th><th colSpan={2}>9</th><th colSpan={4}>10</th><th colSpan={3}>11</th><th>12</th></tr>
  <tr><th rowSpan={2}>DATE<br/><small>dd/mm/yy</small></th><th colSpan={2}>DEPARTURE</th><th colSpan={2}>ARRIVAL</th><th colSpan={2}>AIRCRAFT</th><th colSpan={2}>SINGLE-PILOT TIME</th><th rowSpan={2}>MULTI-PILOT<br/>TIME</th><th rowSpan={2}>TOTAL TIME<br/>OF FLIGHT</th><th rowSpan={2}>NAME(S) PIC</th><th colSpan={2}>LANDINGS</th><th colSpan={2}>OPERATIONAL CONDITION TIME</th><th colSpan={4}>PILOT FUNCTION TIME</th><th colSpan={3}>FSTD SESSION</th><th rowSpan={2}>REMARKS AND<br/>ENDORSEMENTS</th></tr>
  <tr><th>PLACE</th><th>TIME<br/><small>UTC</small></th><th>PLACE</th><th>TIME<br/><small>UTC</small></th><th>MAKE, MODEL, VARIANT</th><th>REGISTRATION</th><th>SE</th><th>ME</th><th>DAY</th><th>NIGHT</th><th>NIGHT</th><th>IFR</th><th>PIC</th><th>CO-PILOT</th><th>DUAL</th><th>INSTRUCTOR</th><th>DATE<br/><small>dd/mm/yy</small></th><th>TYPE</th><th>TOTAL TIME<br/>OF SESSION</th></tr>
</thead>}

function FlightRow({row,pilotName}:{row:EasaPrintRecord;pilotName:string}){
  const operation=text(row.operation_type).toUpperCase()||"SP",engine=text(row.engine_type).toUpperCase()||"SE",creditable=!isAuxiliaryLogbookRole(row.role),flight=creditable?minutes(row.block_minutes):0;
  return <tr className={styles.dataRow}>
    <td>{date(row.date)}</td><td>{text(row.departure)}</td><td>{utc(row.off_block)}</td><td>{text(row.arrival)}</td><td>{utc(row.on_block)}</td><td className={styles.wrapCell}><span>{aircraftIdentity(row)}</span></td><td>{text(row.registration)}</td>
    <td>{creditable&&operation!=="MP"&&engine!=="ME"?hm(flight):""}</td><td>{creditable&&operation!=="MP"&&engine==="ME"?hm(flight):""}</td><td>{creditable&&operation==="MP"?hm(flight):""}</td><td>{creditable?hm(flight):""}</td><td className={styles.wrapCell}><span>{displayPic(row,pilotName)}</span></td>
    <td>{creditable?(minutes(row.landings_day)||""):""}</td><td>{creditable?(minutes(row.landings_night)||""):""}</td><td>{creditable?hm(row.night_minutes):""}</td><td>{creditable?hm(row.ifr_minutes):""}</td><td>{creditable?hm(row.pic_minutes):""}</td><td>{creditable?hm(row.copilot_minutes):""}</td><td>{creditable?hm(row.dual_minutes):""}</td><td>{creditable?hm(row.instructor_minutes):""}</td>
    <td></td><td></td><td></td><td className={styles.remarksCell}><span className={styles.remarksText}>{flightRemarks(row)}</span></td>
  </tr>;
}
function FstdRow({row}:{row:EasaPrintRecord}){return <tr className={`${styles.dataRow} ${styles.fstdRow}`}>{Array.from({length:20},(_,index)=><td key={index}></td>)}<td>{date(row.session_date)}</td><td className={styles.wrapCell}><span>{fstdType(row)}</span></td><td>{hm(row.total_minutes)}</td><td className={styles.remarksCell}><span className={styles.remarksText}>{fstdRemarks(row)}</span></td></tr>}
function BlankRow(){return <tr className={`${styles.dataRow} ${styles.blankRow}`}>{Array.from({length:24},(_,index)=><td key={index}></td>)}</tr>}

export default async function PrintPage({searchParams}:{searchParams:Promise<Params>}){
  const {userId}=await requireUser(),params=await searchParams;
  const [rawFlights,fstdRows,profiles]=await Promise.all([
    sql`SELECT date,evidence,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_variant,aircraft_class,operation_type,engine_type,departure,arrival,off_block,on_block,landings_day,landings_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,commander,instructor,role,verification_name,verification_reference,task,note,certified_at,CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END block_minutes FROM flights WHERE user_id=${userId} ORDER BY date,off_block,id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT session_date::text session_date,device_type,qualification_number,instruction,total_minutes,remarks,certified_at FROM fstd_sessions WHERE user_id=${userId} ORDER BY session_date,id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT u.display_name,u.email,s.preferences_json FROM users u LEFT JOIN user_settings s ON s.user_id=u.id WHERE u.id=${userId}` as Promise<Array<Record<string,unknown>>>,
  ]);
  const profile=profiles[0]??{},preferences=parsePilotPreferences(profile.preferences_json),pilotName=text(profile.display_name),scope=normalizeLogbookPrintScope(params.scope||preferences.print_default_scope),identity=printIdentity(preferences,scope),includeAuxiliary=params.auxiliary?params.auxiliary==="include":Boolean(preferences.print_include_auxiliary_roles);
  const scopedFlights=rawFlights.filter(row=>matchesLogbookPrintScope(row.evidence,scope)),excludedAuxiliary=scopedFlights.filter(row=>isAuxiliaryLogbookRole(row.role)).length;
  const flights:EasaPrintRecord[]=scopedFlights.filter(row=>includeAuxiliary||!isAuxiliaryLogbookRole(row.role)).map(row=>({...row,kind:"flight",sortKey:`${text(row.date)}T${text(row.off_block)||"00:00"}`}));
  const fstd:EasaPrintRecord[]=scope==="ull"?[]:fstdRows.map(row=>({...row,kind:"fstd",sortKey:`${text(row.session_date)}T23:59`}));
  const records=[...flights,...fstd].sort((a,b)=>a.sortKey.localeCompare(b.sortKey)),pages=paginateEasaRecords(records,8),uncertified=records.filter(row=>!row.certified_at).length;
  return <div className="print-logbook easa-print">
    <section className={`${styles.controls} print-trigger`} aria-label="Print options"><form method="get"><label>Logbook content<select name="scope" defaultValue={scope}>{LOGBOOK_PRINT_SCOPES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Auxiliary roles<select name="auxiliary" defaultValue={includeAuxiliary?"include":"exclude"}><option value="exclude">Exclude Safety Pilot / PAX / Observer</option><option value="include">Include for reference</option></select></label><button className="secondary-button">Apply</button></form><div className={styles.controlMeta}><span>EASA Pilot Logbook · columns 1–12</span><span>8 fixed-height records per A4 landscape page</span>{!includeAuxiliary&&excludedAuxiliary?<span>{excludedAuxiliary} auxiliary record{excludedAuxiliary===1?"":"s"} excluded</span>:null}</div><PrintButton/></section>
    {!identity.address?<p className={`${styles.missing} print-trigger`}>The selected logbook address is not set. Add separate EASA / ULL identities in Settings before producing an official copy.</p>:null}{uncertified?<p className={`${styles.missing} print-trigger`}>{uncertified} selected records are not yet pilot-certified. They are marked DRAFT in Remarks.</p>:null}
    {pages.map((page,pageIndex)=><section className={styles.logbookPage} key={pageIndex}>
      <header className={styles.header}><div><h1>PILOT LOGBOOK</h1><p className={styles.scope}>{logbookPrintScopeLabel(scope)}</p></div><strong>Page {pageIndex+1} / {pages.length}</strong></header>
      <section className={styles.identity}><div><span>Holder&apos;s name(s)</span><strong>{pilotName||"—"}</strong></div><div><span>{identity.addressLabel}</span><strong className={styles.address}>{identity.address||"—"}</strong></div><div><span>{identity.licenceLabel}</span><strong className={styles.address}>{identity.licence||"—"}</strong></div></section>
      <div className={styles.tableWrap}><table className={styles.table}><colgroup>{columnWidths.map((width,index)=><col key={index} style={{width}}/>)}</colgroup><Header/><tbody>{page.records.map((row,index)=>row.kind==="fstd"?<FstdRow key={`fstd-${row.sortKey}-${index}`} row={row}/>:<FlightRow key={`flight-${row.sortKey}-${index}`} row={row} pilotName={pilotName}/>)}{Array.from({length:page.blankRows},(_,index)=><BlankRow key={`blank-${index}`}/>)}<TotalsRow label="TOTAL THIS PAGE" total={page.pageTotal}/><TotalsRow label="TOTAL FROM PREVIOUS PAGES" total={page.previousTotal}/><TotalsRow label="TOTAL TIME" total={page.runningTotal} certify/></tbody></table></div>
      <footer>FlyTally · FCL.050 print format · flight times UTC</footer>
    </section>)}
  </div>;
}
