import "server-only";
import { cache } from "react";
import { sql } from "@/lib/db";

export type PendingActionKind="shared_flight"|"connection_request"|"aircraft_training_signature"|"legacy_instructor_approval";
export type PendingAction={
  id:string;
  kind:PendingActionKind;
  entityId:number;
  title:string;
  body:string;
  href:string;
  primaryLabel:string;
  createdAt:string;
  participantRole?:string;
};

const text=(value:unknown)=>String(value??"").trim();
const dateText=(value:unknown)=>text(value).slice(0,10);

export const getPendingActionCount=cache(async(userId:number)=>{
  if(!Number.isSafeInteger(userId)||userId<=0)return 0;
  const rows=await sql`SELECT (
    (SELECT COUNT(*) FROM flight_participations p JOIN flights f ON f.id=p.source_flight_id AND f.user_id=p.source_user_id
      WHERE p.participant_user_id=${userId} AND p.status='pending' AND f.certified_at IS NOT NULL
        AND COALESCE(f.record_revision,1)=p.source_revision AND COALESCE(f.certification_hash,'')=COALESCE(p.source_hash,''))
    +(SELECT COUNT(*) FROM pilot_connections c WHERE c.recipient_user_id=${userId} AND c.status='pending')
    +(SELECT COUNT(*) FROM pilot_qualifications q WHERE q.requested_signer_user_id=${userId} AND q.record_kind='aircraft_training' AND q.record_active IS TRUE
        AND q.signature_status='pending' AND q.verified_at IS NULL
        AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=q.user_id AND c.recipient_user_id=${userId}) OR (c.requester_user_id=${userId} AND c.recipient_user_id=q.user_id))))
    +(SELECT COUNT(*) FROM instructor_flight_approvals a JOIN flights f ON f.id=a.flight_id AND f.user_id=a.student_user_id
      WHERE a.instructor_user_id=${userId} AND a.status='pending' AND f.certified_at IS NOT NULL
        AND COALESCE(f.record_revision,1)=a.record_revision AND COALESCE(f.certification_hash,'')=COALESCE(a.flight_hash,'')
        AND NOT EXISTS(SELECT 1 FROM flight_participations p WHERE p.source_flight_id=a.flight_id AND p.source_revision=a.record_revision AND p.participant_user_id=a.instructor_user_id AND p.participant_role='INSTRUCTOR')
        AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=${userId} AND c.recipient_user_id=a.student_user_id) OR (c.recipient_user_id=${userId} AND c.requester_user_id=a.student_user_id))))
  )::int count` as Array<{count:number|string}>;
  return Number(rows[0]?.count)||0;
});

