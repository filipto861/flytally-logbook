import test from 'node:test';
import assert from 'node:assert/strict';
import {
 validateHttpConnection,validateHttpExecutionConfig,
 validateIdentity,assessTwoClientOverlap,performReadOnlyHttpCheck
} from './m0b-b1b2c-neon-http-readonly-probe.mjs';

const URL_OK='postgresql://flytally_m0b_operator:synthetic-placeholder@ep-quiet-smoke-babbdfv9.c-8.eu-central-1.aws.neon.tech/flytally_m0b_isolated?sslmode=require';
const CONF='M0B_EXACT_EMPTY_NEON_HTTP_READONLY_20261103';
const env={FLYTALLY_M0B_HTTP_READONLY_CONFIRM:CONF,
 FLYTALLY_M0B_HTTP_READONLY_URL:URL_OK};
const okIdentity=[[{database_name:'flytally_m0b_isolated',
 role_name:'flytally_m0b_operator',pg_version_num:'160015',
 transaction_read_only:'on',isolation_level:'read committed'}],
 [{public_user_tables:0,m0b_fixture_schemas:0}]];
const runWindow=(pid,start,end)=>[
 [{backend_pid:pid,started_at:start}],[{pause:null}],
 [{backend_pid:pid,ended_at:end}]
];
const firstWindow=runWindow(101,'2026-11-03T08:00:00.000Z','2026-11-03T08:00:01.150Z');
const secondWindow=runWindow(202,'2026-11-03T08:00:00.200Z','2026-11-03T08:00:01.350Z');

test('strict isolated DB host, user, database and sslmode accepted',()=>{
 assert.equal(validateHttpConnection(URL_OK).role,'flytally_m0b_operator');
});
test('remote production/other host and pooler rejected',()=>{
 for(const host of ['ep-prod.neon.tech','ep-quiet-smoke-babbdfv9-pooler.c-8.eu-central-1.aws.neon.tech','localhost']){
  assert.throws(()=>validateHttpConnection(URL_OK.replace('ep-quiet-smoke-babbdfv9.c-8.eu-central-1.aws.neon.tech',host)),/M0-B/);
 }
});
test('connection without verified user, database or password rejected',()=>{
 for(const value of [
  URL_OK.replace('flytally_m0b_operator','somebody'),
  URL_OK.replace('/flytally_m0b_isolated','/neondb'),
  URL_OK.replace(':synthetic-placeholder@',':@')
 ])assert.throws(()=>validateHttpConnection(value),/M0-B/);
});
test('disable SSL or extra PG options rejected',()=>{
 for(const value of [
  URL_OK.replace('sslmode=require','sslmode=disable'),
  URL_OK+'&options=-csearch_path%3Dpublic',
  URL_OK.replace('?sslmode=require',''),
  URL_OK+'#fragment',
  URL_OK.replace('ep-quiet-smoke-babbdfv9.c-8.eu-central-1.aws.neon.tech',
   'ep-quiet-smoke-babbdfv9.c-8.eu-central-1.aws.neon.tech:6380')
 ])assert.throws(()=>validateHttpConnection(value),/M0-B/);
});
test('live execution requires explicit flag and forbids automatic CI',()=>{
 assert.deepEqual(validateHttpExecutionConfig(env).databaseName,'flytally_m0b_isolated');
 assert.throws(()=>validateHttpExecutionConfig({...env,FLYTALLY_M0B_HTTP_READONLY_CONFIRM:''}),/M0-B/);
 assert.throws(()=>validateHttpExecutionConfig({...env,CI:'true'}),/M0-B/);
});
test('preflight rejects different database or SQL identity',()=>{
 validateIdentity(okIdentity);
 for(const [index,field,value] of [[0,'database_name','neondb'],[0,'role_name','wrong'],[0,'pg_version_num','180001'],
  [0,'transaction_read_only','off'],[0,'isolation_level','repeatable read'],[1,'public_user_tables',1],
  [1,'m0b_fixture_schemas',2]]){
  const x=structuredClone(okIdentity);x[index][0][field]=value;
  assert.throws(()=>validateIdentity(x),/M0-B/);
 }
});
test('preflight rejects missing or malformed driver results',()=>{
 for(const x of [null,[],[[]],[[{}],[]]])assert.throws(()=>validateIdentity(x),/M0-B/);
});
test('parallel proof needs distinct backend identities and >=200ms overlap',()=>{
 assert.equal(assessTwoClientOverlap(firstWindow,secondWindow).status,'PASS');
 assert.equal(assessTwoClientOverlap(firstWindow,firstWindow).status,'INCONCLUSIVE');
 assert.equal(assessTwoClientOverlap(firstWindow,
  runWindow(202,'2026-11-03T08:00:02.000Z','2026-11-03T08:00:03.200Z')).status,'INCONCLUSIVE');
});
test('broken transaction backend continuity or timestamps rejected',()=>{
 assert.throws(()=>assessTwoClientOverlap(
  runWindow(101,'x','y'),secondWindow),/M0-B/);
 assert.throws(()=>assessTwoClientOverlap(
  [[{backend_pid:101,started_at:'2026-11-03T08:00:00Z'}],[],[{backend_pid:102,ended_at:'2026-11-03T08:00:01Z'}]],
  secondWindow),/M0-B/);
});
test('fake distinct HTTP query functions validate read-only batches without network',async()=>{
 let clients=0;const txCalls=[];
 const neonFactory=(url,opts)=>{
   assert.equal(url,URL_OK);assert.equal(opts.fullResults,false);
   const id=++clients;
   function sql(strings){return {text:strings.join('')}} // static SELECT-only
   sql.transaction=async(queries,options)=>{
     txCalls.push({id,queries,options});
     assert.deepEqual(options,{readOnly:true,isolationLevel:'ReadCommitted'});
     for(const q of queries)assert.match(q.text,/^\s*SELECT\b/i);
     if(queries.some(q=>q.text.includes('current_database()')))return okIdentity;
     return id===1?firstWindow:secondWindow;
   };
   return sql;
 };
 const result=await performReadOnlyHttpCheck({neonFactory,connectionString:URL_OK});
 assert.equal(result.status,'PASS');
 assert.equal(clients,2);
 assert.equal(txCalls.length,3);
 assert.deepEqual(txCalls.map(x=>x.queries.length),[2,3,3]);
});
test('driver can complete but cannot fabricate cross-client concurrency',async()=>{
 let clients=0;
 const neonFactory=()=>{
  const id=++clients;
  function sql(strings){return{query:strings.join('')}}
  sql.transaction=async(queries,options)=>{
   assert.equal(options.readOnly,true);
   return queries.length===2?okIdentity:firstWindow;
  };
  return sql;
 };
 const r=await performReadOnlyHttpCheck({neonFactory,connectionString:URL_OK});
 assert.equal(r.status,'INCONCLUSIVE');
});
test('factory not producing two distinct clients rejects safely before SQL',async()=>{
 const same=Object.assign(function sql(){},{transaction:async()=>okIdentity});
 await assert.rejects(performReadOnlyHttpCheck({
  neonFactory:()=>same,connectionString:URL_OK
 }),/two distinct/);
});
test('no valid preflight prevents concurrency probe',async()=>{
 let queries=0;
 const neonFactory=()=>{
  function sql(strings){return{query:strings.join('')}}
  sql.transaction=async()=>{
   queries++;return [[{...okIdentity[0][0],transaction_read_only:'off'}],okIdentity[1]];
  };
  return sql;
 };
 await assert.rejects(performReadOnlyHttpCheck({
  neonFactory,connectionString:URL_OK
 }),/M0-B/);
 assert.equal(queries,1);
});
