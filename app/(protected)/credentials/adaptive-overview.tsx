import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { credentialValidity } from "@/lib/credential-validity";
import { parsePilotPreferences } from "@/lib/logbook-print";
import { getRecencyStateForUser } from "@/lib/recency-service";
import { pilotWorkspaceCategory,sortPilotWorkspaceItems,validityTone,type PilotWorkspaceItem,type PilotWorkspaceTone } from "@/lib/pilot-workspace";

const t=(value:unknown)=>String(value??"").trim();
const today=new Date().toISOString().slice(0,10);
type DocMeta={validityMode?:string};
function docMeta(value:unknown):DocMeta{try{const parsed=JSON.parse(t(value));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}}catch{return{}}}
const tabs=[["overview","Overview"],["licences","Licences & ratings"],["recency","Recency"],["training","Aircraft training"],["documents","Medical & documents"]] as const;
const toneClass=(tone:PilotWorkspaceTone)=>tone==="current"?"status-on":tone==="review"?"status-warning":tone==="attention"?"status-off":"record-status";

export async function AdaptivePilotOverview(){
  const{userId}=await requireUser();
  const[licences,qualifications,documents,settings]=await Promise.all([
    sql`SELECT id,licence_type,validity_mode,valid_until::text valid_until,recency_until::text recency_until FROM pilot_licences WHERE user_id=${userId} AND active=TRUE ORDER BY licence_type,id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id,licence_id,qualification_type,validity_mode,valid_until::text valid_until,recency_until::text recency_until FROM pilot_qualifications WHERE user_id=${userId} AND active=TRUE AND COALESCE(record_kind,'')<>'aircraft_training' ORDER BY qualification_type,id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id,label,expiry_date::text expiry_date,warning_days,note FROM user_expiries WHERE user_id=${userId} AND UPPER(TRIM(category))<>'LICENCE' AND active=1 ORDER BY expiry_date,label,id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT preferences_json FROM user_settings WHERE user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
  ]);
  const preferences=parsePilotPreferences(settings[0]?.preferences_json);
  const laplLicence=licences.find(item=>t(item.licence_type).toUpperCase()==="LAPL(A)");
  const laplState=laplLicence?await getRecencyStateForUser(userId,{...preferences,recency_monitors:["lapl-fcl140a"]}):null;
  const laplEvaluation=laplState?.evaluations.find(item=>item.id==="lapl-a-fcl140a");
  const items:PilotWorkspaceItem[]=[];

  for(const licence of licences){
    const label=t(licence.licence_type)||"Licence",isLapl=label.toUpperCase()==="LAPL(A)";
    const validity=isLapl?{status:"valid",label:"Unlimited"}:credentialValidity({mode:licence.validity_mode,validUntil:licence.valid_until,recencyUntil:licence.recency_until},today);
    items.push({id:`licence-${licence.id}`,kind:"licence",category:pilotWorkspaceCategory(label),label,detail:isLapl?"Licence validity":"Credential validity",statusLabel:validity.label.toUpperCase(),tone:validityTone(validity.status),href:"/credentials?view=licences"});
  }

  for(const qualification of qualifications){
    const label=t(qualification.qualification_type)||"Qualification",parent=licences.find(item=>Number(item.id)===Number(qualification.licence_id));
    const laplPrivilege=t(parent?.licence_type).toUpperCase()==="LAPL(A)"&&/^(SEP|TMG)/.test(label.toUpperCase());
    if(laplPrivilege){
      const status=laplEvaluation?.status;
      items.push({id:`qualification-${qualification.id}`,kind:"privilege",category:pilotWorkspaceCategory(label),label,detail:"Flying privilege",statusLabel:status==="current"?"CURRENT":status==="not-current"?"NOT CURRENT":"REVIEW",tone:status==="current"?"current":status==="not-current"?"attention":"review",href:"/credentials?view=recency"});
      continue;
    }
    const validity=credentialValidity({mode:qualification.validity_mode,validUntil:qualification.valid_until,recencyUntil:qualification.recency_until},today);
    items.push({id:`qualification-${qualification.id}`,kind:"privilege",category:pilotWorkspaceCategory(label),label,detail:"Rating / qualification",statusLabel:validity.label.toUpperCase(),tone:validityTone(validity.status),href:"/credentials?view=licences"});
  }

  const documentStates=documents.map(item=>{const meta=docMeta(item.note),mode=meta.validityMode==="unlimited"||t(item.expiry_date)==="9999-12-31"?"unlimited":"date";return credentialValidity({mode,validUntil:item.expiry_date,warningDays:item.warning_days},today)});
  const documentAttention=documentStates.filter(state=>state.status!=="valid").length;
  if(documents.length)items.push({id:"documents",kind:"document",category:"other",label:"Medical & documents",detail:`${documents.length} tracked`,statusLabel:documentAttention?`${documentAttention} NEED ATTENTION`:"ALL CURRENT",tone:documentAttention?"attention":"current",href:"/credentials?view=documents"});

  const sorted=sortPilotWorkspaceItems(items),attention=sorted.filter(item=>item.tone==="attention"||item.tone==="review"),categories=[...new Set(sorted.filter(item=>item.kind!=="document").map(item=>item.category))];
  return <>
    <header className="page-header"><div><p className="eyebrow">PILOT PROFILE</p><h1>Licences</h1><p className="muted">Your current credentials and flying status. Open a section above for details.</p></div></header>
    <nav className="credentials-tabs" aria-label="Licence sections">{tabs.map(([key,label])=><Link key={key} className={key==="overview"?"active":""} href={`/credentials?view=${key}`}>{label}</Link>)}</nav>
    <section className="adaptive-workspace">
      {attention.length>0&&<div className="adaptive-attention"><div><span className="adaptive-kicker">Needs attention</span><strong>{attention.length===1?"1 item to review":`${attention.length} items to review`}</strong></div><div className="adaptive-attention-items">{attention.slice(0,3).map(item=><span key={item.id}>{item.label}</span>)}</div></div>}
      <div className="adaptive-section-heading"><div><p className="eyebrow">YOUR FLYING</p><h2>What matters now</h2></div>{categories.length>0&&<span className="adaptive-category-count">{categories.length===1?"1 active category":`${categories.length} active categories`}</span>}</div>
      {sorted.length?<div className="adaptive-status-list">{sorted.map(item=><div className="adaptive-status-row" key={item.id}><div className="adaptive-status-copy"><strong>{item.label}</strong><span>{item.detail}</span></div><b className={toneClass(item.tone)}>{item.statusLabel}</b></div>)}</div>:<div className="panel adaptive-empty"><strong>No credentials added yet</strong><p className="muted">Add your first licence or document and FlyTally will show only the status that is relevant to you.</p><Link className="button" href="/credentials?view=licences">Add licence</Link></div>}
    </section>
  </>;
}
