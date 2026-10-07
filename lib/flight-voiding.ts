import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { ensureRuntimeSchema } from "@/lib/runtime-schema";
import { ensureFlightSharingSchema } from "@/lib/flight-sharing";
import { refreshRecencySnapshot } from "@/lib/recency-service";
import { asEvidenceObject,voidEvidenceSha256 } from "@/lib/void-evidence";

type SnapshotRow={
  id:number;
  xmin:string;
  data:Record<string,unknown>;
  sha256:string;
};

type FlightCandidate=SnapshotRow&{
  recordRevision:number;
  certificationHash:string;
  certificationVersion:number;
  certifiedAt:string;
  certifiedByUserId:number|null;
};

export type VoidCertifiedFlightResult=
  |{status:"voided";flightId:number;tombstoneId:number}
  |{status:"already-voided";flightId:number;tombstoneId:number}
  |{status:"not-found";flightId:number}
  |{status:"not-certified";flightId:number}
  |{status:"invalid-reason";flightId:number}
  |{status:"evidence-incomplete";flightId:number}
  |{status:"stale";flightId:number};

const number=(value:unknown)=>Number(value||0);
const text=(value:unknown)=>String(value??"").trim();
const json=(value:unknown)=>JSON.stringify(value);

function snapshotRow(row:Record<string,unknown>):SnapshotRow{
  const data=asEvidenceObject(row.source_data);
  return{
    id:number(row.id),
    xmin:text(row.row_xmin),
    data,
    sha256:voidEvidenceSha256(data),
  };
}

function flightCandidate(row:Record<string,unknown>):FlightCandidate{
  const base=snapshotRow(row);
  return{
    ...base,
    recordRevision:Math.max(1,number(row.record_revision)||1),
    certificationHash:text(row.certification_hash),
    certificationVersion:Math.max(1,number(row.certification_version)||1),
    certifiedAt:text(row.certified_at),
    certifiedByUserId:row.certified_by_user_id===null||row.certified_by_user_id===undefined?null:number(row.certified_by_user_id),
  };
}

async function activeOrVoided(userId:number,flightId:number){
  const [active,voided]=await Promise.all([
    sql`SELECT f.id,f.xmin::text row_xmin,to_jsonb(f) source_data,
      COALESCE(f.record_revision,1)::integer record_revision,
      COALESCE(f.certification_hash,'') certification_hash,
      COALESCE(f.certification_version,1)::integer certification_version,
      f.certified_at,f.certified_by_user_id
      FROM flights f WHERE f.id=${flightId} AND f.user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT id FROM voided_certified_flights WHERE original_flight_id=${flightId} AND user_id=${userId} LIMIT 1` as Promise<Array<Record<string,unknown>>>,
  ]);
  return{active:active[0]??null,voidedId:number(voided[0]?.id)||0};
}

function rows(raw:Array<Record<string,unknown>>){return raw.map(snapshotRow)}

