import "server-only";
import { sql } from "@/lib/db";
import { credentialValidity } from "@/lib/credential-validity";
import { getRecencyStateForUser } from "@/lib/recency-service";
import { getRecencyAuditForUser } from "@/lib/recency-audit-service";
import { getSplRecencyStateForUser } from "@/lib/spl-recency-service";
import { getHelicopterRecencyStateForUser } from "@/lib/helicopter-recency-service";
import { getBalloonRecencyStateForUser } from "@/lib/balloon-recency-service";
import { pilotWorkspaceCategory } from "@/lib/pilot-workspace";
import { credentialWorkspaceItem,evaluationWorkspaceItem,setupWorkspaceItem,sortComplianceWorkspaceItems,type ComplianceWorkspaceCategory,type ComplianceWorkspaceItem,type ComplianceWorkspaceStatus } from "@/lib/recency-workspace";

const t=(value:unknown)=>String(value??"").trim();
const category=(value:unknown):ComplianceWorkspaceCategory=>{
  const normalized=t(value).toUpperCase();
  if(normalized==="AEROPLANE")return"aeroplane";
  if(normalized==="HELICOPTER")return"helicopter";
  if(normalized==="SAILPLANE")return"sailplane";
  if(normalized==="BALLOON")return"balloon";
  return pilotWorkspaceCategory(value);
};
type CredentialRow={kind:string;id:unknown;label:unknown;category_basis:unknown;validity_mode:unknown;valid_until:unknown;recency_until:unknown;warning_days:unknown};
export type RecencyComplianceWorkspaceState={today:string;items:ComplianceWorkspaceItem[];counts:Record<ComplianceWorkspaceStatus,number>;activeCategories:ComplianceWorkspaceCategory[];currentCredentialCount:number;credentialCount:number;recencyCount:number};

