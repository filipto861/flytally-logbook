import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1",databaseUrl=process.env.DATABASE_URL??"",root=path.resolve(import.meta.dirname,"../.."),schema=`ft_insights_${randomUUID().replaceAll("-","")}`,quoted=`"${schema}"`;
function raw(statement:string){return spawnSync("psql",[databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:8*1024*1024})}
function run(statement:string){const result=raw(`SET search_path TO ${quoted};\n${statement}`);if(result.status!==0)throw new Error(result.stderr||result.stdout);return String(result.stdout??"").trim()}
function literal(value:unknown){if(value===null||value===undefined)return"NULL";if(typeof value==="number")return String(value);return`'${String(value).replaceAll("'","''")}'`}
function queryBlock(){const source=fs.readFileSync(path.join(root,"lib/data/pilot-insights.ts"),"utf8"),blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);const block=blocks.find(value=>value.includes("WITH base0 AS MATERIALIZED"));assert.ok(block,"pilot insights SQL block not found");return block.replaceAll("\\\\","\\")}
function render(block:string,scopeCategory:string|null=null){const values:Record<string,unknown>={userId:1,"bounds.start":null,"bounds.end":null,scopeCategory,"rolling.currentStart":"2025-09-05","rolling.currentEnd":"2026-09-04","rolling.previousStart":"2024-09-05","rolling.previousEnd":"2025-09-04"};const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{const key=String(expression).trim();assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No SQL fixture for ${key}`);return literal(values[key])});assert.doesNotMatch(rendered,/\$\{/);return rendered}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for pilot insights PostgreSQL test");
  const setup=`
    CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date TEXT,role TEXT,instructor TEXT,registration TEXT,aircraft_type TEXT,aircraft_class TEXT,
      evidence TEXT DEFAULT 'EASA',regulatory_category TEXT DEFAULT '',departure TEXT DEFAULT '',arrival TEXT DEFAULT '',
      starts INTEGER DEFAULT 0,landings_day INTEGER DEFAULT 0,landings_night INTEGER DEFAULT 0,night_minutes INTEGER DEFAULT 0,ifr_minutes INTEGER DEFAULT 0,
      pic_minutes INTEGER DEFAULT 0,copilot_minutes INTEGER DEFAULT 0,dual_minutes INTEGER DEFAULT 0,instructor_minutes INTEGER DEFAULT 0,
      price_per_hour NUMERIC DEFAULT 0,billing_basis TEXT DEFAULT 'BLOCK',off_block TEXT,takeoff TEXT,landing TEXT,on_block TEXT
    );
    INSERT INTO flights(user_id,date,role,instructor,registration,aircraft_type,aircraft_class,evidence,regulatory_category,departure,arrival,starts,landings_day,landings_night,night_minutes,ifr_minutes,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,price_per_hour,billing_basis,off_block,takeoff,landing,on_block) VALUES
      (1,'2026-09-01','PIC','','OK-AAA','C172','SEP','EASA','AEROPLANE','LKPR','LKTB',1,1,0,10,5,60,0,0,0,0,'BLOCK','10:00','10:10','10:50','11:00'),
      (1,'2026-08-01','DUAL','FI Example','OK-BBB','DA40','SEP','EASA','AEROPLANE','LKTB','LKPR',1,1,0,0,10,0,0,90,0,0,'BLOCK','10:00','10:10','11:20','11:30'),
      (1,'2025-08-01','PIC','','OK-AAA','SF25','TMG','EASA','','LKPR','LKPR',1,0,0,0,0,60,0,0,0,0,'BLOCK','08:00','08:05','08:55','09:00'),
      (1,'2026-07-01','PAX','','OK-CCC','PA28','SEP','EASA','AEROPLANE','LKPR','LKTB',1,1,0,0,0,0,0,0,0,0,'BLOCK','09:00','09:10','09:50','10:00'),
      (1,'2026-09-03','PAX','','OK-CCC','PA28','SEP','EASA','AEROPLANE','LKTB','LKPR',1,1,0,0,0,0,0,0,0,0,'BLOCK','09:00','09:10','09:50','10:00'),
      (2,'2026-09-01','PIC','','OTHER','C172','SEP','EASA','AEROPLANE','LKPR','LKTB',1,1,0,0,0,60,0,0,0,0,'BLOCK','10:00','10:10','10:50','11:00'),
      (1,'2026-09-02','PIC','','OK-TMG','SF25','TMG','EASA','SAILPLANE','LKLT','LKLT',1,1,0,0,0,80,0,0,0,0,'AIR','10:00','10:20','11:40','12:00'),
      (1,'2026-06-01','PIC','','OK-GLD','ASK21','GLIDER','EASA','','LKLT','LKLT',1,1,0,0,0,0,0,0,0,0,'AIR','10:00','10:15','11:15','11:30'),
      (1,'2026-05-01','PIC','','OK-BAL','Ultramagic','BALLOON','EASA','BALLOON','LKBE','LKBE',1,1,0,0,0,70,0,0,0,0,'AIR','06:00','06:15','07:25','07:40');
  `;
  const result=raw(setup);if(result.status!==0)throw new Error(result.stderr||result.stdout);
});
after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("v2.0-D pilot insights use category-aware logged time across mixed logbooks",{skip:!enabled},()=>{
  const statement=render(queryBlock()),json=run(`WITH result AS (${statement}) SELECT row_to_json(result)::text FROM result`),row=JSON.parse(json) as Record<string,unknown>;
  assert.equal(Number(row.flights),6);
  assert.equal(Number(row.minutes),420);
  assert.equal(String(row.first_date),"2025-08-01");
  assert.equal(String(row.last_date),"2026-09-02");
  assert.equal(Number(row.busiest_year),2026);
  assert.equal(Number(row.busiest_year_minutes),360);
  assert.equal(Number(row.busiest_year_flights),5);
  assert.equal(Number(row.current_flights),5);
  assert.equal(Number(row.current_minutes),360);
  assert.equal(Number(row.current_pic_minutes),270);
  assert.equal(Number(row.current_active_months),4);
  assert.equal(Number(row.previous_flights),1);
  assert.equal(Number(row.previous_minutes),60);
  assert.equal(Number(row.selected_flights),6);
  assert.equal(Number(row.selected_minutes),420);
  assert.equal(Number(row.selected_pic_minutes),270);
  assert.equal(Number(row.selected_dual_minutes),90);
  assert.equal(Number(row.selected_day_landings),6);
  assert.equal(Number(row.selected_unique_aircraft),5);
  assert.equal(Number(row.selected_unique_airports),4);
  assert.equal(Number(row.selected_unique_routes),5);
  const roles=typeof row.roles==="string"?JSON.parse(row.roles):row.roles as Array<Record<string,unknown>>;
  const monthly=typeof row.monthly==="string"?JSON.parse(row.monthly):row.monthly as Array<Record<string,unknown>>;
  const categories=typeof row.categories==="string"?JSON.parse(row.categories):row.categories as Array<Record<string,unknown>>;
  assert.ok(Array.isArray(roles));
  assert.ok(Array.isArray(monthly));
  assert.ok(Array.isArray(categories));
  assert.ok(roles.some(item=>item.role==="PIC"&&Number(item.flights)===5&&Number(item.minutes)===330));
  assert.ok(roles.some(item=>item.role==="DUAL"&&Number(item.flights)===1&&Number(item.minutes)===90));
  assert.ok(!roles.some(item=>item.role==="PAX"));
  assert.ok(!monthly.some(item=>item.month_key==="2026-07"));
  assert.ok(categories.some(item=>item.category==="AEROPLANE"&&Number(item.flights)===3&&Number(item.minutes)===210));
  assert.ok(categories.some(item=>item.category==="SAILPLANE"&&Number(item.flights)===2&&Number(item.minutes)===140));
  assert.ok(categories.some(item=>item.category==="BALLOON"&&Number(item.flights)===1&&Number(item.minutes)===70));
});

test("v2.0-D category scope applies to career, rolling and selected aggregates",{skip:!enabled},()=>{
  const statement=render(queryBlock(),"SAILPLANE"),json=run(`WITH result AS (${statement}) SELECT row_to_json(result)::text FROM result`),row=JSON.parse(json) as Record<string,unknown>;
  assert.equal(Number(row.flights),2);
  assert.equal(Number(row.minutes),140);
  assert.equal(String(row.first_date),"2026-06-01");
  assert.equal(String(row.last_date),"2026-09-02");
  assert.equal(Number(row.current_flights),2);
  assert.equal(Number(row.current_minutes),140);
  assert.equal(Number(row.current_pic_minutes),140);
  assert.equal(Number(row.selected_flights),2);
  assert.equal(Number(row.selected_minutes),140);
  assert.equal(Number(row.selected_pic_minutes),140);
  assert.equal(Number(row.selected_day_landings),2);
  assert.equal(Number(row.selected_unique_aircraft),2);
  assert.equal(Number(row.selected_unique_airports),1);
  assert.equal(Number(row.selected_unique_routes),1);
});
