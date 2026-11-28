import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { before,test } from "node:test";
import { bootstrapProductionSchema,importServerModule } from "./server-modules.ts";

// Behavioural test of the Trash service: it calls the real moveFlightToTrash() and
// restoreDeletedFlightRecord() from lib/flight-trash.ts on the full production-like v21 schema,
// including the TypeScript currency validation in front of the monetary restore branch and
// the order of the error diagnostics. The SQL branches themselves are exercised in detail by
// tests/integration/postgres-trash-roundtrip.test.ts.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const PILOT=9001,OTHER=9002;
const INVALID_MONEY="Archived flight currency metadata is incomplete or invalid.";

type Trash={
  moveFlightToTrash:(userId:number,flightId:number)=>Promise<boolean>;
  restoreDeletedFlightRecord:(userId:number,trashId:number)=>Promise<{flightId?:number;error?:string}>;
};
let trash:Trash;

function psql(statement:string){
  const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
  if(result.error)throw result.error;
  assert.equal(result.status,0,`PostgreSQL command failed:\n${result.stderr||result.stdout}`);
  return String(result.stdout??"").trim();
}
const literal=(v:string|number|null)=>v===null?"NULL":typeof v==="number"?String(v):`'${v.replaceAll("'","''")}'`;

let next=9500;
function draft(columns:Record<string,string|number|null>={},userId=PILOT){
  const id=++next;
  const all:Record<string,string|number|null>={date:"2026-10-21",evidence:"EASA",registration:`OK-R${id}`,aircraft_type:"B23",aircraft_make:"BRM Aero",aircraft_model:"Bristell B23",
    aircraft_class:"SEP",regulatory_category:"AEROPLANE",departure:"LKLT",arrival:"LKPR",off_block:"11:00",on_block:"12:00",role:"PIC",starts:1,landings_day:1,...columns};
  psql(`INSERT INTO flights(id,user_id,${Object.keys(all).join(",")}) VALUES(${id},${userId},${Object.values(all).map(literal).join(",")})`);
  return id;
}
const trashIdOf=(flightId:number)=>Number(psql(`SELECT id FROM deleted_flights WHERE original_flight_id=${flightId} ORDER BY id DESC LIMIT 1`));
/** An archive written directly, for monetary shapes the move transaction would never produce. */
function archive(flight:Record<string,unknown>,expenses:unknown[]=[]){
  const id=++next;
  const data={id,user_id:PILOT,date:"2026-09-01",registration:`OK-A${id}`,aircraft_make:"Piper",aircraft_model:"PA-28",aircraft_variant:"",departure:"LKPR",arrival:"LKPR",off_block:"10:00",
    record_revision:1,correction_reason:"",certified_at:null,locked_at:null,price_per_hour:100,...flight};
  const rows=expenses.map((e,index)=>({id:index+1,user_id:PILOT,flight_id:id,category:"FEE",label:"",created_at:"2026-09-01T00:00:00Z",amount_minor:100,currency:"EUR",...(e as object)}));
  return Number(psql(`INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data,tracks_data,expenses_data)
    VALUES(${PILOT},${id},'${randomUUID()}',${literal(JSON.stringify(data))}::jsonb,'[]'::jsonb,${literal(JSON.stringify(rows))}::jsonb) RETURNING id`));
}
const flightCount=()=>psql(`SELECT COUNT(*) FROM flights`);

before(async()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required");
  bootstrapProductionSchema();
  trash=await importServerModule<Trash>("lib/flight-trash.ts");
});

test("a monetary draft moves to Trash and restores with exact currency through the real service",{skip:!enabled},async()=>{
  const id=draft({billing_basis:"BLOCK",price_per_hour:1234.125,price_currency_code:"KWD",price_currency_minor_units:3,price_per_hour_decimal:"1234.125"});
  psql(`INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency,amount_encoding,amount_minor_units) VALUES(${PILOT},${id},'LANDING','Fee',12345,'KWD','iso_minor_units',3)`);
  assert.equal(await trash.moveFlightToTrash(OTHER,id),false,"another pilot cannot trash the flight");
  assert.equal(await trash.moveFlightToTrash(PILOT,id),true);
  assert.equal(psql(`SELECT COUNT(*) FROM flights WHERE id=${id}`),"0");
  const trashId=trashIdOf(id);
  assert.deepEqual(await trash.restoreDeletedFlightRecord(OTHER,trashId),{error:"Deleted flight was not found or has expired."});
  const restored=await trash.restoreDeletedFlightRecord(PILOT,trashId);
  assert.ok(restored.flightId,JSON.stringify(restored));
  assert.equal(psql(`SELECT price_currency_code||':'||price_currency_minor_units||':'||price_per_hour_decimal::text FROM flights WHERE id=${restored.flightId}`),"KWD:3:1234.125");
  assert.equal(psql(`SELECT amount_minor||':'||amount_encoding||':'||amount_minor_units FROM flight_expenses WHERE flight_id=${restored.flightId}`),"12345:iso_minor_units:3");
  assert.deepEqual(await trash.restoreDeletedFlightRecord(PILOT,trashId),{error:"Deleted flight was not found or has expired."});
});

