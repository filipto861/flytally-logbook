import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";
import { cookSql } from "./production-sql.ts";

// Behavioural test of Trash on a v21 (exact currency) schema. It runs the production SQL
// from lib/flight-trash.ts: the five-statement move transaction, the restore preflight,
// both restore branches (v21 monetary and legacy), the advisory lock and the follow-up
// diagnostics. The TypeScript currency validation in front of the v21 branch is covered
// end to end by e2e/trash-integrity.spec.mjs.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_trash_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const PILOT=1,OTHER=2;

function rawPsql(statement:string){
  const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
  if(result.error)throw result.error;
  return result;
}
function run(statement:string){
  const result=rawPsql(`SET search_path TO ${quotedSchema};\n${statement}`);
  if(result.status!==0)throw new Error(`PostgreSQL command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}
function rows(statement:string){
  const clean=statement.trim().replace(/;\s*$/,"");
  return JSON.parse(run(`WITH q AS (${clean}) SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM q`)||"[]") as Array<Record<string,unknown>>;
}
const literal=(value:unknown)=>typeof value==="number"?String(value):`'${String(value).replaceAll("'","''")}'`;
function render(block:string,values:Record<string,unknown>){
  return block.replace(/\$\{([^}]+)\}/g,(_m,expr)=>{
    const key=String(expr).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No test value for \${${key}}`);
    return literal(values[key]);
  });
}

const source=read("lib/flight-trash.ts");
const moveStart=source.indexOf("export async function moveFlightToTrash(");
const restoreStart=source.indexOf("export async function restoreDeletedFlightRecord(");
const blocks=(text:string)=>[...text.matchAll(/sql`([\s\S]*?)`/g)].map(m=>cookSql(m[1]));
const moveSql=blocks(source.slice(moveStart,restoreStart));
const restoreSql=blocks(source.slice(restoreStart));
const pick=(label:string,predicate:(block:string)=>boolean)=>{
  const found=restoreSql.filter(predicate);
  assert.equal(found.length,1,`expected exactly one ${label} statement in restoreDeletedFlightRecord`);
  return found[0];
};
const preflightSql=pick("preflight",b=>b.includes("AS archive_digest"));
const currencyRestoreSql=pick("v21 restore",b=>b.startsWith("WITH candidate")&&b.includes("${archiveDigest}"));
const legacyRestoreSql=pick("legacy restore",b=>b.startsWith("WITH candidate")&&!b.includes("${archiveDigest}"));
const advisorySql=pick("advisory lock",b=>b.includes("pg_advisory_xact_lock"));
const needsNewRestoreSql=pick("monetary diagnostic",b=>b.trim().startsWith("SELECT 1 FROM deleted_flights")&&b.includes("price_currency_code' IS NOT NULL"));
const invalidArchiveSql=pick("invalid-archive diagnostic",b=>b.includes("jsonb_typeof(flight_data)<>'object'"));
const candidateSql=pick("candidate diagnostic",b=>/^SELECT id FROM deleted_flights/.test(b.trim()));

/** The production move-to-Trash transaction. Returns the archive id, or null when refused. */
function moveToTrash(flightId:number,userId=PILOT){
  assert.equal(moveSql.length,5,"moveFlightToTrash transaction changed: review this test");
  const token=randomUUID();
  const values={userId,flightId,token};
  run(`BEGIN;\n${moveSql.map(b=>render(b,values).trimEnd()+";").join("\n")}\nCOMMIT;`);
  return Number(run(`SELECT id FROM deleted_flights WHERE delete_token=${literal(token)}`))||null;
}
/** Read-only preflight, then the locked restore branch in one READ COMMITTED transaction. */
function restore(trashId:number,branch:"currency"|"legacy",userId=PILOT,digest?:string){
  const archiveDigest=digest??String(rows(render(preflightSql,{userId,trashId}))[0]?.archive_digest??"");
  const query=render(branch==="currency"?currencyRestoreSql:legacyRestoreSql,{userId,trashId,archiveDigest});
  const out=run(`BEGIN ISOLATION LEVEL READ COMMITTED;\n${render(advisorySql,{userId,trashId})};\n${query};\nCOMMIT;`);
  const id=out.split("\n").map(line=>line.trim()).filter(Boolean).at(-1);
  return id&&/^\d+$/.test(id)?Number(id):null;
}
function diagnose(trashId:number,userId=PILOT){
  const values={userId,trashId};
  if(rows(render(needsNewRestoreSql,values)).length)return"needs-monetary-restore";
  if(rows(render(invalidArchiveSql,values)).length)return"needs-review";
  return rows(render(candidateSql,values)).length?"already-exists":"not-found";
}
/** The archive's real digest, read without the preflight's filters (as a caller that knew it). */
const knownDigest=(trashId:number)=>run(`SELECT md5(flight_data::text || expenses_data::text) FROM deleted_flights WHERE id=${trashId}`);
const comparableFlight=(id:number)=>run(`SELECT (to_jsonb(f)-'id')::text FROM flights f WHERE id=${id}`);
const archivedFlight=(trashId:number)=>run(`SELECT (flight_data-'id')::text FROM deleted_flights WHERE id=${trashId}`);

let nextFlight=500;
function draft(columns:Record<string,unknown>={},userId=PILOT){
  const id=++nextFlight;
  const all:Record<string,unknown>={date:"2026-10-12",evidence:"EASA",registration:`OK-T${id}`,aircraft_type:"C172",aircraft_make:"Cessna",aircraft_model:"172",aircraft_variant:"S",
    aircraft_class:"SEP",regulatory_category:"AEROPLANE",departure:"LKPR",arrival:"LKTB",off_block:"08:00",on_block:"09:00",starts:1,landings_day:1,role:"PIC",pic_minutes:60,...columns};
  run(`INSERT INTO flights(id,user_id,${Object.keys(all).join(",")}) VALUES(${id},${userId},${Object.values(all).map(literal).join(",")})`);
  return id;
}
/** An archive row written directly, for shapes the move transaction would never produce. */
function archive(flight:Record<string,unknown>,{tracks=[],expenses=[],userId=PILOT,expired=false}:{tracks?:unknown[];expenses?:unknown[];userId?:number;expired?:boolean}={}){
  const id=++nextFlight;
  const data={id,user_id:userId,date:"2026-09-01",registration:`OK-A${id}`,aircraft_make:"Piper",aircraft_model:"PA-28",aircraft_variant:"",departure:"LKPR",arrival:"LKPR",off_block:"10:00",record_revision:1,correction_reason:"",certified_at:null,locked_at:null,...flight};
  return Number(run(`INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data,tracks_data,expenses_data${expired?",purge_after":""})
    VALUES(${userId},${id},${literal(randomUUID())},${literal(JSON.stringify(data))}::jsonb,${literal(JSON.stringify(tracks))}::jsonb,${literal(JSON.stringify(expenses))}::jsonb${expired?",NOW()-INTERVAL '1 day'":""}) RETURNING id`));
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required");
  const optimization=blocks(read("lib/db-optimization.ts"));
  const ddl=(needle:string,which:"first"|"last"="first")=>{const found=optimization.filter(b=>b.includes(needle));const value=which==="last"?found.at(-1):found[0];assert.ok(value,needle);return value;};
  const v21Start=read("lib/db-optimization.ts").indexOf("  if(version===21)return[");
  const v21=blocks(read("lib/db-optimization.ts").slice(v21Start,read("lib/db-optimization.ts").indexOf("  ];\n  throw new Error(",v21Start))).slice(1);
  assert.equal(v21.length,8,"runtime v21 DDL changed: review this test");
  const result=rawPsql(`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),date TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',
      aircraft_type TEXT NOT NULL DEFAULT '',aircraft_make TEXT,aircraft_model TEXT,aircraft_variant TEXT,aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',
      balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',balloon_operation TEXT NOT NULL DEFAULT '',launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,
      departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',
      starts INTEGER NOT NULL DEFAULT 0,commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',
      price_per_hour DOUBLE PRECISION,billing_basis TEXT NOT NULL DEFAULT 'BLOCK',note TEXT NOT NULL DEFAULT '',
      operation_type TEXT NOT NULL DEFAULT 'SP',engine_type TEXT NOT NULL DEFAULT 'SE',operator_name TEXT NOT NULL DEFAULT '',flight_number TEXT NOT NULL DEFAULT '',operation_context TEXT NOT NULL DEFAULT '',
      landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,movement_evidence_recorded BOOLEAN NOT NULL DEFAULT FALSE,
      takeoffs_day INTEGER NOT NULL DEFAULT 0,takeoffs_night INTEGER NOT NULL DEFAULT 0,approaches_day INTEGER NOT NULL DEFAULT 0,approaches_night INTEGER NOT NULL DEFAULT 0,
      night_minutes INTEGER NOT NULL DEFAULT 0,ifr_minutes INTEGER NOT NULL DEFAULT 0,pic_minutes INTEGER NOT NULL DEFAULT 0,copilot_minutes INTEGER NOT NULL DEFAULT 0,dual_minutes INTEGER NOT NULL DEFAULT 0,instructor_minutes INTEGER NOT NULL DEFAULT 0,
      verification_name TEXT NOT NULL DEFAULT '',verification_reference TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,certified_by_user_id BIGINT,certification_hash TEXT NOT NULL DEFAULT '',certification_version INTEGER NOT NULL DEFAULT 8,
      locked_at TIMESTAMPTZ,locked_by_user_id BIGINT,record_revision INTEGER NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',
      correction_opened_at TIMESTAMPTZ,correction_opened_by_user_id BIGINT,
      UNIQUE(id,user_id)
    );
    CREATE TABLE rates(id BIGINT PRIMARY KEY,user_id BIGINT,registration TEXT,valid_from TEXT,price_per_hour DOUBLE PRECISION,dry_price_per_hour DOUBLE PRECISION,UNIQUE(user_id,registration,valid_from));
    CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY,user_id BIGINT,registration TEXT,aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',default_price_per_hour DOUBLE PRECISION);
    CREATE TABLE flight_expenses(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,category TEXT NOT NULL,label TEXT NOT NULL DEFAULT '',
      amount_minor BIGINT NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000),currency TEXT NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT flight_expenses_owner_flight_fk FOREIGN KEY(flight_id,user_id) REFERENCES flights(id,user_id) ON DELETE CASCADE
    );
    CREATE TABLE flight_tracks(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,file_name TEXT NOT NULL DEFAULT '',imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      point_count INTEGER NOT NULL DEFAULT 0,distance_km NUMERIC NOT NULL DEFAULT 0,start_utc TIMESTAMPTZ,end_utc TIMESTAMPTZ,min_alt_m NUMERIC,max_alt_m NUMERIC,
      coordinates_json TEXT NOT NULL DEFAULT '[]',overview_coordinates_json TEXT NOT NULL DEFAULT '[]',overview_version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE track_points(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,track_id BIGINT NOT NULL);
    CREATE TABLE flight_participations(id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT,participant_flight_id BIGINT);
    CREATE TABLE flight_connected_crew(id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT);
    CREATE TABLE flight_verifications(id BIGSERIAL PRIMARY KEY,flight_id BIGINT);
    CREATE TABLE instructor_flight_approvals(id BIGSERIAL PRIMARY KEY,flight_id BIGINT);
    CREATE TABLE flight_source_provenance(id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT,participant_flight_id BIGINT);
    CREATE TABLE flight_public_shares(id BIGSERIAL PRIMARY KEY,flight_id BIGINT);
    CREATE TABLE flight_certified_revisions(id BIGSERIAL PRIMARY KEY,flight_id BIGINT,user_id BIGINT,revision_number INTEGER,certification_hash TEXT);
    CREATE TABLE voided_certified_flights(id BIGSERIAL PRIMARY KEY,user_id BIGINT,original_flight_id BIGINT,record_revision INTEGER,certification_hash TEXT,created_txid BIGINT,flight_snapshot JSONB);
    ${ddl("CREATE TABLE IF NOT EXISTS deleted_flights")};
    ALTER TABLE deleted_flights ADD COLUMN IF NOT EXISTS expenses_data JSONB NOT NULL DEFAULT '[]'::jsonb;
    ${ddl("CREATE OR REPLACE FUNCTION logbook_protect_locked_flight()","last")};
    CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE OR DELETE ON flights FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight();
    BEGIN;
    ${v21.map(b=>b.trimEnd().replace(/;+$/,"")+";").join("\n")}
    COMMIT;
    INSERT INTO users(id) VALUES(${PILOT}),(${OTHER});
  `);
  if(result.status!==0)throw new Error(`Trash fixture setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("a v21 monetary draft with GPS and expenses round-trips through Trash exactly",{skip:!enabled},()=>{
  const id=draft({price_per_hour:1234.125,price_currency_code:"KWD",price_currency_minor_units:3,price_per_hour_decimal:"1234.125",billing_basis:"AIRBORNE",
    takeoff:"08:05",landing:"08:55",night_minutes:15,ifr_minutes:20,operation_type:"MP",engine_type:"ME",operator_name:"Example Air",flight_number:"EX501",operation_context:"CAT",
    role:"CO-PILOT",pic_minutes:0,copilot_minutes:60,commander:"Captain",purpose_code:"FCL140A",task:"Line check",note:"Remark",verification_name:"Verifier",verification_reference:"SIG-1",
    movement_evidence_recorded:true,takeoffs_day:1,approaches_day:1,landings_night:1,starts:2});
  run(`INSERT INTO flight_tracks(user_id,flight_id,file_name,imported_at,point_count,distance_km,start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,overview_coordinates_json,overview_version)
    VALUES(${PILOT},${id},'a.gpx','2026-10-12T10:00:00Z',3,12.5,'2026-10-12T08:05:00Z','2026-10-12T08:55:00Z',210,1450.5,'[[14.2,50.1],[14.3,50.2],[14.4,50.3]]','[[14.2,50.1],[14.4,50.3]]',2);
    INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency,amount_encoding,amount_minor_units,created_at) VALUES
      (${PILOT},${id},'LANDING','Fee',12345,'KWD','iso_minor_units',3,'2026-10-12T11:00:00Z'),
      (${PILOT},${id},'PARKING','Legacy',1255,'EUR','legacy_two_decimal',2,'2026-10-12T11:01:00Z'),
      (${PILOT},${id},'FUEL','Unencoded',500,'CZK',NULL,NULL,'2026-10-12T11:02:00Z');`);
  const before=comparableFlight(id);

  const trashId=moveToTrash(id);
  assert.ok(trashId);
  assert.equal(run(`SELECT COUNT(*) FROM flights WHERE id=${id}`),"0");
  assert.equal(run(`SELECT COUNT(*)||'|'||(SELECT COUNT(*) FROM flight_expenses WHERE flight_id=${id}) FROM flight_tracks WHERE flight_id=${id}`),"0|0");
  assert.equal(archivedFlight(trashId),before);

  // The legacy branch never restores monetary metadata; it is routed to the v21 branch.
  assert.equal(restore(trashId,"legacy"),null);
  assert.equal(diagnose(trashId),"needs-monetary-restore");

  const restoredId=restore(trashId,"currency");
  assert.ok(restoredId&&restoredId!==id);
  assert.equal(comparableFlight(restoredId),before,"every flight column, including exact currency, is restored");
  assert.deepEqual(rows(`SELECT price_currency_code,price_currency_minor_units,price_per_hour_decimal::text rate FROM flights WHERE id=${restoredId}`),[{price_currency_code:"KWD",price_currency_minor_units:3,rate:"1234.125"}]);
  assert.equal(run(`SELECT bool_and((to_jsonb(t)-'id'-'flight_id')=(j.value-'id'-'flight_id'))::text FROM flight_tracks t JOIN deleted_flights d ON d.restored_flight_id=t.flight_id CROSS JOIN LATERAL jsonb_array_elements(d.tracks_data) j WHERE d.id=${trashId}`),"true");
  assert.deepEqual(rows(`SELECT category,amount_minor,currency,amount_encoding,amount_minor_units FROM flight_expenses WHERE flight_id=${restoredId} ORDER BY created_at`),[
    {category:"LANDING",amount_minor:12345,currency:"KWD",amount_encoding:"iso_minor_units",amount_minor_units:3},
    {category:"PARKING",amount_minor:1255,currency:"EUR",amount_encoding:"legacy_two_decimal",amount_minor_units:2},
    {category:"FUEL",amount_minor:500,currency:"CZK",amount_encoding:null,amount_minor_units:null},
  ]);
  assert.equal(run(`SELECT restored_flight_id FROM deleted_flights WHERE id=${trashId} AND restored_at IS NOT NULL`),String(restoredId));
  // A restored archive cannot be restored a second time, even with its digest.
  assert.equal(restore(trashId,"currency",PILOT,knownDigest(trashId)),null);
  assert.equal(diagnose(trashId),"not-found");
  // Not even after the restored draft was deleted again: a used archive stays used.
  run(`DELETE FROM flights WHERE id=${restoredId}`);
  assert.equal(restore(trashId,"currency",PILOT,knownDigest(trashId)),null);
  assert.equal(run(`SELECT COUNT(*) FROM flights WHERE registration='OK-T${id}'`),"0");
});

test("the v21 restore is bound to the archive digest read by the preflight",{skip:!enabled},()=>{
  const id=draft({price_per_hour:1200,price_currency_code:"JPY",price_currency_minor_units:0,price_per_hour_decimal:"1200"});
  const trashId=moveToTrash(id);
  assert.ok(trashId);
  const digest=String(rows(render(preflightSql,{userId:PILOT,trashId}))[0]?.archive_digest);
  run(`UPDATE deleted_flights SET flight_data=jsonb_set(flight_data,'{price_per_hour_decimal}','"9999"') WHERE id=${trashId}`);
  assert.equal(restore(trashId,"currency",PILOT,digest),null);
  assert.equal(run(`SELECT (restored_at IS NULL)::text FROM deleted_flights WHERE id=${trashId}`),"true");
  assert.equal(run(`SELECT COUNT(*) FROM flights WHERE registration='OK-T${id}'`),"0");
});

test("a legacy draft without monetary metadata restores through the legacy branch",{skip:!enabled},()=>{
  const id=draft({price_per_hour:3060.25,regulatory_category:"BALLOON",balloon_class:"HOT_AIR_BALLOON",balloon_group:"B",balloon_operation:"TETHERED",launch_method:"WINCH",launches:2});
  run(`INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency) VALUES(${PILOT},${id},'LANDING','Fee',1000,'JPY')`);
  const before=comparableFlight(id);
  const trashId=moveToTrash(id);
  assert.ok(trashId);
  const restoredId=restore(trashId,"legacy");
  assert.ok(restoredId);
  assert.equal(comparableFlight(restoredId),before);
  assert.deepEqual(rows(`SELECT amount_minor,currency,amount_encoding FROM flight_expenses WHERE flight_id=${restoredId}`),[{amount_minor:1000,currency:"JPY",amount_encoding:null}]);
});

test("the legacy branch refuses any monetary metadata instead of dropping it",{skip:!enabled},()=>{
  const expense={id:1,user_id:PILOT,flight_id:0,category:"FEE",label:"",created_at:"2026-09-01T00:00:00Z",amount_minor:100,currency:"EUR"};
  const cases:Array<[string,number]>=[
    ["currency code only",archive({price_per_hour:100,price_currency_code:"EUR"})],
    ["minor units only",archive({price_per_hour:100,price_currency_minor_units:2})],
    ["exact rate only",archive({price_per_hour:100,price_per_hour_decimal:"100"})],
    ["encoded expense",archive({},{expenses:[{...expense,amount_encoding:"iso_minor_units",amount_minor_units:2}]})],
    ["expense precision only",archive({},{expenses:[{...expense,amount_minor_units:2}]})],
  ];
  run(`UPDATE deleted_flights SET expenses_data=jsonb_set(expenses_data,'{0,flight_id}',to_jsonb(original_flight_id)) WHERE jsonb_array_length(expenses_data)=1`);
  for(const [label,trashId] of cases){
    assert.equal(restore(trashId,"legacy"),null,label);
    assert.equal(diagnose(trashId),"needs-monetary-restore",label);
  }
});

test("a certified or locked flight never enters ordinary Trash",{skip:!enabled},()=>{
  const certified=draft({certified_at:"2026-10-12T12:00:00Z",certified_by_user_id:PILOT,certification_hash:"a".repeat(64),locked_at:"2026-10-12T12:00:00Z",locked_by_user_id:PILOT});
  const certifiedUnlocked=draft({certified_at:"2026-10-12T12:00:00Z",certified_by_user_id:PILOT,certification_hash:"b".repeat(64)});
  const locked=draft({locked_at:"2026-10-12T12:00:00Z",locked_by_user_id:PILOT});
  const revised=draft({record_revision:2});
  for(const id of [certified,certifiedUnlocked,locked,revised]){
    assert.equal(moveToTrash(id),null,String(id));
    assert.equal(run(`SELECT COUNT(*) FROM flights WHERE id=${id}`),"1");
  }
  assert.equal(moveToTrash(draft(),OTHER),null,"another pilot cannot trash the flight");
});

test("restore never recreates a flight that already exists in the logbook",{skip:!enabled},()=>{
  for(const branch of ["legacy","currency"] as const){
    const money=branch==="currency"?{price_per_hour:100,price_currency_code:"EUR",price_currency_minor_units:2,price_per_hour_decimal:"100"}:{};
    const id=draft(money);
    const trashId=moveToTrash(id);
    assert.ok(trashId);
    // The pilot re-entered the same flight (same date, registration, off-block and route).
    draft({registration:` ok-t${id} `,departure:"lkpr",arrival:"LKTB "});
    assert.equal(restore(trashId,branch),null,branch);
    assert.equal(run(`SELECT COUNT(*) FROM flights WHERE UPPER(TRIM(registration))='OK-T${id}'`),"1",branch);
    assert.equal(run(`SELECT (restored_at IS NULL)::text FROM deleted_flights WHERE id=${trashId}`),"true",branch);
    // Known gap: for a monetary archive the follow-up diagnostics report the monetary
    // restore message instead of "already exists"; nothing is written either way.
    if(branch==="legacy")assert.equal(diagnose(trashId),"already-exists");
  }
});

test("restore is owner-scoped and refuses expired archives",{skip:!enabled},()=>{
  const id=draft();
  const trashId=moveToTrash(id);
  assert.ok(trashId);
  for(const branch of ["currency","legacy"] as const)assert.equal(restore(trashId,branch,OTHER,knownDigest(trashId)),null);
  assert.equal(diagnose(trashId,OTHER),"not-found");
  assert.equal(run(`SELECT COUNT(*) FROM flights WHERE user_id=${OTHER}`),"0");
  const expired=archive({},{expired:true});
  for(const branch of ["currency","legacy"] as const)assert.equal(restore(expired,branch,PILOT,knownDigest(expired)),null);
  assert.equal(diagnose(expired),"not-found");
});

test("restore fails closed for archives that are not a plain owned draft",{skip:!enabled},()=>{
  run(`INSERT INTO aircraft(user_id,registration,aircraft_make,aircraft_model) VALUES(${PILOT},'OK-PROFILE','Diamond','DA40')`);
  const track=(trash:Record<string,unknown>)=>({id:9,user_id:PILOT,flight_id:trash.id,...trash});
  const cases:Array<[string,number]>=[
    ["certified",archive({certified_at:"2026-09-01T12:00:00Z"})],
    ["locked",archive({locked_at:"2026-09-01T12:00:00Z"})],
    ["later revision",archive({record_revision:2})],
    ["correction",archive({correction_reason:"Corrected"})],
    ["another owner in the snapshot",archive({user_id:OTHER})],
    ["missing aircraft identity keys",archive({aircraft_make:undefined})],
    ["blank identity with a legacy type",archive({aircraft_make:"",aircraft_model:"",aircraft_variant:"",aircraft_type:"C152"})],
    ["blank identity the current profile would fill",archive({aircraft_make:"",aircraft_model:"",aircraft_variant:"",registration:"ok-profile"})],
    ["track of another flight",archive({},{tracks:[track({flight_id:1})]})],
    ["expense of another owner",archive({},{expenses:[{id:1,user_id:OTHER,flight_id:0,category:"FEE",label:"",created_at:"2026-09-01T00:00:00Z",amount_minor:100,currency:"EUR"}]})],
    ["expense with a lowercase currency",archive({},{expenses:[{id:1,user_id:PILOT,flight_id:0,category:"FEE",label:"",created_at:"2026-09-01T00:00:00Z",amount_minor:100,currency:"eur"}]})],
    ["expense with a zero amount",archive({},{expenses:[{id:1,user_id:PILOT,flight_id:0,category:"FEE",label:"",created_at:"2026-09-01T00:00:00Z",amount_minor:0,currency:"EUR"}]})],
  ];
  // Expense ownership must match the archive's original flight id.
  run(`UPDATE deleted_flights SET expenses_data=jsonb_set(expenses_data,'{0,flight_id}',to_jsonb(original_flight_id)) WHERE jsonb_array_length(expenses_data)=1`);
  const revisioned=archive({});
  run(`INSERT INTO flight_certified_revisions(flight_id,user_id,revision_number,certification_hash) SELECT original_flight_id,user_id,1,'h' FROM deleted_flights WHERE id=${revisioned}`);
  cases.push(["certified history",revisioned]);
  const flightsBefore=run(`SELECT COUNT(*) FROM flights`);
  for(const [label,trashId] of cases){
    for(const branch of ["currency","legacy"] as const)assert.equal(restore(trashId,branch),null,`${label} (${branch})`);
    assert.equal(diagnose(trashId),"needs-review",label);
  }
  assert.equal(run(`SELECT COUNT(*) FROM flights`),flightsBefore);
  assert.equal(run(`SELECT COUNT(*) FROM deleted_flights WHERE restored_at IS NOT NULL AND id IN (${cases.map(c=>c[1]).join(",")})`),"0");
  // A well-formed archive written the same way does restore, so the refusals above are the guards.
  const valid=archive({},{expenses:[{id:1,user_id:PILOT,flight_id:0,category:"FEE",label:"",created_at:"2026-09-01T00:00:00Z",amount_minor:100,currency:"EUR"}]});
  run(`UPDATE deleted_flights SET expenses_data=jsonb_set(expenses_data,'{0,flight_id}',to_jsonb(original_flight_id)) WHERE id=${valid}`);
  assert.ok(restore(valid,"legacy"));
});
