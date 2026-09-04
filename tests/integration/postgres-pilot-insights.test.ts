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
function queryBlock(){const source=fs.readFileSync(path.join(root,"lib/data/pilot-insights.ts"),"utf8"),blocks=[...source.matchAll(/sql`([\s\S]*?)`/g)].map(match=>match[1]);const block=blocks.find(value=>value.includes("WITH base0 AS MATERIALIZED"));assert.ok(block,"v1.68 pilot insights SQL block not found");return block}
function render(block:string){const values:Record<string,unknown>={userId:1,"bounds.start":null,"bounds.end":null,"rolling.currentStart":"2025-09-05","rolling.currentEnd":"2026-09-04","rolling.previousStart":"2024-09-05","rolling.previousEnd":"2025-09-04"};const rendered=block.replace(/\$\{([^}]+)\}/g,(_all,expression)=>{const key=String(expression).trim();assert.ok(Object.prototype.hasOwnProperty.call(values,key),`No SQL fixture for ${key}`);return literal(values[key])});assert.doesNotMatch(rendered,/\$\{/);return rendered}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl,"DATABASE_URL is required for v1.68 PostgreSQL test");
  const setup=`
    CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,date TEXT,role TEXT,instructor TEXT,registration TEXT,aircraft_type TEXT,aircraft_class TEXT,
      starts INTEGER DEFAULT 0,night_minutes INTEGER DEFAULT 0,ifr_minutes INTEGER DEFAULT 0,pic_minutes INTEGER DEFAULT 0,off_block TEXT,on_block TEXT
    );
    INSERT INTO flights(user_id,date,role,instructor,registration,aircraft_type,aircraft_class,starts,night_minutes,ifr_minutes,pic_minutes,off_block,on_block) VALUES
      (1,'2026-09-01','PIC','','OK-AAA','C172','SEP',1,10,5,60,'10:00','11:00'),
      (1,'2026-08-01','DUAL','FI Example','OK-BBB','DA40','SEP',1,0,10,0,'10:00','11:30'),
      (1,'2025-08-01','PIC','','OK-AAA','C172','SEP',1,0,0,60,'08:00','09:00'),
      (1,'2026-07-01','PAX','','OK-CCC','PA28','SEP',1,0,0,0,'09:00','10:00'),
      (2,'2026-09-01','PIC','','OTHER','C172','SEP',1,0,0,60,'10:00','11:00');
  `;
  const result=raw(setup);if(result.status!==0)throw new Error(result.stderr||result.stdout);
});
after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("v1.68 pilot insights SQL executes and keeps auxiliary activity out of logged totals",{skip:!enabled},()=>{
  const statement=render(queryBlock()),json=run(`WITH result AS (${statement}) SELECT row_to_json(result)::text FROM result`),row=JSON.parse(json) as Record<string,unknown>;
  assert.equal(Number(row.flights),3);
  assert.equal(Number(row.minutes),210);
  assert.equal(String(row.first_date),"2025-08-01");
  assert.equal(String(row.last_date),"2026-09-01");
  assert.equal(Number(row.current_flights),2);
  assert.equal(Number(row.current_minutes),150);
  assert.equal(Number(row.current_pic_minutes),60);
  assert.equal(Number(row.current_active_months),2);
  assert.equal(Number(row.previous_flights),1);
  assert.equal(Number(row.previous_minutes),60);
  const roles=typeof row.roles==="string"?JSON.parse(row.roles):row.roles as Array<Record<string,unknown>>;
  assert.ok(Array.isArray(roles));
  assert.ok(roles.some(item=>item.role==="PIC"&&Number(item.flights)===2));
  assert.ok(roles.some(item=>item.role==="DUAL"&&Number(item.flights)===1));
  assert.ok(!roles.some(item=>item.role==="PAX"));
});