export async function getPendingActions(userId:number):Promise<PendingAction[]>{
  if(!Number.isSafeInteger(userId)||userId<=0)return[];
  const[shared,connections,training,legacy]=await Promise.all([
    sql`SELECT p.id,p.participant_role,p.created_at::text created_at,f.date::text date,f.registration,f.departure,f.arrival,u.display_name
      FROM flight_participations p JOIN flights f ON f.id=p.source_flight_id AND f.user_id=p.source_user_id JOIN users u ON u.id=p.source_user_id
      WHERE p.participant_user_id=${userId} AND p.status='pending' AND f.certified_at IS NOT NULL
        AND COALESCE(f.record_revision,1)=p.source_revision AND COALESCE(f.certification_hash,'')=COALESCE(p.source_hash,'')
      ORDER BY p.created_at DESC` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT c.id,c.created_at::text created_at,c.recipient_label,u.display_name,COALESCE(s.home_airport,'') home_airport
      FROM pilot_connections c JOIN users u ON u.id=c.requester_user_id LEFT JOIN user_settings s ON s.user_id=u.id
      WHERE c.recipient_user_id=${userId} AND c.status='pending' ORDER BY c.created_at DESC` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT q.id,q.updated_at::text created_at,q.verification_role,q.qualification_type,q.aircraft_make,q.aircraft_model,q.aircraft_variant,q.completed_on::text completed_on,u.display_name
      FROM pilot_qualifications q JOIN users u ON u.id=q.user_id
      WHERE q.requested_signer_user_id=${userId} AND q.record_kind='aircraft_training' AND q.record_active IS TRUE AND q.signature_status='pending' AND q.verified_at IS NULL
        AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=q.user_id AND c.recipient_user_id=${userId}) OR (c.requester_user_id=${userId} AND c.recipient_user_id=q.user_id)))
      ORDER BY q.updated_at DESC` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT a.id,a.requested_at::text created_at,f.date::text date,f.registration,f.departure,f.arrival,u.display_name
      FROM instructor_flight_approvals a JOIN flights f ON f.id=a.flight_id AND f.user_id=a.student_user_id JOIN users u ON u.id=a.student_user_id
      WHERE a.instructor_user_id=${userId} AND a.status='pending' AND f.certified_at IS NOT NULL
        AND COALESCE(f.record_revision,1)=a.record_revision AND COALESCE(f.certification_hash,'')=COALESCE(a.flight_hash,'')
        AND NOT EXISTS(SELECT 1 FROM flight_participations p WHERE p.source_flight_id=a.flight_id AND p.source_revision=a.record_revision AND p.participant_user_id=a.instructor_user_id AND p.participant_role='INSTRUCTOR')
        AND EXISTS(SELECT 1 FROM pilot_connections c WHERE c.status='accepted' AND ((c.requester_user_id=${userId} AND c.recipient_user_id=a.student_user_id) OR (c.recipient_user_id=${userId} AND c.requester_user_id=a.student_user_id)))
      ORDER BY a.requested_at DESC` as Promise<Array<Record<string,unknown>>>,
  ]);

  const actions:PendingAction[]=[];
  for(const row of shared){
    const entityId=Number(row.id),role=text(row.participant_role).toUpperCase(),instructor=role==="INSTRUCTOR";
    actions.push({id:`shared-${entityId}`,kind:"shared_flight",entityId,participantRole:role,title:instructor?"Instructor verification requested":"Flight invitation",body:`${text(row.display_name)||"Pilot"} · ${text(row.registration)} · ${dateText(row.date)} · ${text(row.departure)} → ${text(row.arrival)}`,href:`/connections/shared/${entityId}`,primaryLabel:instructor?"Review & sign":"Review & add",createdAt:text(row.created_at)});
  }
  for(const row of connections){
    const entityId=Number(row.id),relationship=text(row.recipient_label).toLowerCase()||"friend";
    actions.push({id:`connection-${entityId}`,kind:"connection_request",entityId,title:"Connection request",body:`${text(row.display_name)||"Pilot"} wants to connect as your ${relationship}.${text(row.home_airport)?` Home airport ${text(row.home_airport)}.`:""}`,href:"/connections",primaryLabel:"Accept",createdAt:text(row.created_at)});
  }
  for(const row of training){
    const entityId=Number(row.id),aircraft=[text(row.aircraft_make),text(row.aircraft_model),text(row.aircraft_variant)].filter(Boolean).join(" ")||text(row.qualification_type)||"Aircraft training",role=text(row.verification_role).toUpperCase()==="EXAMINER"?"Examiner":"Instructor";
    actions.push({id:`training-${entityId}`,kind:"aircraft_training_signature",entityId,title:`${role} signature requested`,body:`${text(row.display_name)||"Pilot"} · ${aircraft} · ${dateText(row.completed_on)}`,href:`/connections/aircraft-training/${entityId}`,primaryLabel:"Review & sign",createdAt:text(row.created_at)});
  }
  for(const row of legacy){
    const entityId=Number(row.id);
    actions.push({id:`legacy-${entityId}`,kind:"legacy_instructor_approval",entityId,title:"Instructor approval requested",body:`${text(row.display_name)||"Pilot"} · ${text(row.registration)} · ${dateText(row.date)} · ${text(row.departure)} → ${text(row.arrival)}`,href:`/connections/flight/${entityId}`,primaryLabel:"Review & sign",createdAt:text(row.created_at)});
  }
  return actions.sort((a,b)=>Date.parse(b.createdAt||"0")-Date.parse(a.createdAt||"0"));
}
