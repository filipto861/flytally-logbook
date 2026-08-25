import "server-only";
import { verifyFlightCertification,verifyFstdCertification } from "@/lib/certification-integrity";
import type { BackupRow,PortableBackup } from "@/lib/portable-backup";

const text=(value:unknown)=>String(value??"").trim();
const number=(value:unknown)=>Number(value||0);
const object=(value:unknown):BackupRow=>{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as BackupRow;
  if(typeof value==="string")try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))return parsed as BackupRow}catch{}
  throw new Error("A certified revision contains an invalid snapshot.");
};

function assertCompleteRevisionChain(parent:BackupRow,revisions:BackupRow[],kind:"flight"|"FSTD"){
  const current=Math.max(1,number(parent.record_revision)||1),numbers=revisions.map(row=>number(row.revision_number)).sort((a,b)=>a-b),expected=Array.from({length:Math.max(0,current-1)},(_,index)=>index+1);
  if(numbers.length!==expected.length||numbers.some((value,index)=>value!==expected[index]))throw new Error(`${kind} record ${String(parent.id??"?")} has an incomplete certified revision chain.`);
}

export type BackupCertificationSummary={certifiedFlights:number;flightRevisions:number;certifiedFstd:number;fstdRevisions:number};

export function validateBackupCertificationHistory(backup:PortableBackup,currentUserId:number):BackupCertificationSummary{
  const sourceUserId=number(backup.profile?.id);
  if(!Number.isSafeInteger(sourceUserId)||sourceUserId<=0)throw new Error("Backup profile has no valid source account identifier.");
  if(sourceUserId!==currentUserId)throw new Error("Version 6 backups with certification history are account-bound and can only be restored to the original FlyTally account.");

  const flightRevisionMap=new Map<string,BackupRow[]>();
  for(const revision of backup.flight_certified_revisions){const key=String(revision.flight_id??""),items=flightRevisionMap.get(key)??[];items.push(revision);flightRevisionMap.set(key,items)}
  const fstdRevisionMap=new Map<string,BackupRow[]>();
  for(const revision of backup.fstd_certified_revisions){const key=String(revision.fstd_session_id??""),items=fstdRevisionMap.get(key)??[];items.push(revision);fstdRevisionMap.set(key,items)}

  let certifiedFlights=0,certifiedFstd=0;
  for(const flight of backup.flights){
    const revisions=flightRevisionMap.get(String(flight.id??""))??[];assertCompleteRevisionChain(flight,revisions,"flight");
    const certified=Boolean(text(flight.certified_at)),hash=text(flight.certification_hash);
    if(certified){certifiedFlights++;const result=verifyFlightCertification(flight,sourceUserId);if(result.status!=="verified")throw new Error(`Certified flight ${String(flight.id??"?")} failed fingerprint verification (${result.status}).`)}
    else if(hash)throw new Error(`Flight ${String(flight.id??"?")} is not certified but still contains a certification fingerprint.`);
    for(const revision of revisions){
      const snapshot=object(revision.snapshot_data),revisionNumber=number(revision.revision_number);
      if(number(snapshot.id)!==number(flight.id)||number(snapshot.user_id)!==sourceUserId||number(snapshot.record_revision||1)!==revisionNumber)throw new Error(`Flight ${String(flight.id??"?")} revision ${revisionNumber} does not match its archived snapshot identity.`);
      const candidate={...snapshot,certification_hash:text(revision.certification_hash),certification_version:number(revision.certification_version)||1};
      const result=verifyFlightCertification(candidate,sourceUserId);if(result.status!=="verified")throw new Error(`Flight ${String(flight.id??"?")} revision ${revisionNumber} failed fingerprint verification (${result.status}).`);
    }
  }

  for(const session of backup.fstd_sessions){
    const revisions=fstdRevisionMap.get(String(session.id??""))??[];assertCompleteRevisionChain(session,revisions,"FSTD");
    const certified=Boolean(text(session.certified_at)),hash=text(session.certification_hash);
    if(certified){certifiedFstd++;const result=verifyFstdCertification(session,sourceUserId);if(result.status!=="verified")throw new Error(`Certified FSTD session ${String(session.id??"?")} failed fingerprint verification (${result.status}).`)}
    else if(hash)throw new Error(`FSTD session ${String(session.id??"?")} is not certified but still contains a certification fingerprint.`);
    for(const revision of revisions){
      const snapshot=object(revision.snapshot_data),revisionNumber=number(revision.revision_number);
      if(number(snapshot.id)!==number(session.id)||number(snapshot.user_id)!==sourceUserId||number(snapshot.record_revision||1)!==revisionNumber)throw new Error(`FSTD session ${String(session.id??"?")} revision ${revisionNumber} does not match its archived snapshot identity.`);
      const candidate={...snapshot,certification_hash:text(revision.certification_hash),certification_version:number(revision.certification_version)||1};
      const result=verifyFstdCertification(candidate,sourceUserId);if(result.status!=="verified")throw new Error(`FSTD session ${String(session.id??"?")} revision ${revisionNumber} failed fingerprint verification (${result.status}).`);
    }
  }

  return{certifiedFlights,flightRevisions:backup.flight_certified_revisions.length,certifiedFstd,fstdRevisions:backup.fstd_certified_revisions.length};
}
