import Link from "next/link";
import { aircraftCategoryCapabilities } from "@/lib/aircraft-category";
import { aircraftPrintCode,isAuxiliaryLogbookRole,pilotInCommandName } from "@/lib/logbook-print";

const text=(value:unknown)=>String(value??"").trim();
const minutes=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));
const hm=(value:unknown)=>{const total=minutes(value);return total?`${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`:"—"};
const utc=(value:unknown)=>text(value).replace(":","")||"—";
const date=(value:unknown)=>{const match=text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?`${match[3]}/${match[2]}/${match[1].slice(2)}`:text(value)||"—"};
const launchLabel=(value:unknown)=>({WINCH:"Winch",AEROTOW:"Aerotow",SELF_LAUNCH:"Self-launch",CAR:"Car launch",BUNGEE:"Bungee",OTHER:"Other"} as Record<string,string>)[text(value).toUpperCase()]||text(value);
const balloonClassLabel=(value:unknown)=>({HOT_AIR_BALLOON:"Hot-air balloon",GAS_BALLOON:"Gas balloon",HOT_AIR_AIRSHIP:"Hot-air airship",MIXED_BALLOON:"Mixed balloon"} as Record<string,string>)[text(value).toUpperCase()]||text(value);
const balloonOperationLabel=(value:unknown)=>text(value).toUpperCase()==="FREE"?"Free flight":text(value).toUpperCase()==="TETHERED"?"Tethered flight":"—";
const count=(value:unknown)=>minutes(value)||"—";
const movements=(day:unknown,night:unknown)=>`${minutes(day)} day · ${minutes(night)} night`;

function remarks(row:Record<string,unknown>){
  const role=text(row.role).toUpperCase(),parts:string[]=[];
  if(["SPIC","PICUS"].includes(role)){
    const verify=[text(row.verification_name),text(row.verification_reference)].filter(Boolean).join(" · ");
    if(verify)parts.push(`${role==="PICUS"?"PIC(US)":role}: ${verify}`);
  }
  if(role==="CRUISE-RELIEF CO-PILOT")parts.push("CRCP");
  if(isAuxiliaryLogbookRole(role))parts.push(`${role} · NON-CREDITABLE`);
  const category=aircraftCategoryCapabilities({regulatoryCategory:row.regulatory_category,aircraftClass:row.aircraft_class,evidence:row.evidence});
  if(category.category==="sailplane"&&!category.isTmg&&Number(row.launches)>0)parts.push(`${launchLabel(row.launch_method)} · ${Number(row.launches)} launch${Number(row.launches)===1?"":"es"}`);
  if(category.category==="balloon")parts.push(`${balloonOperationLabel(row.balloon_operation).toUpperCase()} · ${balloonClassLabel(row.balloon_class).toUpperCase()}${text(row.balloon_group)?` · GROUP ${text(row.balloon_group).toUpperCase()}`:""}`);
  if(text(row.task))parts.push(text(row.task));
  if(text(row.note))parts.push(text(row.note));
  if(text(row.instructor_approval_name))parts.push(`FI APPROVED: ${text(row.instructor_approval_name)}`);
  return parts.join(" · ")||"—";
}

type DesktopTableProps={
  row:Record<string,unknown>;
  caption:string;
  creditable:boolean;
  flight:number;
  displayPic:string;
};

