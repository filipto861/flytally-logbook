import { aircraftPrintCode,isAuxiliaryLogbookRole,pilotInCommandName } from "@/lib/logbook-print";

const text=(value:unknown)=>String(value??"").trim();
const minutes=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));
const hm=(value:unknown)=>{const total=minutes(value);return total?`${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`:"—"};
const utc=(value:unknown)=>text(value).replace(":","")||"—";
const date=(value:unknown)=>{const match=text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?`${match[3]}/${match[2]}/${match[1].slice(2)}`:text(value)||"—"};

function remarks(row:Record<string,unknown>){
  const role=text(row.role).toUpperCase(),parts:string[]=[];
  if(["SPIC","PICUS"].includes(role)){const verify=[text(row.verification_name),text(row.verification_reference)].filter(Boolean).join(" · ");if(verify)parts.push(`${role==="PICUS"?"PIC(US)":role}: ${verify}`)}
  if(role==="CRUISE-RELIEF CO-PILOT")parts.push("CRCP");
  if(isAuxiliaryLogbookRole(role))parts.push(`${role} · NON-CREDITABLE`);
  if(text(row.task))parts.push(text(row.task));
  if(text(row.note))parts.push(text(row.note));
  if(text(row.instructor_approval_name))parts.push(`FI APPROVED: ${text(row.instructor_approval_name)}`);
  return parts.join(" · ")||"—";
}

export function ReadonlyLogbookEntry({row,pilotName,certified,easa,preview=false}:{row:Record<string,unknown>;pilotName:string;certified:boolean;easa:boolean;preview?:boolean}){
  const role=text(row.role).toUpperCase(),operation=text(row.operation_type).toUpperCase()||"SP",engine=text(row.engine_type).toUpperCase()||"SE",creditable=!isAuxiliaryLogbookRole(role),flight=creditable?minutes(row.block_minutes):0;
  const picName=pilotInCommandName(row,pilotName),displayPic=picName&&pilotName&&picName.localeCompare(pilotName,undefined,{sensitivity:"accent"})===0?"SELF":picName||"—";
  const spSe=creditable&&operation!=="MP"&&engine!=="ME"?hm(flight):"—",spMe=creditable&&operation!=="MP"&&engine==="ME"?hm(flight):"—",mp=creditable&&operation==="MP"?hm(flight):"—";
  const fields=[
    ["Date",date(row.date)],["Departure",`${text(row.departure)||"—"} · ${utc(row.off_block)} UTC`],["Arrival",`${text(row.arrival)||"—"} · ${utc(row.on_block)} UTC`],
    ["Aircraft",`${aircraftPrintCode(row)||text(row.aircraft_type)||"—"} · ${text(row.registration)||"—"}`],["Total time",creditable?hm(flight):"—"],["Name PIC",displayPic],
    ["Landings",`${minutes(row.landings_day)} day · ${minutes(row.landings_night)} night`],["Night / IFR",`${hm(row.night_minutes)} / ${hm(row.ifr_minutes)}`],
    ["Pilot function",`PIC ${hm(row.pic_minutes)} · Co-pilot ${hm(row.copilot_minutes)} · DUAL ${hm(row.dual_minutes)} · FI/FE ${hm(row.instructor_minutes)}`],["Remarks",remarks(row)],
  ];
  return <section className="panel readonly-logbook-entry">
    <header><div><p className="eyebrow">{preview?"SHARED FLIGHT PREVIEW":certified?"PROTECTED RECORD":"READ-ONLY RECORD"}</p><h2>{easa?"FCL.050 logbook entry":"Logbook entry"}</h2><p className="muted">{preview?"This is the separate draft FlyTally will create in your logbook.":certified?"This is the certified stored revision. It is displayed exactly as a logbook entry and cannot be edited here.":"This record is locked. Unlock it on the Overview tab to make changes."}</p></div><span className={preview?"record-status":certified?"status-on":"record-status"}>{preview?"PREVIEW":certified?"CERTIFIED":"LOCKED"}</span></header>
    {easa?<div className="readonly-fcl-table-wrap"><table className="readonly-fcl-table"><caption>FCL.050 single-flight logbook preview</caption><thead>
      <tr><th rowSpan={2}>Date</th><th colSpan={2}>Departure</th><th colSpan={2}>Arrival</th><th colSpan={2}>Aircraft</th><th colSpan={2}>Single-pilot time</th><th rowSpan={2}>Multi-pilot</th><th rowSpan={2}>Total flight</th><th rowSpan={2}>Name PIC</th><th colSpan={2}>Landings</th><th colSpan={2}>Conditions</th><th colSpan={4}>Pilot function</th><th rowSpan={2}>Remarks</th></tr>
      <tr><th>Place</th><th>UTC</th><th>Place</th><th>UTC</th><th>Type</th><th>Registration</th><th>SE</th><th>ME</th><th>Day</th><th>Night</th><th>Night</th><th>IFR</th><th>PIC</th><th>Co-pilot</th><th>DUAL</th><th>FI/FE</th></tr>
    </thead><tbody><tr>
      <td>{date(row.date)}</td><td>{text(row.departure)||"—"}</td><td>{utc(row.off_block)}</td><td>{text(row.arrival)||"—"}</td><td>{utc(row.on_block)}</td><td>{aircraftPrintCode(row)||"—"}</td><td>{text(row.registration)||"—"}</td>
      <td>{spSe}</td><td>{spMe}</td><td>{mp}</td><td>{creditable?hm(flight):"—"}</td><td>{displayPic}</td><td>{creditable?minutes(row.landings_day)||"—":"—"}</td><td>{creditable?minutes(row.landings_night)||"—":"—"}</td>
      <td>{creditable?hm(row.night_minutes):"—"}</td><td>{creditable?hm(row.ifr_minutes):"—"}</td><td>{creditable?hm(row.pic_minutes):"—"}</td><td>{creditable?hm(row.copilot_minutes):"—"}</td><td>{creditable?hm(row.dual_minutes):"—"}</td><td>{creditable?hm(row.instructor_minutes):"—"}</td><td>{remarks(row)}</td>
    </tr></tbody></table></div>:null}
    <dl className={easa?"readonly-logbook-card mobile-only":"readonly-logbook-card"}>{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </section>;
}
