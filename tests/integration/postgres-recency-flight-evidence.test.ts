import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";
import { cookSql } from "./production-sql.ts";

// Behavioural test of the flight-evidence queries behind every recency view. It runs the
// production SQL from the recency services and the credentials page against one fixture:
// only the pilot's own certified flights in the rule window count, instructor evidence is
// bound to the exact certified revision and hash, legacy-movement provenance follows the
// creation audit, and current aircraft profiles never rewrite historical flight data.
const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const root=path.resolve(import.meta.dirname,"../..");
const schema=`ft_recency_${randomUUID().replaceAll("-","")}`;
const quotedSchema=`"${schema}"`;
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const PILOT=41,OTHER=42,LAPL=43,CATEGORY=44;

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
function flightQuery(file:string){
  const block=[...read(file).matchAll(/sql`([\s\S]*?)`/g)].map(m=>cookSql(m[1])).find(b=>b.includes("FROM flights f"));
  assert.ok(block,`flight evidence query not found in ${file}`);
  return (values:Record<string,number>)=>rows(block.replace(/\$\{([^}]+)\}/g,(_m,expr)=>{
    const key=String(expr).trim();
    assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No test value for \${${key}} in ${file}`);
    return String(values[key]);
  }));
}
const aeroplaneRecency=flightQuery("lib/recency-service.ts");
const aeroplaneAudit=flightQuery("lib/recency-audit-service.ts");
const sailplaneRecency=flightQuery("lib/spl-recency-service.ts");
const balloonRecency=flightQuery("lib/balloon-recency-service.ts");
const helicopterRecency=flightQuery("lib/helicopter-recency-service.ts");
const laplTotals=flightQuery("app/(protected)/credentials/legacy-page.tsx");

const daysAgo=(days:number)=>`(CURRENT_DATE-${days})::text`;
type Flight={id:number;user?:number;date:string;certified?:boolean;revision?:number;hash?:string;[column:string]:unknown};
function insertFlights(list:Flight[]){
  return list.map(({id,user=PILOT,date,certified=true,revision=1,hash=`hash-${id}`,...columns})=>{
    const names=["id","user_id","date","certified_at","record_revision","certification_hash",...Object.keys(columns)];
    const values=[String(id),String(user),date,certified?"NOW()":"NULL",String(revision),`'${hash}'`,...Object.values(columns).map(v=>typeof v==="number"?String(v):`'${String(v).replaceAll("'","''")}'`)];
    return`INSERT INTO flights(${names.join(",")}) VALUES(${values.join(",")});`;
  }).join("\n");
}
function signed(flightId:number,{user=PILOT,revision=1,hash=`hash-${flightId}`,role="INSTRUCTOR",status="signed"}:{user?:number;revision?:number;hash?:string;role?:string;status?:string}={}){
  return`INSERT INTO flight_verifications(flight_id,flight_user_id,verification_role,record_revision,flight_hash,status) VALUES(${flightId},${user},'${role}',${revision},'${hash}','${status}');`;
}
const byNote=(list:Array<Record<string,unknown>>)=>Object.fromEntries(list.map(row=>[String(row.note),row]));

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required");
  const optimization=[...read("lib/db-optimization.ts").matchAll(/sql`([\s\S]*?)`/g)].map(m=>cookSql(m[1]));
  const ddl=(needle:string)=>{const found=optimization.find(b=>b.includes(needle));assert.ok(found,needle);return found;};
  const aeroplane=(id:number,note:string,extra:Partial<Flight>={}):Flight=>({id,date:daysAgo(10),note,evidence:"EASA",registration:"OK-AAA",aircraft_class:"SEP",regulatory_category:"AEROPLANE",role:"PIC",off_block:"08:00",on_block:"09:00",starts:1,landings_day:1,...extra});
  const result=rawPsql(`
    CREATE SCHEMA ${quotedSchema};
    SET search_path TO ${quotedSchema};
    CREATE TABLE users(id BIGINT PRIMARY KEY);
    CREATE TABLE flights(
      id BIGINT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),date TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '',registration TEXT NOT NULL DEFAULT '',
      aircraft_type TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',
      balloon_class TEXT NOT NULL DEFAULT '',balloon_group TEXT NOT NULL DEFAULT '',balloon_operation TEXT NOT NULL DEFAULT '',launch_method TEXT NOT NULL DEFAULT '',launches INTEGER NOT NULL DEFAULT 0,
      departure TEXT NOT NULL DEFAULT 'LKPR',arrival TEXT NOT NULL DEFAULT 'LKPR',off_block TEXT NOT NULL DEFAULT '',on_block TEXT NOT NULL DEFAULT '',takeoff TEXT NOT NULL DEFAULT '',landing TEXT NOT NULL DEFAULT '',
      starts INTEGER NOT NULL DEFAULT 0,role TEXT NOT NULL DEFAULT '',landings_day INTEGER NOT NULL DEFAULT 0,landings_night INTEGER NOT NULL DEFAULT 0,
      movement_evidence_recorded BOOLEAN NOT NULL DEFAULT FALSE,takeoffs_day INTEGER NOT NULL DEFAULT 0,takeoffs_night INTEGER NOT NULL DEFAULT 0,approaches_day INTEGER NOT NULL DEFAULT 0,approaches_night INTEGER NOT NULL DEFAULT 0,
      purpose_code TEXT NOT NULL DEFAULT '',task TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',verification_name TEXT NOT NULL DEFAULT '',verification_reference TEXT NOT NULL DEFAULT '',
      certified_at TIMESTAMPTZ,certification_hash TEXT NOT NULL DEFAULT '',record_revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE aircraft(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,registration TEXT NOT NULL,aircraft_type TEXT NOT NULL DEFAULT '',aircraft_model TEXT NOT NULL DEFAULT '',
      aircraft_class TEXT NOT NULL DEFAULT '',regulatory_category TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,
      part_fcl_credit_class TEXT NOT NULL DEFAULT '',part_fcl_credit_basis TEXT NOT NULL DEFAULT '',part_fcl_credit_from TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE flytally_feature_migrations(migration_key TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ${ddl("CREATE TABLE IF NOT EXISTS flight_audit_log")};
    ${ddl("CREATE TABLE IF NOT EXISTS flight_verifications")};
    INSERT INTO users(id) VALUES(${PILOT}),(${OTHER}),(${LAPL}),(${CATEGORY});
    INSERT INTO flytally_feature_migrations VALUES('v1.35.3-fcl060-structured-movements',NOW()-INTERVAL '100 days');

    -- Aeroplane evidence for the FCL.060 / FCL.140.A / FCL.740.A services.
    ${insertFlights([
      aeroplane(101,"signed",{registration:" ok-aaa "}),
      aeroplane(102,"signed-older-revision",{revision:2}),
      aeroplane(103,"signed-other-hash"),
      aeroplane(104,"supervising-pic"),
      aeroplane(105,"pending"),
      aeroplane(106,"signature-other-account"),
      aeroplane(107,"draft",{certified:false}),
      aeroplane(108,"800-days",{date:daysAgo(800)}),
      aeroplane(109,"malformed-date",{date:"2026-13"}),
      aeroplane(110,"other-pilot",{user:OTHER}),
      aeroplane(111,"other-pilot-aircraft",{registration:"OK-BBB"}),
      aeroplane(112,"typed-instructor-only",{role:"DUAL",instructor:"Typed FI",verification_name:"Typed FI",verification_reference:"paper-sign-112"}),
    ])}
    ${signed(101)}
    ${signed(102,{revision:1})}
    ${signed(103,{hash:"hash-of-another-revision"})}
    ${signed(104,{role:"SUPERVISING PIC"})}
    ${signed(105,{status:"pending"})}
    ${signed(106,{user:OTHER})}
    INSERT INTO aircraft(user_id,registration,aircraft_class,regulatory_category,part_fcl_credit_class,part_fcl_credit_basis,part_fcl_credit_from) VALUES
      (${PILOT},'OK-AAA','TMG','SAILPLANE','SEP','TYPE_CERTIFICATE','2025-01-01'),
      (${OTHER},'OK-BBB','SEP','AEROPLANE','SEP','OTHER_PILOT','2024-01-01');
    -- Creation provenance: 101 before the structured-movement release, 102 after it,
    -- 103 created before and edited after, 104 has only another account's audit row.
    INSERT INTO flight_audit_log(flight_id,user_id,action,new_data,changed_at) VALUES
      (101,${PILOT},'created','{}',NOW()-INTERVAL '200 days'),
      (102,${PILOT},'created','{"movement_evidence_recorded":false}',NOW()-INTERVAL '50 days'),
      (103,${PILOT},'created','{}',NOW()-INTERVAL '200 days'),
      (103,${PILOT},'updated','{"movement_evidence_recorded":false}',NOW()-INTERVAL '40 days'),
      (104,${OTHER},'created','{}',NOW()-INTERVAL '50 days');

    -- Category services: each window, category filter and snapshot type resolution.
    ${insertFlights([
      {user:CATEGORY,id:201,date:daysAgo(100),note:"spl",regulatory_category:"SAILPLANE",role:"PIC",launch_method:"WINCH",launches:1},
      {user:CATEGORY,id:202,date:daysAgo(800),note:"spl-old",regulatory_category:"SAILPLANE",role:"PIC"},
      {user:CATEGORY,id:204,date:daysAgo(120),note:"spl-signed-older-revision",regulatory_category:"SAILPLANE",role:"DUAL",revision:2},
      {user:CATEGORY,id:203,date:daysAgo(100),note:"spl-draft",certified:false,regulatory_category:"SAILPLANE",role:"PIC"},
      {user:CATEGORY,id:211,date:daysAgo(1100),note:"bpl",regulatory_category:"BALLOON",role:"PIC",balloon_class:"HOT_AIR_BALLOON"},
      {user:CATEGORY,id:212,date:daysAgo(1500),note:"bpl-old",regulatory_category:"BALLOON",role:"PIC"},
      {user:CATEGORY,id:221,date:daysAgo(200),note:"hel-model",regulatory_category:"HELICOPTER",registration:"OK-HEL",aircraft_type:"R44 legacy label",aircraft_model:"R44 Raven II",role:"PIC"},
      {user:CATEGORY,id:222,date:daysAgo(210),note:"hel-type",regulatory_category:"HELICOPTER",registration:"OK-HEL",aircraft_type:"R44 legacy label",role:"PIC"},
      {user:CATEGORY,id:223,date:daysAgo(220),note:"hel-none",regulatory_category:"HELICOPTER",registration:"OK-HEL",role:"PIC"},
      {user:CATEGORY,id:225,date:daysAgo(230),note:"hel-draft",certified:false,regulatory_category:"HELICOPTER",registration:"OK-HEL",role:"PIC"},
      {user:CATEGORY,id:224,date:daysAgo(400),note:"hel-old",regulatory_category:"HELICOPTER",registration:"OK-HEL",role:"PIC"},
    ])}
    ${signed(201,{user:CATEGORY})}
    ${signed(204,{user:CATEGORY,revision:1})}
    ${signed(211,{user:CATEGORY,revision:2})}
    INSERT INTO aircraft(user_id,registration,aircraft_model,regulatory_category) VALUES(${CATEGORY},'OK-HEL','H145','HELICOPTER');

    -- LAPL(A) totals on the credentials page.
    ${insertFlights([
      {id:301,user:LAPL,date:daysAgo(30),evidence:"EASA",aircraft_class:"SEP",role:"PIC",off_block:"08:00",on_block:"09:00",landings_day:2,landings_night:1},
      {id:302,user:LAPL,date:daysAgo(40),evidence:"EASA",aircraft_class:"TMG",role:"DUAL",off_block:"23:30",on_block:"00:15",landings_day:1,purpose_code:"LAPL_FCL140A_REFRESHER"},
      {id:303,user:LAPL,date:daysAgo(50),evidence:"EASA",aircraft_class:"SEP",role:"DUAL",off_block:"10:00",on_block:"10:30",landings_day:1,task:"LAPL recency training",revision:2},
      {id:304,user:LAPL,date:daysAgo(55),evidence:"EASA",aircraft_class:"SEP",role:"DUAL",off_block:"11:00",on_block:"11:25",landings_day:1,task:"Refresher training"},
      {id:305,user:LAPL,date:daysAgo(56),evidence:"EASA",aircraft_class:"SEP",role:"DUAL",off_block:"12:00",on_block:"12:10",purpose_code:"OTHER_PURPOSE",task:"FCL.140.A"},
      {id:306,user:LAPL,date:daysAgo(60),evidence:"ULL",aircraft_class:"ULL",role:"PIC",off_block:"13:00",on_block:"13:20",landings_day:1},
      {id:307,user:LAPL,date:daysAgo(60),evidence:"EASA",aircraft_class:"SEP",role:"PIC",off_block:"8:00",on_block:"09:00",landings_day:2,landings_night:-3},
      {id:308,user:LAPL,date:daysAgo(60),evidence:"EASA",aircraft_class:"MEP",role:"PIC",off_block:"08:00",on_block:"09:00",landings_day:1},
      {id:309,user:LAPL,date:daysAgo(60),evidence:"EASA",aircraft_class:"SEP",role:"SPIC",off_block:"08:00",on_block:"09:00",landings_day:1},
      {id:310,user:LAPL,date:daysAgo(60),certified:false,evidence:"EASA",aircraft_class:"SEP",role:"PIC",off_block:"08:00",on_block:"09:00",landings_day:1},
      {id:312,user:LAPL,date:daysAgo(65),evidence:"ULL",aircraft_class:"SEP",role:"DUAL",off_block:"14:00",on_block:"14:15",purpose_code:"LAPL_FCL140A_REFRESHER"},
      {id:311,user:LAPL,date:daysAgo(800),evidence:"EASA",aircraft_class:"SEP",role:"PIC",off_block:"08:00",on_block:"09:00",landings_day:1},
    ])}
    ${signed(302,{user:LAPL})}
    ${signed(303,{user:LAPL,revision:1})}
    ${signed(304,{user:LAPL})}
    ${signed(305,{user:LAPL})}
    ${signed(312,{user:LAPL})}
  `);
  if(result.status!==0)throw new Error(`Recency fixture setup failed:\n${result.stderr||result.stdout}`);
});