function PoweredDesktopTable({row,caption,creditable,flight,displayPic}:{row:Record<string,unknown>;caption:string;creditable:boolean;flight:number;displayPic:string}){
  const operation=text(row.operation_type).toUpperCase()||"SP",engine=text(row.engine_type).toUpperCase()||"SE";
  const spSe=creditable&&operation!=="MP"&&engine!=="ME"?hm(flight):"—",spMe=creditable&&operation!=="MP"&&engine==="ME"?hm(flight):"—",mp=creditable&&operation==="MP"?hm(flight):"—";
  return <div className="readonly-fcl-table-wrap"><table className="readonly-fcl-table"><caption>{caption}</caption><thead><tr><th rowSpan={2}>Date</th><th colSpan={2}>Departure</th><th colSpan={2}>Arrival</th><th colSpan={2}>Aircraft</th><th colSpan={2}>Single-pilot time</th><th rowSpan={2}>Multi-pilot</th><th rowSpan={2}>Total flight</th><th rowSpan={2}>Name PIC</th><th colSpan={2}>Landings</th><th colSpan={2}>Conditions</th><th colSpan={4}>Pilot function</th><th rowSpan={2}>Remarks</th></tr><tr><th>Place</th><th>UTC</th><th>Place</th><th>UTC</th><th>Type</th><th>Registration</th><th>SE</th><th>ME</th><th>Day</th><th>Night</th><th>Night</th><th>IFR</th><th>PIC</th><th>Co-pilot</th><th>DUAL</th><th>FI/FE</th></tr></thead><tbody><tr><td>{date(row.date)}</td><td>{text(row.departure)||"—"}</td><td>{utc(row.off_block)}</td><td>{text(row.arrival)||"—"}</td><td>{utc(row.on_block)}</td><td>{aircraftPrintCode(row)||text(row.aircraft_type)||"—"}</td><td>{text(row.registration)||"—"}</td><td>{spSe}</td><td>{spMe}</td><td>{mp}</td><td>{creditable?hm(flight):"—"}</td><td>{displayPic}</td><td>{creditable?count(row.landings_day):"—"}</td><td>{creditable?count(row.landings_night):"—"}</td><td>{creditable?hm(row.night_minutes):"—"}</td><td>{creditable?hm(row.ifr_minutes):"—"}</td><td>{creditable?hm(row.pic_minutes):"—"}</td><td>{creditable?hm(row.copilot_minutes):"—"}</td><td>{creditable?hm(row.dual_minutes):"—"}</td><td>{creditable?hm(row.instructor_minutes):"—"}</td><td>{remarks(row)}</td></tr></tbody></table></div>;
}

function SailplaneDesktopTable({row,caption,creditable,flight,displayPic}:DesktopTableProps){
  const tmg=text(row.aircraft_class).toUpperCase()==="TMG";
  if(tmg)return <div className="readonly-fcl-table-wrap"><table className="readonly-fcl-table readonly-category-table"><caption>{caption}</caption><thead><tr><th>Date</th><th>Departure</th><th>Take-off UTC</th><th>Arrival</th><th>Landing UTC</th><th>Aircraft</th><th>Flight time</th><th>Name PIC</th><th>Take-offs</th><th>Landings</th><th>Night</th><th>IFR</th><th>PIC</th><th>DUAL</th><th>FI/FE</th><th>Remarks</th></tr></thead><tbody><tr><td>{date(row.date)}</td><td>{text(row.departure)||"—"}</td><td>{utc(row.takeoff)}</td><td>{text(row.arrival)||"—"}</td><td>{utc(row.landing)}</td><td>{aircraftPrintCode(row)||text(row.aircraft_type)||"—"} · {text(row.registration)||"—"}</td><td>{creditable?hm(flight):"—"}</td><td>{displayPic}</td><td>{creditable?movements(row.takeoffs_day,row.takeoffs_night):"—"}</td><td>{creditable?movements(row.landings_day,row.landings_night):"—"}</td><td>{creditable?hm(row.night_minutes):"—"}</td><td>{creditable?hm(row.ifr_minutes):"—"}</td><td>{creditable?hm(row.pic_minutes):"—"}</td><td>{creditable?hm(row.dual_minutes):"—"}</td><td>{creditable?hm(row.instructor_minutes):"—"}</td><td>{remarks(row)}</td></tr></tbody></table></div>;
  return <div className="readonly-fcl-table-wrap"><table className="readonly-fcl-table readonly-category-table"><caption>{caption}</caption><thead><tr><th>Date</th><th>Launch place</th><th>Take-off UTC</th><th>Landing place</th><th>Landing UTC</th><th>Aircraft</th><th>Flight time</th><th>Name PIC</th><th>Launch method</th><th>Launches</th><th>Landings</th><th>Night</th><th>PIC</th><th>DUAL</th><th>FI/FE</th><th>Remarks</th></tr></thead><tbody><tr><td>{date(row.date)}</td><td>{text(row.departure)||"—"}</td><td>{utc(row.takeoff)}</td><td>{text(row.arrival)||"—"}</td><td>{utc(row.landing)}</td><td>{aircraftPrintCode(row)||text(row.aircraft_type)||"—"} · {text(row.registration)||"—"}</td><td>{creditable?hm(flight):"—"}</td><td>{displayPic}</td><td>{launchLabel(row.launch_method)||"—"}</td><td>{creditable?count(row.launches):"—"}</td><td>{creditable?count(row.landings_day):"—"}</td><td>{creditable?hm(row.night_minutes):"—"}</td><td>{creditable?hm(row.pic_minutes):"—"}</td><td>{creditable?hm(row.dual_minutes):"—"}</td><td>{creditable?hm(row.instructor_minutes):"—"}</td><td>{remarks(row)}</td></tr></tbody></table></div>;
}

