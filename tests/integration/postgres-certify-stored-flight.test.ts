import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { before,test } from "node:test";
import { verifyFlightCertification } from "../../lib/certification-integrity.ts";
import { bootstrapProductionSchema,importServerModule } from "./server-modules.ts";

// Behavioural test of the server-side certification gate: it calls the real
// certifyStoredFlight() from lib/flight-certification.ts on the full production-like schema,
// including its schema gates, the compliance engine, the fingerprint, the guarded seal and
// the recency snapshot refresh.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const PILOT=9001,OTHER=9002;

type Result={status:string;flightId:number;recordRevision?:number;certificationHash?:string;issues?:Array<{code:string}>};
let certify:(userId:number,flightId:number,expectedRowXmin?:string)=>Promise<Result>;

function psql(statement:string){
  const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
  if(result.error)throw result.error;
  assert.equal(result.status,0,`PostgreSQL command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}
const row=(id:number)=>JSON.parse(psql(`SELECT row_to_json(f)::text FROM flights f WHERE id=${id}`)||"null") as Record<string,unknown>|null;

let next=9400;
/** A complete single-pilot PIC draft in the pilot's own SEP aircraft. */
function draft(columns:Record<string,string|number>={},userId=PILOT){
  const id=++next;
  const all:Record<string,string|number>={date:"2026-10-20",evidence:"EASA",registration:"OK-E2E",aircraft_type:"B23",aircraft_make:"BRM Aero",aircraft_model:"Bristell B23",
    aircraft_class:"SEP",regulatory_category:"AEROPLANE",operation_type:"SP",engine_type:"SE",departure:"LKLT",arrival:"LKPR",off_block:"11:00",takeoff:"11:05",
    landing:"11:50",on_block:"12:00",role:"PIC",pic_minutes:60,starts:1,landings_day:1,commander:"Browser Smoke Pilot",task:"Local flight",...columns};
  const values=Object.values(all).map(v=>typeof v==="number"?String(v):`'${v.replaceAll("'","''")}'`);
  psql(`INSERT INTO flights(id,user_id,${Object.keys(all).join(",")}) VALUES(${id},${userId},${values.join(",")})`);
  return id;
}

before(async()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required");
  bootstrapProductionSchema();
  ({certifyStoredFlight:certify}=await importServerModule<{certifyStoredFlight:typeof certify}>("lib/flight-certification.ts"));
});

test("a complete draft is certified, locked, fingerprinted and refreshes the recency snapshot",{skip:!enabled},async()=>{
  const id=draft();
  psql(`UPDATE user_settings SET preferences_json='{}'::jsonb WHERE user_id=${PILOT}`);
  const result=await certify(PILOT,id);
  assert.equal(result.status,"certified",JSON.stringify(result));
  assert.equal(result.flightId,id);
  assert.equal(result.recordRevision,1);
  const sealed=row(id)!;
  assert.ok(sealed.certified_at&&sealed.locked_at);
  assert.equal(sealed.certified_by_user_id,PILOT);
  assert.equal(sealed.locked_by_user_id,PILOT);
  assert.equal(sealed.certification_version,8);
  assert.equal(sealed.certification_hash,result.certificationHash);
  assert.equal(verifyFlightCertification(sealed,PILOT).status,"verified");
  const snapshot=JSON.parse(psql(`SELECT (preferences_json->'recency_snapshot')::text FROM user_settings WHERE user_id=${PILOT}`)||"null");
  assert.ok(snapshot?.generatedAt,"certification refreshes the pilot's recency snapshot");
  // A second attempt reports the existing certification and changes nothing.
  assert.deepEqual(await certify(PILOT,id),{status:"already-certified",flightId:id});
  assert.equal(row(id)!.certification_hash,result.certificationHash);
});

test("another pilot can neither certify nor learn about the flight",{skip:!enabled},async()=>{
  const id=draft();
  assert.deepEqual(await certify(OTHER,id),{status:"not-found",flightId:id});
  assert.equal(row(id)!.certified_at,null);
  for(const [userId,flightId] of [[0,id],[PILOT,0],[-1,id],[PILOT,1.5]])assert.equal((await certify(userId,flightId)).status,"not-found");
});

test("a row that changed after the pilot saw it is refused as stale",{skip:!enabled},async()=>{
  const id=draft();
  const seen=psql(`SELECT xmin::text FROM flights WHERE id=${id}`);
  psql(`UPDATE flights SET arrival='LKVO' WHERE id=${id}`);
  assert.deepEqual(await certify(PILOT,id,seen),{status:"stale",flightId:id});
  assert.equal(row(id)!.certified_at,null);
  const current=psql(`SELECT xmin::text FROM flights WHERE id=${id}`);
  assert.equal((await certify(PILOT,id,current)).status,"certified");
});

test("an incomplete flight is blocked with its compliance issues and stays a draft",{skip:!enabled},async()=>{
  const id=draft({registration:"",pic_minutes:30});
  const result=await certify(PILOT,id);
  assert.equal(result.status,"blocked");
  const codes=(result.issues??[]).map(issue=>issue.code);
  assert.ok(codes.includes("registration"),codes.join(","));
  assert.ok(codes.includes("function_time_allocation"),codes.join(","));
  const unchanged=row(id)!;
  assert.equal(unchanged.certified_at,null);
  assert.equal(unchanged.locked_at,null);
  assert.equal(unchanged.certification_hash,"");
});

test("a locked draft is reported as locked and is not sealed",{skip:!enabled},async()=>{
  const id=draft();
  psql(`UPDATE flights SET locked_at=NOW(),locked_by_user_id=${PILOT} WHERE id=${id}`);
  assert.deepEqual(await certify(PILOT,id),{status:"locked",flightId:id});
  assert.equal(row(id)!.certified_at,null);
});

test("warnings do not block, and the pilot's own name stands as PIC for their own PIC flight",{skip:!enabled},async()=>{
  // No task or remark only raises a warning; an empty commander on a PIC flight is the pilot.
  const id=draft({task:"",commander:""});
  const result=await certify(PILOT,id);
  assert.equal(result.status,"certified",JSON.stringify(result));
  assert.equal(verifyFlightCertification(row(id)!,PILOT).status,"verified");
});
