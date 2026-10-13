import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

// Requires real native PostgreSQL 16 and applied v20 catalog.
// Missing objects FAIL rather than being recreated as an approximate fixture.
test("D3b real full-v20 FK and trigger catalog gate", { skip: process.env.FLYTALLY_D3B_FULL_V20_DISPOSABLE !== "1" }, () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url, "Explicit disposable DATABASE_URL required");
  const u = new URL(url);
  assert.equal(u.protocol, "postgresql:");
  assert.equal(u.hostname, "127.0.0.1");
  assert.equal(u.username, "flytally");
  assert.equal(u.password, "");
  assert.equal(u.pathname, "/flytally_currency_test");
  assert.equal(u.search, "");
  assert.equal(u.hash, "");
  assert.ok(Number(u.port)>1024 && Number(u.port)!==5432 && Number(u.port)!==55432);
  const query = [
    "SELECT json_build_object(",
    "'db',current_database(),'usr',current_user,'host',host(inet_server_addr()),",
    "'port',inet_server_port(),'version',current_setting('server_version_num'),",
    "'fks',(SELECT coalesce(json_agg(json_build_object('tab',c.conrelid::regclass::text,",
    "'def',pg_get_constraintdef(c.oid))),'[]'::json) FROM pg_constraint c",
    "WHERE c.contype='f' AND c.conrelid IN",
    "('flight_participations'::regclass,'flight_connected_crew'::regclass,",
    "'flight_verifications'::regclass,'flight_source_provenance'::regclass)),",
    "'triggers',(SELECT coalesce(json_agg(json_build_object('tab',t.tgrelid::regclass::text,",
    "'name',t.tgname,'def',pg_get_triggerdef(t.oid))),'[]'::json) FROM pg_trigger t",
    "WHERE NOT t.tgisinternal AND t.tgrelid IN",
    "('flights'::regclass,'flight_source_provenance'::regclass,",
    "'voided_certified_flights'::regclass))",
    ")::text",
  ].join(" ");
  const env = {...process.env, PGCONNECT_TIMEOUT:"5"};
  for(const k of Object.keys(env)) if(k.startsWith("PG") && k!=="PGCONNECT_TIMEOUT") delete env[k];
  const r = spawnSync("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url,"-c",query],
    {encoding:"utf8",timeout:15000,env});
  if(r.error) throw r.error;
  assert.equal(r.status,0,"Catalog query failed: "+String(r.stderr).slice(0,350));
  const c = JSON.parse(String(r.stdout).trim());
  assert.equal(c.db,"flytally_currency_test");
  assert.equal(c.usr,"flytally");
  assert.equal(c.host,"127.0.0.1");
  assert.equal(c.port,Number(u.port));
  assert.match(c.version,/^16[0-9]{4}$/);
  const fk=(tab:string,columns:string,action:string)=>{
    assert.ok(c.fks.some((x:{tab:string;def:string})=>x.tab===tab &&
      x.def.includes(columns) && x.def.includes(action)),
      "Missing FK "+tab+" "+columns+" "+action);
  };
  fk("flight_participations","source_flight_id","ON DELETE CASCADE");
  fk("flight_participations","participant_flight_id","ON DELETE SET NULL");
  fk("flight_connected_crew","source_flight_id, source_user_id","ON DELETE CASCADE");
  fk("flight_verifications","flight_id","ON DELETE CASCADE");
  fk("flight_source_provenance","participant_flight_id, participant_user_id","ON DELETE CASCADE");
  const trigger=(tab:string,pattern:RegExp)=>{
    assert.ok(c.triggers.some((x:{tab:string;name:string})=>x.tab===tab && pattern.test(x.name)),
      "Missing lifecycle trigger on "+tab);
  };
  trigger("flight_source_provenance",/^trg_logbook_protect_source_provenance$/);
  trigger("flights",/^trg_logbook_protect_locked_flight$/);
  trigger("flights",/^trg_logbook_prevent_voided_flight_id_reuse$/);
  trigger("voided_certified_flights",/^trg_logbook_protect_voided_certified_flights$/);
});