function BalloonDesktopTable({row,caption,creditable,flight,displayPic}:DesktopTableProps){
  const classContext=`${balloonClassLabel(row.balloon_class)||"—"}${text(row.balloon_group)?` · Group ${text(row.balloon_group).toUpperCase()}`:""}`;
  return <div className="readonly-fcl-table-wrap"><table className="readonly-fcl-table readonly-category-table"><caption>{caption}</caption><thead><tr><th>Date</th><th>Take-off place</th><th>UTC</th><th>Landing place</th><th>UTC</th><th>Balloon</th><th>BFCL class / group</th><th>Operation</th><th>Flight time</th><th>Name PIC</th><th>Take-offs</th><th>Landings</th><th>Night</th><th>PIC</th><th>DUAL</th><th>FI/FE</th><th>Remarks</th></tr></thead><tbody><tr><td>{date(row.date)}</td><td>{text(row.departure)||"—"}</td><td>{utc(row.takeoff)}</td><td>{text(row.arrival)||"—"}</td><td>{utc(row.landing)}</td><td>{aircraftPrintCode(row)||text(row.aircraft_type)||"—"} · {text(row.registration)||"—"}</td><td>{classContext}</td><td>{balloonOperationLabel(row.balloon_operation)}</td><td>{creditable?hm(flight):"—"}</td><td>{displayPic}</td><td>{creditable?movements(row.takeoffs_day,row.takeoffs_night):"—"}</td><td>{creditable?movements(row.landings_day,row.landings_night):"—"}</td><td>{creditable?hm(row.night_minutes):"—"}</td><td>{creditable?hm(row.pic_minutes):"—"}</td><td>{creditable?hm(row.dual_minutes):"—"}</td><td>{creditable?hm(row.instructor_minutes):"—"}</td><td>{remarks(row)}</td></tr></tbody></table></div>;
}

