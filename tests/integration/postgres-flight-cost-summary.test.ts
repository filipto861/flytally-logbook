import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";
import { presentFlightCostSummary } from "../../lib/flight-cost-summary.ts";

// Behavioural replacement for regex checks of the flight-list cost aggregator.
// Runs the real production SQL from lib/data/flights-fast.ts against a small,
// deterministic fixture and checks what the pilot would actually see.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_cost_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const PILOT=81,OTHER=82;

function rawPsql(statement:string){
  const result=spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt"],{input:statement,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:16*1024*1024});
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
function literal(value:unknown){
  if(value===null||value===undefined)return"NULL";
  if(typeof value==="number")return String(value);
  return`'${String(value).replaceAll("'","''")}'`;
}
function listQuery(values:Record<string,unknown>){
  const source=read("lib/data/flights-fast.ts");
  const block=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(m=>m[1]).find(b=>b.includes("cost_totals AS ("));
  assert.ok(block,"flight list SQL with cost_totals not found in lib/data/flights-fast.ts");
  const defaults={userId:PILOT,q:null,e:null,r:null,reg:null,from:null,to:null,c:null,a:null,route:null,rf:null,rt:null,y:null,g:null,status:null,workflow:null,category:null,sort:"newest",size:50,offset:0};
  const all:Record<string,unknown>={...defaults,...values};
  const rendered=block.replace(/\$\{([^}]+)\}/g,(_m,expr)=>{
    const key=String(expr).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(all,key),`No test value for ${key}`);
    return literal(all[key]);
  });
  return rows(rendered);
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required");
  const insert=(user:number,count:number,fields:string,values:string)=>`INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_class,departure,arrival,role,${fields}) SELECT ${user},DATE '2026-01-01'+g,'EASA','OK-COST','B23','SEP','LKPR','LKTB','PIC',${values} FROM generate_series(1,${count}) g;`;
  const result=rawPsql(`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '');
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date DATE,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',aircraft_type TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',
      aircraft_make TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_variant TEXT NOT NULL DEFAULT '',departure TEXT NOT NULL DEFAULT '',arrival TEXT NOT NULL DEFAULT '',off_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,takeoffs_day INTEGER NOT NULL DEFAULT 0,takeoffs_night INTEGER NOT NULL DEFAULT 0,balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',balloon_operation TEXT NOT NULL DEFAULT '',
      starts INTEGER NOT NULL DEFAULT 0,commander TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',purpose_code TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',
      price_per_hour NUMERIC,price_currency_code TEXT,price_currency_minor_units SMALLINT,price_per_hour_decimal NUMERIC,billing_basis TEXT NOT NULL DEFAULT 'BLOCK',operation_type TEXT NOT NULL DEFAULT 'SP',engine_type TEXT NOT NULL DEFAULT 'SE',landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,
      night_minutes INTEGER NOT NULL DEFAULT 0,ifr_minutes INTEGER NOT NULL DEFAULT 0,pic_minutes INTEGER NOT NULL DEFAULT 0,copilot_minutes INTEGER NOT NULL DEFAULT 0,dual_minutes INTEGER NOT NULL DEFAULT 0,instructor_minutes INTEGER NOT NULL DEFAULT 0,
      verification_name TEXT NOT NULL DEFAULT '',verification_reference TEXT NOT NULL DEFAULT '',certified_at TIMESTAMPTZ,certification_hash TEXT NOT NULL DEFAULT '',record_revision INTEGER NOT NULL DEFAULT 1,correction_reason TEXT NOT NULL DEFAULT '',locked_at TIMESTAMPTZ
    );
    CREATE TABLE flight_tracks(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,flight_id BIGINT NOT NULL,file_name TEXT NOT NULL DEFAULT '',distance_km NUMERIC NOT NULL DEFAULT 0);
    CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,registration TEXT NOT NULL,icao_type TEXT NOT NULL DEFAULT '');
    CREATE TABLE flight_participations(
      id BIGSERIAL PRIMARY KEY,source_flight_id BIGINT NOT NULL,source_user_id BIGINT NOT NULL,participant_user_id BIGINT NOT NULL,participant_role TEXT NOT NULL,
      source_revision INTEGER NOT NULL,source_hash TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',participant_flight_id BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE flight_verifications(
      id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,flight_user_id BIGINT NOT NULL,signer_user_id BIGINT,verification_role TEXT NOT NULL,record_revision INTEGER NOT NULL,flight_hash TEXT NOT NULL,
      credential_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,status TEXT NOT NULL DEFAULT 'signed',signed_at TIMESTAMPTZ
    );
    INSERT INTO users(id,display_name) VALUES(${PILOT},'Cost Pilot'),(${OTHER},'Other Pilot');
    -- 40 known CZK flights: 30 min at 100.01/h = 50.005 -> 50.01 each (rounded per flight).
    ${insert(PILOT,40,"off_block,on_block,billing_basis,price_currency_code,price_currency_minor_units,price_per_hour_decimal","'08:00','08:30','BLOCK','CZK',2,100.01")}
    -- 15 known JPY flights: 30 min at 1001/h = 500.5 -> 501 each.
    ${insert(PILOT,15,"off_block,on_block,billing_basis,price_currency_code,price_currency_minor_units,price_per_hour_decimal","'09:00','09:30','BLOCK','JPY',0,1001")}
    -- 3 flights where cost is not tracked (empty billing basis).
    ${insert(PILOT,3,"off_block,on_block,billing_basis","'10:00','10:30',''")}
    -- 2 legacy flights with no recorded currency: unknown, never priced as zero or CZK.
    ${insert(PILOT,2,"off_block,on_block,billing_basis,price_per_hour,price_currency_code,price_currency_minor_units,price_per_hour_decimal","'11:00','11:30','BLOCK',2500,NULL,NULL,NULL")}
    -- 2 flights with a priced rate but no valid block times: invalid.
    ${insert(PILOT,2,"off_block,on_block,billing_basis,price_currency_code,price_currency_minor_units,price_per_hour_decimal","'','','BLOCK','CZK',2,100.00")}
    -- Another pilot's expensive flights must never leak into the totals.
    ${insert(OTHER,30,"off_block,on_block,billing_basis,price_currency_code,price_currency_minor_units,price_per_hour_decimal","'08:00','09:00','BLOCK','CZK',2,9999.00")}
    ANALYZE;
  `);
  if(result.status!==0)throw new Error(`fixture setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("flight list cost summary covers the whole selection, not just the visible page",{skip:!enabled},()=>{
  const page=listQuery({size:50,offset:0});
  assert.equal(page.length,50,"first page is paginated");
  const row=page[0];
  assert.equal(Number(row.total_count),62);
  const groups=row.summary_cost_groups as Array<{currency:string;minorUnits:number;minor:string;flights:number}>;
  // Exact minor units, rounded per flight before summing: 40 x 50.01 CZK and 15 x 501 JPY.
  assert.deepEqual(groups,[
    {currency:"CZK",minorUnits:2,minor:"200040",flights:40},
    {currency:"JPY",minorUnits:0,minor:"7515",flights:15},
  ]);
  assert.equal(Number(row.summary_cost_not_tracked),3);
  assert.equal(Number(row.summary_cost_unknown),2);
  assert.equal(Number(row.summary_cost_invalid),2);
  // The last page reports the same totals as the first.
  const last=listQuery({size:50,offset:50});
  assert.equal(last.length,12);
  assert.deepEqual(last[0].summary_cost_groups,groups);
});

test("flight list cost summary is scoped to the signed-in pilot",{skip:!enabled},()=>{
  const other=listQuery({userId:OTHER,size:50,offset:0});
  assert.equal(Number(other[0].total_count),30);
  assert.deepEqual(other[0].summary_cost_groups,[{currency:"CZK",minorUnits:2,minor:"29997000",flights:30}]);
  const mine=listQuery({size:50,offset:0});
  assert.ok(!(mine[0].summary_cost_groups as Array<{minor:string}>).some(g=>g.minor==="29997000"));
});

test("presented summary keeps currencies apart and never turns unknown or invalid costs into zero",{skip:!enabled},()=>{
  const row=listQuery({size:50,offset:0})[0];
  const summary=presentFlightCostSummary(
    row.summary_cost_groups as Parameters<typeof presentFlightCostSummary>[0],
    Number(row.total_count),Number(row.summary_cost_not_tracked),Number(row.summary_cost_unknown),Number(row.summary_cost_invalid),
  );
  assert.equal(summary.headline,"Multiple currencies");
  assert.deepEqual(summary.breakdown,["2,000.40 CZK","7,515 JPY"]);
  assert.equal(summary.pricedFlights,55);
  assert.equal(summary.complete,false);
});
