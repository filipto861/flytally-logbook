// FlyTally 3.8.0: run ONLY on a connector-seeded, disposable Neon branch.
// Uses installed @neondatabase/serverless, not the Neon connector's SQL execution.
import assert from "node:assert/strict";
import {neon} from "@neondatabase/serverless";

function required(name) {
  const value=process.env[name]?.trim();
  if(!value) throw new Error("Missing "+name+"; no remote writes permitted");
  return value;
}
const url=required("FLYTALLY_NEON_SDK_TEST_URL");
const host=required("FLYTALLY_NEON_SDK_TEST_HOST");
const branchId=required("FLYTALLY_NEON_SDK_TEST_BRANCH_ID");
const nonce=required("FLYTALLY_NEON_SDK_TEST_NONCE");
assert.equal(required("FLYTALLY_NEON_SDK_DISPOSABLE_ONLY"),"isolated-branch-only");
assert.match(branchId,/^br-[a-z0-9-]{8,}$/);
assert.match(nonce,/^[a-f0-9]{8}-[a-f0-9-]{27,}$/);
let parsed;
try{parsed=new URL(url)}catch{throw new Error("Invalid Neon test URI. Copy a single plain postgresql:// URI from the temporary branch Connect screen, not a psql command or label.")}
assert.ok(["postgres:","postgresql:"].includes(parsed.protocol));
assert.equal(parsed.hostname,host);
assert.match(host,/^[a-z0-9.-]+\.neon\.tech$/);
assert.equal(parsed.pathname,"/neondb");
assert.ok(parsed.username!==""&&parsed.password!=="");
assert.equal(parsed.hash,"");
assert.equal(parsed.port,"");
assert.ok([...parsed.searchParams.keys()].every(x=>["sslmode","channel_binding"].includes(x)));

