#!/usr/bin/env node
// DATA-1D offline synthetic-only envelope. No DB, network, files or secrets.
// Results describe fabricated JSON, gzip and Base64, NOT Neon HTTP bytes.
import {gzipSync} from "node:zlib";
import {Buffer} from "node:buffer";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const SECTION_KEYS=Object.freeze([
  "flights","aircraft","rates","airports","expiries","settings",
  "flight_tracks","audit_log","fstd_sessions",
  "flight_certified_revisions","fstd_certified_revisions","deleted_flights",
  "pilot_connections","flight_participations","instructor_flight_approvals",
  "pilot_licences","pilot_qualifications","user_notifications",
  "flight_verifications","connection_audit_log","flight_expenses",
  "spl_recency_evidence","helicopter_recency_evidence","bpl_recency_evidence",
  "voided_certified_flights","voided_flight_certified_revisions",
  "voided_flight_verifications","voided_flight_archive_items",
  "flight_source_provenance",
]);
const PRESETS=Object.freeze({
  small:Object.freeze({flights:40,tracksPerFlight:1,trackChars:256}),
  medium:Object.freeze({flights:500,tracksPerFlight:1,trackChars:8192}),
  large:Object.freeze({flights:4000,tracksPerFlight:2,trackChars:4096}),
});
const SOURCE_USER_ID=900001;
const byteCount=value=>Buffer.byteLength(value,"utf8");

export function syntheticPresetNames(){return Object.keys(PRESETS);}

function makeBlob(length,seed){
  let state=seed>>>0,value="";
  const alphabet="0123456789ABCDEF";
  for(let index=0;index<length;index+=1){
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    value+=alphabet[(state>>>24)&15];
  }
  return value;
}

export function createSyntheticPayload(presetName="small"){
  if(!Object.hasOwn(PRESETS,presetName))throw new Error("Unknown synthetic preset.");
  const config=PRESETS[presetName];
  const trackCount=config.flights*config.tracksPerFlight;
  if(SECTION_KEYS.length!==29||trackCount*config.trackChars>40*1024*1024)
    throw new Error("Synthetic fixture exceeds bounded size.");
  const sections=Object.fromEntries(SECTION_KEYS.map(key=>[key,[]]));
  for(let i=0;i<config.flights;i+=1){
    const id=i+1;
    sections.flights.push({
      id,user_id:SOURCE_USER_ID,date:"2026-01-01",registration:"SYNTHETIC",
      off_block:"08:00",on_block:"09:00",record_revision:1,
      certified_at:null,certification_hash:"",
      note:"FABRICATED DATA - NOT A REAL FLIGHT",
    });
    for(let t=0;t<config.tracksPerFlight;t+=1){
      const trackId=i*config.tracksPerFlight+t+1;
      sections.flight_tracks.push({
        id:trackId,user_id:SOURCE_USER_ID,flight_id:id,
        file_name:"synthetic-"+String(trackId)+".gpx",
        coordinates_json:makeBlob(config.trackChars,trackId),
        point_count:0,
      });
    }
  }
  const counts=Object.fromEntries(SECTION_KEYS.map(key=>[key,sections[key].length]));
  return {
    format:"pilot-logbook-portable",version:13,schema_version:21,
    exported_at:"2026-10-29T00:00:00.000Z",
    profile:{id:SOURCE_USER_ID,email:"synthetic@example.invalid",display_name:"SYNTHETIC"},
    counts,...sections,
  };
}

export function measureSyntheticTransport(presetName="small"){
  const payload=createSyntheticPayload(presetName);
  const probe={
    transaction_isolation:"repeatable read",transaction_read_only:"on",
    snapshot_id:"10:20:",
  };
  const results=[[probe],...SECTION_KEYS.map(key=>payload[key]),[payload.profile],[probe]];
  if(results.length!==32)throw new Error("Synthetic snapshot section count mismatch.");
  const syntheticSnapshotJsonBytes=byteCount(JSON.stringify(results));
  let syntheticPsqlStdoutBytes=0;
  for(let i=0;i<results.length;i+=1){
    syntheticPsqlStdoutBytes+=byteCount(
      "__flytally_local_tx__"+String(i)+":"+JSON.stringify(results[i])+"\n",
    );
  }
  // Dummy integrity value for size shape only, never a valid signed archive.
  const fakeIntegrity={
    algorithm:"SHA-256",payload_sha256:"0".repeat(64),
    signature_version:1,server_signature:"0".repeat(64),
  };
  const raw=Buffer.from(JSON.stringify({...payload,integrity:fakeIntegrity},null,2),"utf8");
  const zipped=gzipSync(raw,{level:9});
  return {
    dataOrigin:"synthetic-only",
    preset:presetName,
    flights:payload.flights.length,
    tracks:payload.flight_tracks.length,
    syntheticTrackChars:PRESETS[presetName].trackChars,
    syntheticSnapshotJsonBytes,
    syntheticPsqlStdoutBytes,
    unsignedCompactPayloadBytes:byteCount(JSON.stringify(payload)),
    prettyArchiveJsonBytes:raw.byteLength,
    gzipLevel9Bytes:zipped.byteLength,
    base64FieldBytes:4*Math.ceil(zipped.byteLength/3),
    currentGzipCapReferenceBytes:50*1024*1024,
    localPsqlMaxBufferReferenceBytes:16*1024*1024,
    verifiedNeonRequestLimitBytes:null,
    verifiedNeonResponseLimitBytes:null,
    caveat:"Not Neon wire encoding, request size, response size, runtime memory, time or real restorability.",
  };
}

function main(){
  if(process.argv.length!==4||process.argv[2]!=="--synthetic-only"
    ||!/^--preset=(small|medium|large)$/.test(process.argv[3]))
    throw new Error("Use --synthetic-only --preset=small|medium|large");
  // No live environment context is permitted, even though no DB client exists.
  if(["DATABASE_URL","NEON_DATABASE_URL","PGHOST","CI","VERCEL"]
    .some(key=>Boolean(process.env[key])))
    throw new Error("Synthetic-only tool refuses a DB/CI/deployment environment.");
  console.log(JSON.stringify(measureSyntheticTransport(process.argv[3].slice(9)),null,2));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){
    console.error("DATA-1D synthetic tool refused: "+String(error?.message??"Unknown error"));
    process.exitCode=1;
  }
}