after(()=>{
  if(!enabled)return;
  rawPsql(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
});

test("aeroplane recency reads only the pilot's certified flights inside the rule window",{skip:!enabled},()=>{
  for(const query of [aeroplaneRecency,aeroplaneAudit]){
    const notes=query({userId:PILOT,maxDays:730}).map(row=>row.note);
    assert.deepEqual([...notes].sort(),["other-pilot-aircraft","pending","signature-other-account","signed","signed-older-revision","signed-other-hash","supervising-pic","typed-instructor-only"]);
    // A longer custom-rule window reaches older certified flights; malformed dates never count.
    assert.ok(query({userId:PILOT,maxDays:900}).some(row=>row.note==="800-days"));
    assert.ok(!query({userId:PILOT,maxDays:900}).some(row=>row.note==="malformed-date"));
  }
  assert.deepEqual(aeroplaneRecency({userId:OTHER,maxDays:730}).map(row=>row.note),["other-pilot"]);
});

test("instructor evidence counts only for a signed instructor verification of the exact certified revision and hash",{skip:!enabled},()=>{
  for(const query of [aeroplaneRecency,aeroplaneAudit]){
    const flights=byNote(query({userId:PILOT,maxDays:730}));
    const signedNotes=Object.values(flights).filter(row=>row.instructor_signed===true).map(row=>row.note);
    assert.deepEqual(signedNotes,["signed"]);
  }
  assert.deepEqual(sailplaneRecency({userId:CATEGORY}).map(row=>[row.id,row.instructor_signed]),[[201,true],[204,false]]);
  assert.deepEqual(balloonRecency({userId:CATEGORY}).map(row=>[row.id,row.instructor_signed]),[[211,false]]);
});

test("legacy movement inference follows the creation audit of the pilot's own record",{skip:!enabled},()=>{
  for(const query of [aeroplaneRecency,aeroplaneAudit]){
    const flights=byNote(query({userId:PILOT,maxDays:730}));
    assert.equal(flights["signed"].legacy_movement_candidate,true,"created before the structured-movement release");
    assert.equal(flights["signed-older-revision"].legacy_movement_candidate,false,"created after the release");
    assert.equal(flights["signed-other-hash"].legacy_movement_candidate,true,"a later edit does not change creation provenance");
    assert.equal(flights["supervising-pic"].legacy_movement_candidate,true,"another account's audit row is ignored");
  }
});

test("aircraft credit comes only from the pilot's own profile and never rewrites the flight snapshot",{skip:!enabled},()=>{
  for(const query of [aeroplaneRecency,aeroplaneAudit]){
    const flights=byNote(query({userId:PILOT,maxDays:730}));
    assert.equal(flights["signed"].part_fcl_credit_class,"SEP","registration matches ignoring case and spaces");
    assert.equal(flights["signed"].part_fcl_credit_basis,"TYPE_CERTIFICATE");
    assert.equal(flights["signed"].aircraft_class,"SEP","the current profile class (TMG) does not replace the flight's class");
    assert.equal(flights["other-pilot-aircraft"].part_fcl_credit_class,null,"another pilot's aircraft gives no credit");
  }
  assert.ok(aeroplaneAudit({userId:PILOT,maxDays:730}).every(row=>Number(row.starts)===1));
});

test("category recency services keep their own windows, categories and historical type",{skip:!enabled},()=>{
  assert.deepEqual(sailplaneRecency({userId:CATEGORY}).map(row=>row.id),[201,204]);
  assert.deepEqual(balloonRecency({userId:CATEGORY}).map(row=>row.id),[211]);
  const helicopter=helicopterRecency({userId:CATEGORY});
  assert.deepEqual(helicopter.map(row=>[row.id,row.helicopter_type]),[[221,"R44 Raven II"],[222,"R44 legacy label"],[223,""]]);
  run(`UPDATE aircraft SET aircraft_model='EC135' WHERE user_id=${CATEGORY} AND registration='OK-HEL'`);
  assert.deepEqual(helicopterRecency({userId:CATEGORY}).map(row=>row.helicopter_type),["R44 Raven II","R44 legacy label",""]);
  for(const query of [sailplaneRecency,balloonRecency,helicopterRecency])assert.deepEqual(query({userId:PILOT}),[]);
});

test("LAPL(A) totals count certified creditable flights and only exactly signed refresher training",{skip:!enabled},()=>{
  // Flight minutes: 60 + 45 (across midnight) + 30 + 25 + 10 + 20 + 15 (ULL) + 0 (malformed time) = 205.
  // Landings: 3 + 1 + 1 + 1 + 0 + 1 + 2 (negative night landings clamp to 0) = 9.
  // Refresher: 45 (structured purpose) + 25 (legacy remark); not 303 (older revision), 305 (other
  // purpose) or 312 (a ULL record is never Part-FCL refresher training, even with an SEP class).
  assert.deepEqual(laplTotals({userId:LAPL}),[{flight_minutes:205,landings:9,refresher_minutes:70}]);
  assert.deepEqual(laplTotals({userId:OTHER}),[{flight_minutes:60,landings:1,refresher_minutes:0}]);
});