export async function getRecencyComplianceWorkspaceForUser(userId:number):Promise<RecencyComplianceWorkspaceState>{
  const credentialRowsPromise=sql`
    SELECT 'licence'::text kind,id,licence_type label,licence_type category_basis,validity_mode,valid_until::text valid_until,recency_until::text recency_until,NULL::int warning_days
    FROM pilot_licences WHERE user_id=${userId} AND active=TRUE
    UNION ALL
    SELECT 'qualification'::text kind,q.id,q.qualification_type label,COALESCE(NULLIF(q.regulatory_category,''),l.licence_type) category_basis,q.validity_mode,q.valid_until::text valid_until,q.recency_until::text recency_until,NULL::int warning_days
    FROM pilot_qualifications q JOIN pilot_licences l ON l.id=q.licence_id AND l.user_id=q.user_id
    WHERE q.user_id=${userId} AND q.active=TRUE AND l.active=TRUE AND COALESCE(q.record_kind,'')<>'aircraft_training'
    UNION ALL
    SELECT 'document'::text kind,id,label,'OTHER'::text category_basis,CASE WHEN expiry_date>=DATE '9999-01-01' THEN 'unlimited' ELSE 'date' END validity_mode,expiry_date::text valid_until,NULL::text recency_until,warning_days
    FROM user_expiries WHERE user_id=${userId} AND UPPER(TRIM(category))<>'LICENCE' AND active=1
    ORDER BY kind,label,id
  ` as unknown as Promise<CredentialRow[]>;
  const[partFcl,spl,helicopter,balloon,credentialRows]=await Promise.all([
    getRecencyStateForUser(userId),
    getSplRecencyStateForUser(userId),
    getHelicopterRecencyStateForUser(userId),
    getBalloonRecencyStateForUser(userId),
    credentialRowsPromise,
  ]);
  const auditByEvaluation=partFcl.evaluations.length?await getRecencyAuditForUser(userId,partFcl.evaluations,partFcl.evidence,partFcl.preferences,partFcl.today):{};
  const items:ComplianceWorkspaceItem[]=[];

  for(const evaluation of partFcl.evaluations){
    const audit=auditByEvaluation[evaluation.id],links=(audit?.rows??[]).filter(row=>row.href).slice(0,4).map(row=>({id:row.id,label:row.title,detail:`${row.date} · ${row.detail}`,href:row.href}));
    items.push(evaluationWorkspaceItem({evaluation,today:partFcl.today,category:evaluation.code==="CUSTOM"?"other":"aeroplane",family:evaluation.code==="CUSTOM"?"Custom":"Part-FCL",evidenceLinks:links,evidenceSummary:audit?.totalRows?`${audit.confirmedCount} confirmed${audit.limitedCount?` · ${audit.limitedCount} limited`:""}${audit.issueCount?` · ${audit.issueCount} review`:""}`:undefined}));
  }

  if(spl){
    for(const evaluation of[...spl.evaluations,...spl.launchEvaluations])items.push(evaluationWorkspaceItem({evaluation,today:spl.today,category:"sailplane",family:"Part-SFCL"}));
    if(!spl.hasSailplanePrivilege&&!spl.hasTmgPrivilege)items.push(setupWorkspaceItem({id:"spl-privileges",category:"sailplane",family:"Part-SFCL",title:"SPL privilege evidence",summary:"Record the Sailplane and/or TMG privileges actually held before FlyTally evaluates Part-SFCL recency.",href:"/credentials?view=licences"}));
  }

  if(helicopter){
    for(const evaluation of[...helicopter.evaluations,...helicopter.passengerEvaluations])items.push(evaluationWorkspaceItem({evaluation,today:helicopter.today,category:"helicopter",family:"Part-FCL"}));
    if(helicopter.hasHelicopterLicence&&!helicopter.helicopterTypes.length)items.push(setupWorkspaceItem({id:"helicopter-types",category:"helicopter",family:"Part-FCL",title:"Helicopter type evidence",summary:"Add an active helicopter aircraft profile so type-specific recency can be evaluated without pooling different types.",href:"/aircraft"}));
  }

  if(balloon){
    const evaluations=balloon.anchor?[balloon.anchor,...balloon.additional]:[...balloon.candidates.map(item=>item.evaluation),...balloon.additional];
    if(balloon.tethered)evaluations.push(balloon.tethered);
    for(const evaluation of evaluations)items.push(evaluationWorkspaceItem({evaluation,today:balloon.today,category:"balloon",family:"Part-BFCL"}));
    if(!balloon.hasBpl)items.push(setupWorkspaceItem({id:"bpl-licence",category:"balloon",family:"Part-BFCL",title:"BPL licence evidence",summary:"Balloon activity exists, but FlyTally will not infer a BPL licence or privilege from flight history.",href:"/credentials?view=licences"}));
    else if(!balloon.heldClasses.length)items.push(setupWorkspaceItem({id:"bpl-classes",category:"balloon",family:"Part-BFCL",title:"BPL class privileges",summary:"Record the balloon classes actually held before BFCL.160 recency is evaluated.",href:"/credentials?view=licences"}));
  }

  for(const row of credentialRows){
    const kind=row.kind==="qualification"?"qualification":row.kind==="document"?"document":"licence",validity=credentialValidity({mode:row.validity_mode,validUntil:row.valid_until,recencyUntil:row.recency_until,warningDays:row.warning_days},partFcl.today),label=t(row.label)||({licence:"Licence",qualification:"Qualification",document:"Document"})[kind],href=kind==="document"?"/credentials?view=documents":`/credentials?view=licences${kind==="qualification"?`#qualification-${t(row.id)}`:""}`;
    items.push(credentialWorkspaceItem({id:t(row.id),kind,category:category(row.category_basis||label),title:label,detail:validity.label,validity,href}));
  }

  const sorted=sortComplianceWorkspaceItems(items),statuses:ComplianceWorkspaceStatus[]=["current","action-soon","not-current","incomplete-evidence"],counts=Object.fromEntries(statuses.map(status=>[status,sorted.filter(item=>item.status==status).length])) as Record<ComplianceWorkspaceStatus,number>,activeCategories=[...new Set(sorted.filter(item=>item.kind==="recency"||item.kind==="setup").map(item=>item.category).filter(value=>value!=="other"))],credentialItems=sorted.filter(item=>["licence","qualification","document"].includes(item.kind));
  return{today:partFcl.today,items:sorted,counts,activeCategories,currentCredentialCount:credentialItems.filter(item=>item.status==="current").length,credentialCount:credentialItems.length,recencyCount:sorted.filter(item=>item.kind==="recency").length};
}