test("a certified flight never enters ordinary Trash",{skip:!enabled},async()=>{
  const id=draft();
  psql(`UPDATE flights SET certified_at=NOW(),certified_by_user_id=${PILOT},certification_hash=repeat('c',64),locked_at=NOW(),locked_by_user_id=${PILOT} WHERE id=${id}`);
  assert.equal(await trash.moveFlightToTrash(PILOT,id),false);
  assert.equal(psql(`SELECT COUNT(*) FROM flights WHERE id=${id}`),"1");
  assert.equal(psql(`SELECT COUNT(*) FROM deleted_flights WHERE original_flight_id=${id}`),"0");
});

test("monetary metadata that is incomplete or not a supported ISO tuple is refused before any write",{skip:!enabled},async()=>{
  const cases:Array<[string,number,string]>=[
    ["unknown currency",archive({price_currency_code:"XXQ",price_currency_minor_units:2,price_per_hour_decimal:"100"}),INVALID_MONEY],
    ["wrong minor units",archive({price_currency_code:"KWD",price_currency_minor_units:2,price_per_hour_decimal:"100"}),INVALID_MONEY],
    ["exponent rate",archive({price_currency_code:"EUR",price_currency_minor_units:2,price_per_hour_decimal:"1e6"}),INVALID_MONEY],
    ["zero rate",archive({price_currency_code:"EUR",price_currency_minor_units:2,price_per_hour_decimal:"0"}),INVALID_MONEY],
    ["missing legacy rate",archive({price_currency_code:"EUR",price_currency_minor_units:2,price_per_hour_decimal:"100",price_per_hour:null}),INVALID_MONEY],
    ["code without rate",archive({price_currency_code:"EUR"}),INVALID_MONEY],
    ["expense precision without encoding",archive({},[{amount_minor_units:2}]),"Archived expense precision is incomplete."],
    ["legacy expense with wrong precision",archive({},[{amount_encoding:"legacy_two_decimal",amount_minor_units:3}]),"Archived legacy expense precision is invalid."],
    ["ISO expense with wrong precision",archive({},[{amount_encoding:"iso_minor_units",amount_minor_units:2,currency:"JPY"}]),"Archived expense currency or precision is invalid."],
    ["unknown expense encoding",archive({},[{amount_encoding:"cents",amount_minor_units:2}]),"Archived expense amount encoding is invalid."],
  ];
  const before=flightCount();
  for(const [label,trashId,error] of cases){
    assert.deepEqual(await trash.restoreDeletedFlightRecord(PILOT,trashId),{error},label);
    assert.equal(psql(`SELECT (restored_at IS NULL)::text FROM deleted_flights WHERE id=${trashId}`),"true",label);
  }
  assert.equal(flightCount(),before,"no flight was written");
  // A valid tuple written the same way restores, so the refusals above are the validation.
  const valid=archive({price_currency_code:"JPY",price_currency_minor_units:0,price_per_hour_decimal:"1200"},[{amount_encoding:"iso_minor_units",amount_minor_units:0,currency:"JPY"}]);
  assert.ok((await trash.restoreDeletedFlightRecord(PILOT,valid)).flightId);
});

test("the pilot is told the real reason a restore did not happen",{skip:!enabled},async()=>{
  // A monetary flight that was re-entered meanwhile already exists.
  const id=draft({billing_basis:"BLOCK",price_per_hour:100,price_currency_code:"EUR",price_currency_minor_units:2,price_per_hour_decimal:"100"});
  assert.equal(await trash.moveFlightToTrash(PILOT,id),true);
  draft({registration:`OK-R${id}`});
  assert.deepEqual(await trash.restoreDeletedFlightRecord(PILOT,trashIdOf(id)),{error:"This flight already exists in the logbook."});
  // A legacy draft that already exists.
  const legacy=draft();
  assert.equal(await trash.moveFlightToTrash(PILOT,legacy),true);
  draft({registration:`OK-R${legacy}`});
  assert.deepEqual(await trash.restoreDeletedFlightRecord(PILOT,trashIdOf(legacy)),{error:"This flight already exists in the logbook."});
  // An archive that is not a plain owned draft needs review.
  assert.deepEqual(await trash.restoreDeletedFlightRecord(PILOT,archive({certified_at:"2026-09-01T12:00:00Z"})),{error:"Archived flight data needs review before it can be restored."});
  // An expired archive is gone.
  const expired=archive({});
  psql(`UPDATE deleted_flights SET purge_after=NOW()-INTERVAL '1 day' WHERE id=${expired}`);
  assert.deepEqual(await trash.restoreDeletedFlightRecord(PILOT,expired),{error:"Deleted flight was not found or has expired."});
});