export async function voidCertifiedFlightRecord(userId:number,flightId:number,reasonInput:string):Promise<VoidCertifiedFlightResult>{
  if(!Number.isSafeInteger(userId)||userId<=0||!Number.isSafeInteger(flightId)||flightId<=0)return{status:"not-found",flightId};
  const reason=text(reasonInput).slice(0,1000);
  if(reason.length<8)return{status:"invalid-reason",flightId};

  await Promise.all([ensureRuntimeSchema(),ensureFlightSharingSchema()]);

  const initial=await activeOrVoided(userId,flightId);
  if(!initial.active){
    return initial.voidedId
      ?{status:"already-voided",flightId,tombstoneId:initial.voidedId}
      :{status:"not-found",flightId};
  }
  const flight=flightCandidate(initial.active);
  if(!flight.certifiedAt||!flight.certificationHash)return{status:"not-certified",flightId};

  const [
    revisionRaw,verificationRaw,approvalRaw,participationRaw,crewRaw,shareRaw,expenseRaw,trackRaw,provenanceRaw,
  ]=await Promise.all([
    sql`SELECT r.id,r.xmin::text row_xmin,to_jsonb(r) source_data FROM flight_certified_revisions r
      WHERE r.user_id=${userId} AND r.flight_id=${flightId} ORDER BY r.revision_number,r.id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT v.id,v.xmin::text row_xmin,to_jsonb(v) source_data FROM flight_verifications v
      WHERE v.flight_user_id=${userId} AND v.flight_id=${flightId} ORDER BY v.record_revision,v.id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT a.id,a.xmin::text row_xmin,to_jsonb(a) source_data FROM instructor_flight_approvals a
      WHERE a.student_user_id=${userId} AND a.flight_id=${flightId} ORDER BY a.record_revision,a.id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT p.id,p.xmin::text row_xmin,to_jsonb(p) source_data FROM flight_participations p
      WHERE p.source_user_id=${userId} AND p.source_flight_id=${flightId} ORDER BY p.source_revision,p.id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT c.id,c.xmin::text row_xmin,to_jsonb(c) source_data FROM flight_connected_crew c
      WHERE c.source_user_id=${userId} AND c.source_flight_id=${flightId} ORDER BY c.id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT s.id,s.xmin::text row_xmin,to_jsonb(s) source_data FROM flight_public_shares s
      WHERE s.user_id=${userId} AND s.flight_id=${flightId} ORDER BY s.id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT e.id,e.xmin::text row_xmin,to_jsonb(e) source_data FROM flight_expenses e
      WHERE e.user_id=${userId} AND e.flight_id=${flightId} ORDER BY e.id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT t.id,t.xmin::text row_xmin,to_jsonb(t) source_data FROM flight_tracks t
      WHERE t.user_id=${userId} AND t.flight_id=${flightId} ORDER BY t.id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT p.id,p.xmin::text row_xmin,to_jsonb(p) source_data FROM flight_source_provenance p
      WHERE p.source_user_id=${userId} AND p.source_flight_id=${flightId} ORDER BY p.id` as Promise<Array<Record<string,unknown>>>,
  ]);

  const revisions=rows(revisionRaw),verifications=rows(verificationRaw),approvals=rows(approvalRaw),participations=rows(participationRaw);
  const crew=rows(crewRaw),shares=rows(shareRaw),expenses=rows(expenseRaw),tracks=rows(trackRaw),provenance=rows(provenanceRaw);

  const acceptedMaterialized=participations
    .map(item=>item.data)
    .filter(item=>text(item.status).toLowerCase()==="accepted"&&number(item.participant_flight_id)>0);
  const provenanceCopies=new Set(provenance.map(item=>number(item.data.participant_flight_id)).filter(Boolean));
  if(acceptedMaterialized.some(item=>!provenanceCopies.has(number(item.participant_flight_id))))return{status:"evidence-incomplete",flightId};

  const operationToken=randomUUID();
  const lockQuery=sql`SELECT pg_advisory_xact_lock(hashtextextended(${`certified-void:${userId}:${flightId}`},0))`;
  const tombstoneQuery=sql`WITH candidate AS MATERIALIZED(
      SELECT f.* FROM flights f
      WHERE f.id=${flightId} AND f.user_id=${userId}
        AND f.xmin::text=${flight.xmin}
        AND f.certified_at IS NOT NULL
        AND COALESCE(f.record_revision,1)=${flight.recordRevision}
        AND COALESCE(f.certification_hash,'')=${flight.certificationHash}
      FOR UPDATE
    )
    INSERT INTO voided_certified_flights(
      user_id,original_flight_id,record_revision,certification_hash,certification_version,
      certified_at,certified_by_user_id,flight_snapshot,flight_snapshot_sha256,
      voided_by_user_id,void_reason,operation_token
    )
    SELECT c.user_id,c.id,COALESCE(c.record_revision,1),c.certification_hash,COALESCE(c.certification_version,1),
      c.certified_at,c.certified_by_user_id,to_jsonb(c),${flight.sha256},
      ${userId},${reason},${operationToken}::uuid
    FROM candidate c
    RETURNING id`;

  const revisionArchive=revisionRaw.map((_,index)=>{
    const item=revisions[index];
    return sql`INSERT INTO voided_flight_certified_revisions(
      voided_flight_id,source_revision_id,revision_number,certification_hash,certification_version,
      certified_at,superseded_at,correction_reason,snapshot_data,snapshot_sha256
    )
    SELECT v.id,r.id,r.revision_number,r.certification_hash,COALESCE(r.certification_version,1),
      r.certified_at,r.superseded_at,COALESCE(r.correction_reason,''),to_jsonb(r),${item.sha256}
    FROM voided_certified_flights v
    JOIN flight_certified_revisions r ON r.id=${item.id} AND r.user_id=${userId} AND r.flight_id=${flightId}
    WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
      AND r.xmin::text=${item.xmin}
      AND to_jsonb(r) IS NOT DISTINCT FROM ${json(item.data)}::jsonb
    ON CONFLICT(voided_flight_id,source_revision_id) DO NOTHING`;
  });

  const verificationArchive=verificationRaw.map((_,index)=>{
    const item=verifications[index];
    return sql`INSERT INTO voided_flight_verifications(
      voided_flight_id,source_verification_id,record_revision,verification_role,status,signer_user_id,
      flight_hash,payload_hash,server_signature,signed_at,revoked_at,credential_snapshot,source_data,source_sha256
    )
    SELECT v.id,x.id,x.record_revision,x.verification_role,x.status,x.signer_user_id,
      x.flight_hash,COALESCE(x.payload_hash,''),COALESCE(x.server_signature,''),x.signed_at,x.revoked_at,
      COALESCE(x.credential_snapshot,'{}'::jsonb),to_jsonb(x),${item.sha256}
    FROM voided_certified_flights v
    JOIN flight_verifications x ON x.id=${item.id} AND x.flight_user_id=${userId} AND x.flight_id=${flightId}
    WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
      AND x.xmin::text=${item.xmin}
      AND to_jsonb(x) IS NOT DISTINCT FROM ${json(item.data)}::jsonb
    ON CONFLICT(voided_flight_id,source_verification_id) DO NOTHING`;
  });

  const archiveApproval=approvals.map(item=>sql`INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
    SELECT v.id,'INSTRUCTOR_APPROVAL',${String(item.id)},to_jsonb(a),${item.sha256}
    FROM voided_certified_flights v
    JOIN instructor_flight_approvals a ON a.id=${item.id} AND a.student_user_id=${userId} AND a.flight_id=${flightId}
    WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
      AND a.xmin::text=${item.xmin} AND to_jsonb(a) IS NOT DISTINCT FROM ${json(item.data)}::jsonb
    ON CONFLICT(voided_flight_id,item_kind,source_key) DO NOTHING`);
  const archiveParticipation=participations.map(item=>sql`INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
    SELECT v.id,'PARTICIPATION',${String(item.id)},to_jsonb(p),${item.sha256}
    FROM voided_certified_flights v
    JOIN flight_participations p ON p.id=${item.id} AND p.source_user_id=${userId} AND p.source_flight_id=${flightId}
    WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
      AND p.xmin::text=${item.xmin} AND to_jsonb(p) IS NOT DISTINCT FROM ${json(item.data)}::jsonb
    ON CONFLICT(voided_flight_id,item_kind,source_key) DO NOTHING`);
  const archiveCrew=crew.map(item=>sql`INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
    SELECT v.id,'CONNECTED_CREW',${String(item.id)},to_jsonb(c),${item.sha256}
    FROM voided_certified_flights v
    JOIN flight_connected_crew c ON c.id=${item.id} AND c.source_user_id=${userId} AND c.source_flight_id=${flightId}
    WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
      AND c.xmin::text=${item.xmin} AND to_jsonb(c) IS NOT DISTINCT FROM ${json(item.data)}::jsonb
    ON CONFLICT(voided_flight_id,item_kind,source_key) DO NOTHING`);
  const archiveShare=shares.map(item=>sql`INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
    SELECT v.id,'PUBLIC_SHARE',${String(item.id)},to_jsonb(s),${item.sha256}
    FROM voided_certified_flights v
    JOIN flight_public_shares s ON s.id=${item.id} AND s.user_id=${userId} AND s.flight_id=${flightId}
    WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
      AND s.xmin::text=${item.xmin} AND to_jsonb(s) IS NOT DISTINCT FROM ${json(item.data)}::jsonb
    ON CONFLICT(voided_flight_id,item_kind,source_key) DO NOTHING`);
  const archiveExpense=expenses.map(item=>sql`INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
    SELECT v.id,'EXPENSE',${String(item.id)},to_jsonb(e),${item.sha256}
    FROM voided_certified_flights v
    JOIN flight_expenses e ON e.id=${item.id} AND e.user_id=${userId} AND e.flight_id=${flightId}
    WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
      AND e.xmin::text=${item.xmin} AND to_jsonb(e) IS NOT DISTINCT FROM ${json(item.data)}::jsonb
    ON CONFLICT(voided_flight_id,item_kind,source_key) DO NOTHING`);
  const archiveTrack=tracks.map(item=>sql`INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
    SELECT v.id,'TRACK',${String(item.id)},to_jsonb(t),${item.sha256}
    FROM voided_certified_flights v
    JOIN flight_tracks t ON t.id=${item.id} AND t.user_id=${userId} AND t.flight_id=${flightId}
    WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
      AND t.xmin::text=${item.xmin} AND to_jsonb(t) IS NOT DISTINCT FROM ${json(item.data)}::jsonb
    ON CONFLICT(voided_flight_id,item_kind,source_key) DO NOTHING`);
  const archiveProvenance=provenance.map(item=>sql`INSERT INTO voided_flight_archive_items(voided_flight_id,item_kind,source_key,source_data,source_sha256)
    SELECT v.id,'SOURCE_PROVENANCE',${String(item.id)},to_jsonb(p),${item.sha256}
    FROM voided_certified_flights v
    JOIN flight_source_provenance p ON p.id=${item.id} AND p.source_user_id=${userId} AND p.source_flight_id=${flightId}
    WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
      AND p.xmin::text=${item.xmin} AND to_jsonb(p) IS NOT DISTINCT FROM ${json(item.data)}::jsonb
    ON CONFLICT(voided_flight_id,item_kind,source_key) DO NOTHING`);

  const archiveQueries=[
    ...revisionArchive,...verificationArchive,...archiveApproval,...archiveParticipation,...archiveCrew,
    ...archiveShare,...archiveExpense,...archiveTrack,...archiveProvenance,
  ];

  // Each mutation below is independently parent-gated. The final DELETE additionally
  // proves source/archive counts; if any evidence changed after discovery, the active
  // row remains and the deferred active+tombstone constraint rolls the transaction back.
  const transitionQueries=[
    sql`UPDATE user_notifications n
      SET read_at=COALESCE(n.read_at,NOW()),href='/audit/voided-flights/'||v.id::text
      FROM voided_certified_flights v
      WHERE n.user_id=${userId}
        AND n.href IN(${`/flights/${flightId}`},${`/flights/${flightId}/audit`})
        AND v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()`,
    sql`UPDATE user_notifications n SET read_at=COALESCE(n.read_at,NOW()),href=''
      WHERE EXISTS(SELECT 1 FROM voided_certified_flights v WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current())
        AND (
          n.href IN(SELECT '/connections/shared/'||p.id FROM flight_participations p WHERE p.source_user_id=${userId} AND p.source_flight_id=${flightId})
          OR n.href IN(SELECT '/connections/flight/'||a.id FROM instructor_flight_approvals a WHERE a.student_user_id=${userId} AND a.flight_id=${flightId})
        )`,    sql`UPDATE flight_participations p
      SET status='superseded',superseded_at=NOW(),responded_at=COALESCE(p.responded_at,NOW()),
          decision_note=CASE WHEN NULLIF(TRIM(COALESCE(p.decision_note,'')),'') IS NULL THEN 'Source certified flight was removed by the owner.' ELSE p.decision_note END
      WHERE p.source_user_id=${userId} AND p.source_flight_id=${flightId} AND p.status='pending'
        AND EXISTS(SELECT 1 FROM voided_certified_flights v WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current())`,
    sql`UPDATE instructor_flight_approvals a
      SET status='superseded',decided_at=COALESCE(a.decided_at,NOW()),
          decision_note=CASE WHEN NULLIF(TRIM(COALESCE(a.decision_note,'')),'') IS NULL THEN 'Source certified flight was removed by the owner.' ELSE a.decision_note END
      WHERE a.student_user_id=${userId} AND a.flight_id=${flightId} AND a.status='pending'
        AND EXISTS(SELECT 1 FROM voided_certified_flights v WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current())`,
    sql`UPDATE flight_verifications x SET status='superseded',decision_note=CASE
        WHEN NULLIF(TRIM(COALESCE(x.decision_note,'')),'') IS NULL THEN 'Source certified flight was removed by the owner.'
        ELSE x.decision_note END
      WHERE x.flight_user_id=${userId} AND x.flight_id=${flightId} AND x.status='pending'
        AND EXISTS(SELECT 1 FROM voided_certified_flights v WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current())`,
    sql`UPDATE flight_public_shares s SET revoked_at=COALESCE(s.revoked_at,NOW())
      WHERE s.user_id=${userId} AND s.flight_id=${flightId} AND s.revoked_at IS NULL
        AND EXISTS(SELECT 1 FROM voided_certified_flights v WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current())`,
    sql`UPDATE flight_source_provenance p SET source_voided_flight_id=v.id,updated_at=NOW()
      FROM voided_certified_flights v
      WHERE p.source_user_id=${userId} AND p.source_flight_id=${flightId}
        AND v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
        AND p.source_voided_flight_id IS NULL`,
  ];

  const deleteRevisionQuery=sql`DELETE FROM flight_certified_revisions r
    WHERE r.user_id=${userId} AND r.flight_id=${flightId}
      AND EXISTS(SELECT 1 FROM voided_certified_flights v WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
        AND (SELECT COUNT(*) FROM voided_flight_certified_revisions a WHERE a.voided_flight_id=v.id)=${revisions.length})
      AND (SELECT COUNT(*) FROM flight_certified_revisions current WHERE current.user_id=${userId} AND current.flight_id=${flightId})=${revisions.length}`;

  const deleteTracksQuery=sql`DELETE FROM flight_tracks t
    WHERE t.user_id=${userId} AND t.flight_id=${flightId}
      AND EXISTS(SELECT 1 FROM voided_certified_flights v WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
        AND (SELECT COUNT(*) FROM voided_flight_archive_items a WHERE a.voided_flight_id=v.id AND a.item_kind='TRACK')=${tracks.length})
      AND (SELECT COUNT(*) FROM flight_tracks current WHERE current.user_id=${userId} AND current.flight_id=${flightId})=${tracks.length}`;

  const finalDeleteQuery=sql`DELETE FROM flights f
    WHERE f.id=${flightId} AND f.user_id=${userId}
      AND f.certified_at IS NOT NULL
      AND COALESCE(f.record_revision,1)=${flight.recordRevision}
      AND COALESCE(f.certification_hash,'')=${flight.certificationHash}
      AND EXISTS(
        SELECT 1 FROM voided_certified_flights v
        WHERE v.operation_token=${operationToken}::uuid AND v.created_txid=txid_current()
          AND v.user_id=f.user_id AND v.original_flight_id=f.id
          AND v.record_revision=COALESCE(f.record_revision,1)
          AND v.certification_hash=COALESCE(f.certification_hash,'')
          AND v.flight_snapshot IS NOT DISTINCT FROM to_jsonb(f)
          AND (SELECT COUNT(*) FROM voided_flight_certified_revisions x WHERE x.voided_flight_id=v.id)=${revisions.length}
          AND (SELECT COUNT(*) FROM voided_flight_verifications x WHERE x.voided_flight_id=v.id)=${verifications.length}
          AND (SELECT COUNT(*) FROM voided_flight_archive_items x WHERE x.voided_flight_id=v.id AND x.item_kind='INSTRUCTOR_APPROVAL')=${approvals.length}
          AND (SELECT COUNT(*) FROM voided_flight_archive_items x WHERE x.voided_flight_id=v.id AND x.item_kind='PARTICIPATION')=${participations.length}
          AND (SELECT COUNT(*) FROM voided_flight_archive_items x WHERE x.voided_flight_id=v.id AND x.item_kind='CONNECTED_CREW')=${crew.length}
          AND (SELECT COUNT(*) FROM voided_flight_archive_items x WHERE x.voided_flight_id=v.id AND x.item_kind='PUBLIC_SHARE')=${shares.length}
          AND (SELECT COUNT(*) FROM voided_flight_archive_items x WHERE x.voided_flight_id=v.id AND x.item_kind='EXPENSE')=${expenses.length}
          AND (SELECT COUNT(*) FROM voided_flight_archive_items x WHERE x.voided_flight_id=v.id AND x.item_kind='TRACK')=${tracks.length}
          AND (SELECT COUNT(*) FROM voided_flight_archive_items x WHERE x.voided_flight_id=v.id AND x.item_kind='SOURCE_PROVENANCE')=${provenance.length}
          AND (SELECT COUNT(*) FROM flight_participations p WHERE p.source_user_id=f.user_id AND p.source_flight_id=f.id)=${participations.length}
          AND (SELECT COUNT(*) FROM instructor_flight_approvals a WHERE a.student_user_id=f.user_id AND a.flight_id=f.id)=${approvals.length}
          AND (SELECT COUNT(*) FROM flight_verifications x WHERE x.flight_user_id=f.user_id AND x.flight_id=f.id)=${verifications.length}
          AND (SELECT COUNT(*) FROM flight_connected_crew c WHERE c.source_user_id=f.user_id AND c.source_flight_id=f.id)=${crew.length}
          AND (SELECT COUNT(*) FROM flight_public_shares s WHERE s.user_id=f.user_id AND s.flight_id=f.id)=${shares.length}
          AND (SELECT COUNT(*) FROM flight_expenses e WHERE e.user_id=f.user_id AND e.flight_id=f.id)=${expenses.length}
          AND (SELECT COUNT(*) FROM flight_source_provenance p WHERE p.source_user_id=f.user_id AND p.source_flight_id=f.id)=${provenance.length}
          AND (SELECT COUNT(*) FROM flight_source_provenance p WHERE p.source_user_id=f.user_id AND p.source_flight_id=f.id AND p.source_voided_flight_id=v.id)=${provenance.length}
          AND NOT EXISTS(SELECT 1 FROM flight_certified_revisions r WHERE r.user_id=f.user_id AND r.flight_id=f.id)
          AND NOT EXISTS(SELECT 1 FROM flight_tracks t WHERE t.user_id=f.user_id AND t.flight_id=f.id)
      )
    RETURNING f.id`;

  const queries=[
    lockQuery,tombstoneQuery,...archiveQueries,...transitionQueries,
    deleteRevisionQuery,deleteTracksQuery,finalDeleteQuery,
  ];
  const tombstoneIndex=1,deleteIndex=queries.length-1;
  let results;
  try{
    results=await sql.transaction(queries);
  }catch(error){
    const message=error instanceof Error?error.message:"";
    if(/duplicate key|unique constraint/i.test(message)){
      const latest=await activeOrVoided(userId,flightId);
      if(latest.voidedId)return{status:"already-voided",flightId,tombstoneId:latest.voidedId};
    }
    throw error;
  }

  const tombstoneId=number((results[tombstoneIndex] as Array<Record<string,unknown>>)?.[0]?.id);
  const deleted=number((results[deleteIndex] as Array<Record<string,unknown>>)?.[0]?.id);
  if(!tombstoneId||deleted!==flightId){
    const latest=await activeOrVoided(userId,flightId);
    if(latest.voidedId)return{status:"already-voided",flightId,tombstoneId:latest.voidedId};
    if(!latest.active)return{status:"not-found",flightId};
    return latest.active.certified_at?{status:"stale",flightId}:{status:"not-certified",flightId};
  }

  await refreshRecencySnapshot(userId);
  return{status:"voided",flightId,tombstoneId};
}
