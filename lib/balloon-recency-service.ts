import "server-only";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { ensureV164Schema } from "@/lib/v164-schema";
import { ensureV165Schema } from "@/lib/v165-schema";
import { flightMinutes } from "@/lib/recency-engine";
import { confirmedQualificationMatches,hasConfirmedQualificationStructure,qualificationLogicScope } from "@/lib/qualification-record";
import { evaluateBplBaseClass,evaluateBplAdditionalClass,evaluateBplTetheredRating,findBplAnchorClass,type BalloonClass,type BalloonFlight,type BalloonProficiencyEvidence } from "@/lib/balloon-recency";

const t=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>t(value).toUpperCase();
const todayIso=()=>new Date().toISOString().slice(0,10);
const classLabel=(value:BalloonClass)=>({HOT_AIR_BALLOON:"Hot-air balloon",GAS_BALLOON:"Gas balloon",HOT_AIR_AIRSHIP:"Hot-air airship",MIXED_BALLOON:"Mixed balloon"})[value];
const qualificationClass=(value:unknown):BalloonClass|null=>{const normalized=upper(value).replace(/[_-]+/g," ").replace(/\s+/g," ");if(normalized==="HOT AIR BALLOON"||/^HAB [ABCD]$/.test(normalized))return "HOT_AIR_BALLOON";if(normalized==="GAS BALLOON"||normalized==="GAS")return "GAS_BALLOON";if(normalized==="HOT AIR AIRSHIP"||normalized==="HAS")return "HOT_AIR_AIRSHIP";if(normalized==="MIXED BALLOON"||normalized==="MIXED")return "MIXED_BALLOON";return null;};
const classFromRecord=(row:Record<string,unknown>)=>hasConfirmedQualificationStructure(row)?confirmedQualificationMatches(row,"BALLOON_PRIVILEGE","BALLOON","PILOT")?qualificationClass(qualificationLogicScope(row)):null:qualificationClass(row.qualification_type);
const tetheredQualification=(row:Record<string,unknown>)=>{if(hasConfirmedQualificationStructure(row))return confirmedQualificationMatches(row,"OPERATIONAL","BALLOON","PILOT")&&upper(qualificationLogicScope(row)).includes("TETHERED");const normalized=upper(row.qualification_type).replace(/[_-]+/g," ").replace(/\s+/g," ");return normalized.includes("TETHERED")&&normalized.includes("BALLOON")||normalized==="TETHERED"};

export type BalloonRecencyState={today:string;hasBpl:boolean;heldClasses:BalloonClass[];classLabels:Record<BalloonClass,string>;anchorClass:BalloonClass|null;current:boolean;anchor:ReturnType<typeof evaluateBplBaseClass>|null;additional:ReturnType<typeof evaluateBplAdditionalClass>[];candidates:Array<{balloonClass:BalloonClass;evaluation:ReturnType<typeof evaluateBplBaseClass>}>;evidence:BalloonProficiencyEvidence[];hasTetheredRating:boolean;tethered:ReturnType<typeof evaluateBplTetheredRating>|null};

export async function getBalloonRecencyStateForUser(userId:number):Promise<BalloonRecencyState|null>{
  await ensureDatabaseOptimizations();await Promise.all([ensureV164Schema(),ensureV165Schema()]);const today=todayIso();
  const[licences,qualifications,flightRows,evidenceRows]=await Promise.all([
    sql`SELECT id,licence_type FROM pilot_licences WHERE user_id=${userId} AND active=TRUE AND UPPER(TRIM(licence_type))='BPL' ORDER BY id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT q.qualification_type,q.qualification_family,q.regulatory_category,q.qualification_scope,q.privilege_role,q.classification_source FROM pilot_qualifications q JOIN pilot_licences l ON l.id=q.licence_id AND l.user_id=q.user_id WHERE q.user_id=${userId} AND q.active=TRUE AND l.active=TRUE AND UPPER(TRIM(l.licence_type))='BPL' AND COALESCE(q.record_kind,'')<>'aircraft_training' ORDER BY q.id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT f.date::text date,f.regulatory_category,f.balloon_class,f.balloon_group,f.balloon_operation,f.role,f.takeoff,f.landing,f.takeoffs_day,f.takeoffs_night,f.landings_day,f.landings_night,f.purpose_code,
      EXISTS(SELECT 1 FROM flight_verifications v WHERE v.flight_id=f.id AND v.flight_user_id=f.user_id AND v.record_revision=COALESCE(f.record_revision,1) AND v.flight_hash=f.certification_hash AND v.verification_role='INSTRUCTOR' AND v.status='signed') instructor_signed
      FROM flights f WHERE f.user_id=${userId} AND f.certified_at IS NOT NULL AND UPPER(COALESCE(f.regulatory_category,''))='BALLOON' AND CASE WHEN f.date~'^\\d{4}-\\d{2}-\\d{2}$' THEN f.date::date ELSE NULL END>=CURRENT_DATE-INTERVAL '4 years' ORDER BY f.date DESC,f.id DESC` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id,balloon_class,balloon_group,evidence_date::text evidence_date,signer,reference,note FROM bpl_recency_evidence WHERE user_id=${userId} ORDER BY evidence_date DESC,id DESC` as Promise<Array<Record<string,unknown>>>,
  ]);
  const hasBpl=licences.length>0;if(!hasBpl&&!flightRows.length&&!evidenceRows.length)return null;
  const heldClasses=[...new Set(qualifications.map(classFromRecord).filter((value):value is BalloonClass=>Boolean(value)))],hasTetheredRating=qualifications.some(tetheredQualification);
  const flights:BalloonFlight[]=flightRows.map(row=>({date:t(row.date).slice(0,10),regulatoryCategory:t(row.regulatory_category),balloonClass:t(row.balloon_class),balloonGroup:t(row.balloon_group),balloonOperation:t(row.balloon_operation),role:t(row.role),airMinutes:flightMinutes(row.takeoff,row.landing),takeoffs:(Number(row.takeoffs_day)||0)+(Number(row.takeoffs_night)||0),landings:(Number(row.landings_day)||0)+(Number(row.landings_night)||0),purposeCode:t(row.purpose_code),instructorSigned:Boolean(row.instructor_signed)}));
  const evidence:BalloonProficiencyEvidence[]=evidenceRows.map(row=>({id:Number(row.id),balloonClass:t(row.balloon_class),balloonGroup:t(row.balloon_group),date:t(row.evidence_date).slice(0,10),signer:t(row.signer),reference:t(row.reference),note:t(row.note)}));
  const result=findBplAnchorClass(flights,today,heldClasses,evidence),candidates=heldClasses.map(balloonClass=>({balloonClass,evaluation:evaluateBplBaseClass(flights,today,balloonClass,evidence)}));
  return{today,hasBpl,heldClasses,classLabels:{HOT_AIR_BALLOON:classLabel("HOT_AIR_BALLOON"),GAS_BALLOON:classLabel("GAS_BALLOON"),HOT_AIR_AIRSHIP:classLabel("HOT_AIR_AIRSHIP"),MIXED_BALLOON:classLabel("MIXED_BALLOON")},anchorClass:result.anchorClass,current:result.current,anchor:result.anchor,additional:result.additional,candidates,evidence,hasTetheredRating,tethered:hasTetheredRating?evaluateBplTetheredRating(flights,today):null};
}