export function ReadonlyLogbookEntry({row,pilotName,certified,easa,preview=false,hideInPersonSignatureLink=false}:{row:Record<string,unknown>;pilotName:string;certified:boolean;easa:boolean;preview?:boolean;hideInPersonSignatureLink?:boolean}){
  const role=text(row.role).toUpperCase(),creditable=!isAuxiliaryLogbookRole(role),category=aircraftCategoryCapabilities({regulatoryCategory:row.regulatory_category,aircraftClass:row.aircraft_class,evidence:row.evidence}),sailplane=category.category==="sailplane",balloon=category.category==="balloon",block=minutes(row.block_minutes),air=minutes(row.air_minutes),flight=creditable?((sailplane||balloon)?(air||block):block):0;
  const picName=pilotInCommandName(row,pilotName),displayPic=picName&&pilotName&&picName.localeCompare(pilotName,undefined,{sensitivity:"accent"})===0?"SELF":picName||"—";
  const launchSummary=sailplane&&!category.isTmg&&Number(row.launches)>0?`${Number(row.launches)} · ${launchLabel(row.launch_method)}`:"—",movementSummary=sailplane&&category.isTmg?movements(row.takeoffs_day,row.takeoffs_night):"—";
  const placeStartTime=sailplane||balloon?utc(row.takeoff):utc(row.off_block),placeEndTime=sailplane||balloon?utc(row.landing):utc(row.on_block);
  const fields=[["Date",date(row.date)],["Departure",`${text(row.departure)||"—"} · ${placeStartTime} UTC`],["Arrival",`${text(row.arrival)||"—"} · ${placeEndTime} UTC`],["Aircraft",`${aircraftPrintCode(row)||text(row.aircraft_type)||"—"} · ${text(row.registration)||"—"}`],[sailplane||balloon?"Flight time":"Total time",creditable?hm(flight):"—"],["Name PIC",displayPic],["Landings",movements(row.landings_day,row.landings_night)],...(sailplane&&!category.isTmg?[["Launches",launchSummary]]:sailplane&&category.isTmg?[["Take-offs",movementSummary]]:balloon?[["BFCL operation",`${balloonOperationLabel(row.balloon_operation)} · ${balloonClassLabel(row.balloon_class)}${text(row.balloon_group)?` · Group ${text(row.balloon_group)}`:""}`],["Take-offs",movements(row.takeoffs_day,row.takeoffs_night)]]:[]) as string[][],["Night / IFR",`${hm(row.night_minutes)} / ${hm(row.ifr_minutes)}`],["Pilot function",`PIC ${hm(row.pic_minutes)} · Co-pilot ${hm(row.copilot_minutes)} · DUAL ${hm(row.dual_minutes)} · FI/FE ${hm(row.instructor_minutes)}`],["Remarks",remarks(row)]];
  const canSignInPerson=certified&&!preview&&!hideInPersonSignatureLink&&["DUAL","SPIC","PICUS"].includes(role)&&!row.approval_id&&Number(row.id)>0;
  const caption=balloon?"Part-BFCL single-flight logbook preview":sailplane?"Part-SFCL single-flight logbook preview":easa?"FCL.050 single-flight logbook preview":"ULL single-flight logbook preview",title=balloon?"Part-BFCL logbook entry":sailplane?"Part-SFCL logbook entry":easa?"FCL.050 logbook entry":"ULL logbook entry";
  const desktop=balloon?<BalloonDesktopTable row={row} caption={caption} creditable={creditable} flight={flight} displayPic={displayPic}/>:sailplane?<SailplaneDesktopTable row={row} caption={caption} creditable={creditable} flight={flight} displayPic={displayPic}/>:<PoweredDesktopTable row={row} caption={caption} creditable={creditable} flight={flight} displayPic={displayPic}/>;

  return <section className="panel readonly-logbook-entry"><header><div><p className="eyebrow">{preview?"SHARED FLIGHT PREVIEW":certified?"PROTECTED RECORD":"READ-ONLY RECORD"}</p><h2>{title}</h2><p className="muted">{preview?"This is the separate draft FlyTally will create in your logbook.":certified?"This is the certified stored revision. It is displayed as a logbook entry and cannot be edited here.":"This record is locked. Unlock it on the Overview tab to make changes."}</p></div><span className={preview?"record-status":certified?"status-on":"record-status"}>{preview?"PREVIEW":certified?"CERTIFIED":"LOCKED"}</span></header>{desktop}<dl className="readonly-logbook-card mobile-only">{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{canSignInPerson?<div style={{display:"flex",justifyContent:"flex-end",marginTop:"14px"}}><Link className="secondary-button" href={`/flights/${Number(row.id)}/in-person-signature`}>Instructor without FlyTally · Sign on this device</Link></div>:null}</section>;
}