const sql=neon(url,{fullResults:false,arrayMode:false});
const q=(statement,params=[])=>sql.query(statement,params);
const scratch="ft380_sdk_acceptance";
async function checkGuard(){
  // All checks are read-only. No writes until branch/host/nonce + freshness match.
  const rows=await q("SELECT branch_id,nonce,expected_host FROM ft380_sdk_acceptance.guard");
  assert.equal(rows.length,1);
  assert.equal(rows[0].branch_id,branchId,"Wrong branch ID: refusing writes");
  assert.equal(rows[0].nonce,nonce,"Wrong nonce: refusing writes");
  assert.equal(rows[0].expected_host,host,"Wrong Neon host: refusing writes");
  const state=await q("SELECT (SELECT COUNT(*)::int FROM ft380_sdk_acceptance.flows) flows, (SELECT COUNT(*)::int FROM ft380_sdk_acceptance.restored_flights) restored, (SELECT COUNT(*)::int FROM ft380_sdk_acceptance.trash WHERE restored_at IS NOT NULL) markers");
  assert.deepEqual([Number(state[0].flows),Number(state[0].restored),Number(state[0].markers)],[0,0,0],"Scratch is not pristine");
  console.log("PASS SDK disposable branch, host, nonce, pristine fixture");
}
async function state(trashId){
  const rows=await q("SELECT (SELECT COUNT(*)::int FROM ft380_sdk_acceptance.flows WHERE trash_id=$1) flows, (SELECT restored_at IS NOT NULL FROM ft380_sdk_acceptance.trash WHERE id=$1) marked",[trashId]);
  return {flows:Number(rows[0].flows),marked:rows[0].marked};
}
async function transactions(){
  const committed=await sql.transaction([
    q("INSERT INTO ft380_sdk_acceptance.flows(trash_id,amount_minor,currency) VALUES(101,1255,'CZK') RETURNING id"),
    q("UPDATE ft380_sdk_acceptance.trash SET restored_at=clock_timestamp() WHERE id=101 AND restored_at IS NULL RETURNING id"),
  ],{isolationLevel:"ReadCommitted"});
  assert.equal(committed[0].length,1);
  assert.equal(committed[1].length,1);
  assert.deepEqual(await state(101),{flows:1,marked:true});
  console.log("PASS HTTP SDK transaction commit");

  let failed=false;
  try{
    await sql.transaction([
      q("INSERT INTO ft380_sdk_acceptance.flows(trash_id,amount_minor,currency) VALUES(102,111,'CZK')"),
      q("UPDATE ft380_sdk_acceptance.trash SET restored_at=clock_timestamp() WHERE id=102"),
      q("INSERT INTO ft380_sdk_acceptance.flows(trash_id,amount_minor,currency) VALUES(102,-1,'CZK')"),
    ],{isolationLevel:"ReadCommitted"});
  }catch(error){
    failed=true;
    assert.equal(String(error?.code),"23514","Expected PostgreSQL CHECK failure");
  }
  assert.equal(failed,true);
  assert.deepEqual(await state(102),{flows:0,marked:false});
  console.log("PASS HTTP SDK late monetary CHECK rollback");
}
async function restoreOne(trashId){
  const lock=q("SELECT pg_advisory_xact_lock(hashtextextended(jsonb_build_array(user_id,flight_key)::text,0)) FROM ft380_sdk_acceptance.trash WHERE id=$1 AND restored_at IS NULL",[trashId]);
  const restore=q("WITH candidate AS MATERIALIZED (SELECT id,user_id,flight_key FROM ft380_sdk_acceptance.trash WHERE id=$1 AND restored_at IS NULL FOR UPDATE), created AS (INSERT INTO ft380_sdk_acceptance.restored_flights(user_id,flight_key,price_decimal) SELECT c.user_id,c.flight_key,123.456789012345::numeric FROM candidate c WHERE NOT EXISTS (SELECT 1 FROM ft380_sdk_acceptance.restored_flights f WHERE f.user_id=c.user_id AND f.flight_key=c.flight_key) RETURNING id), marked AS (UPDATE ft380_sdk_acceptance.trash SET restored_at=clock_timestamp(),restored_id=(SELECT id FROM created) WHERE id=$1 AND EXISTS(SELECT 1 FROM created) RETURNING restored_id) SELECT restored_id FROM marked",[trashId]);
  const responses=await sql.transaction([lock,restore],{isolationLevel:"ReadCommitted"});
  return responses[1];
}
async function concurrent(){
  const two=await Promise.all([restoreOne(201),restoreOne(202)]);
  assert.equal(two.filter(rows=>rows.length===1).length,1,"Two different trash IDs both restored");
  const one=await q("SELECT COUNT(*)::int AS n FROM ft380_sdk_acceptance.restored_flights WHERE user_id=9001 AND flight_key='same-natural-flight'");
  assert.equal(Number(one[0].n),1);
  const marker=await q("SELECT COUNT(*)::int AS n FROM ft380_sdk_acceptance.trash WHERE id IN (201,202) AND restored_at IS NOT NULL");
  assert.equal(Number(marker[0].n),1);
  console.log("PASS HTTP SDK concurrent different-trash same-key serialization");

  const same=await Promise.all([restoreOne(301),restoreOne(301)]);
  assert.equal(same.filter(rows=>rows.length===1).length,1,"Same trash restored twice");
  const count=await q("SELECT COUNT(*)::int AS n FROM ft380_sdk_acceptance.restored_flights WHERE user_id=9001 AND flight_key='same-archive'");
  assert.equal(Number(count[0].n),1);
  const exact=await q("SELECT price_decimal::text AS rate FROM ft380_sdk_acceptance.restored_flights WHERE user_id=9001 AND flight_key='same-archive'");
  assert.equal(exact[0].rate,"123.456789012345");
  console.log("PASS HTTP SDK same-trash collision + exact NUMERIC");
}
try{
  await checkGuard();
  await transactions();
  await concurrent();
  console.log("PASS: real Neon SDK HTTP acceptance (scratch only). Delete temp branch separately.");
}catch(error){
  console.error("FAIL SDK acceptance: "+String(error?.message??error).slice(0,240));
  process.exitCode=1;
}
