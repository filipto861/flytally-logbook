// DATA-1D offline HTTP-wire contract with the REAL Neon 1.1.0 serializer/parser.
// All fetch requests are intercepted and replied to in-process. ZERO remote traffic.
import test from "node:test";
import assert from "node:assert/strict";
import { checkTarget, makeProbeToken, runGate } from "./data1-neon-http-store-gate.mjs";

const fakeEnv=()=>({
  DATA1_SYNTHETIC_ONLY:"1",
  DATA1_ALLOW_TEST_WRITES:"YES_DISPOSABLE_ONLY",
  DATA1_EXPECTED_PROJECT_ID:"clean-fixture-12345678",
  DATA1_EXPECTED_BRANCH_ID:"br-mock-synthetic-123",
  DATA1_EXPECTED_DATABASE:"synthetic_data1",
  DATA1_EXPECTED_ROLE:"synthetic_data1_owner",
  DATABASE_URL:"postgresql://synthetic_data1_owner:FAKE-ONLY-NEVER-REAL@ep-mock.eu-central-1.aws.neon.tech/synthetic_data1?sslmode=require",
});
const bootTime="2026-10-30T00:00:00+00";
const pg16={db:"synthetic_data1",role:"synthetic_data1_owner",
  pg_version:160015,boot_time:bootTime,tables:0};
const rowResponse=(names,ids,rows)=>new Response(JSON.stringify({
  rows,fields:names.map((name,i)=>({name,dataTypeID:ids[i]})),rowCount:rows.length,
}),{status:200,headers:{"content-type":"application/json"}});

function fakeNeonHttp({ corruptAt=0 }={}) {
  const rows=new Map();
  const calls=[];
  let created=false;
  const fetchImpl=async (input, init)=>{
    const url=new URL(input);
    assert.equal(url.hostname,"ep-mock.eu-central-1.aws.neon.tech");
    assert.equal(url.pathname,"/sql");
    assert.equal(init?.method,"POST");
    const payload=JSON.parse(init.body);
    assert.equal(typeof payload.query,"string");
    const query=payload.query;
    calls.push({queryClass:query.slice(0,20),bytes:Buffer.byteLength(init.body)});
    if(query.startsWith("SELECT current_database()")) {
      // Return a real Neon driver response shape; no network is used.
      return rowResponse(["db","role","pg_version","boot_time","tables"],
        [25,25,23,25,23],[[pg16.db,pg16.role,pg16.pg_version,pg16.boot_time,pg16.tables]]);
    }
    if(query.startsWith("CREATE TABLE public.data1_synthetic_archive")) {
      assert.equal(created,false);
      created=true;
      return rowResponse([],[],[]);
    }
    if(query.startsWith("INSERT INTO public.data1_synthetic_archive")) {
      assert.equal(created,true);
      assert.equal(payload.params.length,5);
      const [mib,base64,digest,rawBytes,gzipBytes]=payload.params;
      assert.ok(["1","4","12"].includes(mib));
      assert.equal(typeof base64,"string");
      const id=rows.size+1;
      rows.set(String(id),{payload_base64:base64,payload_sha256:digest,
        raw_bytes:rawBytes,compressed_bytes:gzipBytes});
      return rowResponse(["id"],[20],[[String(id)]]);
    }
    if(query.startsWith("SELECT payload_base64,payload_sha256,raw_bytes")) {
      const id=payload.params[0];
      const value=rows.get(id);
      assert.ok(value,"cannot read a missing synthetic mock row");
      if(corruptAt && rows.size===corruptAt) {
        return rowResponse(["payload_base64","payload_sha256","raw_bytes","compressed_bytes"],
          [25,25,20,20],[[value.payload_base64+"AAAA",value.payload_sha256,value.raw_bytes,value.compressed_bytes]]);
      }
      return rowResponse(["payload_base64","payload_sha256","raw_bytes","compressed_bytes"],
        [25,25,20,20],[[value.payload_base64,value.payload_sha256,value.raw_bytes,value.compressed_bytes]]);
    }
    throw Error("Unexpected query type in offline Neon-wire mock");
  };
  return {fetchImpl,calls,rows,get created(){return created;}};
}
test("DATA-1D: real Neon 1.1.0 HTTP serializer/parser performs mocked 1/4/12MiB stored gzip/Base64 INSERT + SELECT",async()=>{
  const m=fakeNeonHttp(),env=fakeEnv();
  const token=makeProbeToken(checkTarget(env),pg16);
  await runGate({env,argv:["--synthetic-only","--execute","--confirm="+token],fetchImpl:m.fetchImpl});
  assert.equal(m.created,true);
  assert.equal(m.rows.size,3);
  assert.equal(m.calls.length,8); // 1 preflight, 1 create, 3 inserts, 3 separate SELECTs
  const insertCalls=m.calls.filter(x=>x.queryClass.startsWith("INSERT"));
  const readCalls=m.calls.filter(x=>x.queryClass.startsWith("SELECT payload"));
  assert.equal(insertCalls.length,3);
  assert.equal(readCalls.length,3);
  assert.ok(insertCalls[2].bytes>12*1048576);
  for(const row of m.rows.values())assert.ok(row.payload_base64.length>0);
});

test("DATA-1D: probe is read-only and wrong confirmation cannot issue any table write",async()=>{
  const env=fakeEnv(),probe=fakeNeonHttp();
  await runGate({env,argv:["--synthetic-only","--probe"],fetchImpl:probe.fetchImpl});
  assert.equal(probe.created,false);
  assert.equal(probe.calls.length,1);
  const refused=fakeNeonHttp();
  await assert.rejects(
    runGate({env,argv:["--synthetic-only","--execute","--confirm="+"f".repeat(20)],
      fetchImpl:refused.fetchImpl}),/Write authorization or probe confirmation mismatch/
  );
  assert.equal(refused.created,false);
  assert.equal(refused.calls.length,1);
});

test("DATA-1D: corrupted stored mock payload halts before 4/12MiB data transfers",async()=>{
  const m=fakeNeonHttp({corruptAt:1}),env=fakeEnv();
  const token=makeProbeToken(checkTarget(env),pg16);
  await assert.rejects(
    runGate({env,argv:["--synthetic-only","--execute","--confirm="+token],fetchImpl:m.fetchImpl}),
    /Stored HTTP byte-integrity assertion failed/
  );
  assert.equal(m.rows.size,1);
  assert.equal(m.calls.filter(x=>x.queryClass.startsWith("INSERT")).length,1);
});

test("DATA-1D: invalid target never invokes HTTP fetch",async()=>{
  const m=fakeNeonHttp();
  await assert.rejects(
    runGate({env:{...fakeEnv(),DATA1_EXPECTED_DATABASE:"neondb"},
      argv:["--synthetic-only","--probe"],fetchImpl:m.fetchImpl}),/Expected disposable database/
  );
  assert.equal(m.calls.length,0);
});
