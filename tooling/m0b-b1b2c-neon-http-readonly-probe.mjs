#!/usr/bin/env node
// M0-B B1b.2c: read-only @neondatabase/serverless HTTP two-client diagnostic.
// NO app writes, schema DDL, migration, production data or freeform SQL.
// All credentials from a dedicated ephemeral env variable, never printed.
import {fileURLToPath} from 'node:url';
import {assertM0BReadOnlyTarget,M0B_READ_ONLY_EXPECTED} from './m0b-b1b2c-neon-isolation-scope.mjs';

const KNOWN_ENDPOINT='ep-quiet-smoke-babbdfv9.c-8.eu-central-1.aws.neon.tech';
const RUN_CONFIRM='M0B_EXACT_EMPTY_NEON_HTTP_READONLY_20261103';
const SCOPE_CONFIRM='M0B_EMPTY_SEPARATE_PROJECT_READONLY_CONFIRMED';
const READ_OPTIONS=Object.freeze({readOnly:true,isolationLevel:'ReadCommitted'});

export function validateHttpConnection(raw){
  if(typeof raw!=='string'||raw.length===0||raw.length>4096)
    throw Error('M0-B HTTP requires a private isolated nonempty URL');
  let uri;
  try{uri=new URL(raw)}catch{throw Error('M0-B HTTP URL invalid')}
  if(!['postgresql:','postgres:'].includes(uri.protocol)||
     uri.hostname!==KNOWN_ENDPOINT||
     (uri.port&&uri.port!=='5432')||uri.hash)
    throw Error('M0-B HTTP endpoint is not the verified unpooled isolated target');
  if(decodeURIComponent(uri.username)!==M0B_READ_ONLY_EXPECTED.operatorRole||
    decodeURIComponent(uri.pathname)!=='/'+M0B_READ_ONLY_EXPECTED.databaseName||
    !uri.password)
    throw Error('M0-B HTTP database/role or credential absent');
  if(uri.searchParams.get('sslmode')!=='require'||
     [...uri.searchParams.keys()].some(k=>k!=='sslmode'&&k!=='channel_binding')||
     (uri.searchParams.has('channel_binding')&&uri.searchParams.get('channel_binding')!=='require')||
     uri.searchParams.size>2)
    throw Error('M0-B HTTP requires TLS/channel-binding policy without unknown URL overrides');
  return Object.freeze({host:uri.hostname,database:M0B_READ_ONLY_EXPECTED.databaseName,
    role:M0B_READ_ONLY_EXPECTED.operatorRole});
}

export function validateHttpExecutionConfig(env){
  if(env.CI==='true')throw Error('M0-B HTTP live run prohibited in automatic CI');
  if(env.FLYTALLY_M0B_HTTP_READONLY_CONFIRM!==RUN_CONFIRM)
    throw Error('M0-B HTTP live run requires manual explicit read-only confirmation');
  const scope=assertM0BReadOnlyTarget({...M0B_READ_ONLY_EXPECTED,
    confirmation:SCOPE_CONFIRM,defaultBranch:true,projectCreationSource:'new-project',
    copiedProductionData:false,publicTableCount:0,operation:'metadata-read-only'});
  validateHttpConnection(env.FLYTALLY_M0B_HTTP_READONLY_URL);
  return scope;
}

function oneRow(batch,label){
  if(!Array.isArray(batch)||batch.length!==1||!batch[0]||
      typeof batch[0]!=='object')
    throw Error('M0-B HTTP unexpected '+label+' SQL response');
  return batch[0];
}

export function validateIdentity(result){
  if(!Array.isArray(result)||result.length!==2)
    throw Error('M0-B HTTP missing preflight result sets');
  const a=oneRow(result[0],'identity'),b=oneRow(result[1],'empty schema');
  if(a.database_name!==M0B_READ_ONLY_EXPECTED.databaseName||
    a.role_name!==M0B_READ_ONLY_EXPECTED.operatorRole||
    String(a.pg_version_num)!==M0B_READ_ONLY_EXPECTED.pgVersionNumber||
    a.transaction_read_only!=='on'||
    a.isolation_level!=='read committed')
    throw Error('M0-B HTTP preflight identity or read-only mode mismatch');
  if(Number(b.public_user_tables)!==0||Number(b.m0b_fixture_schemas)!==0)
    throw Error('M0-B HTTP target unexpectedly contains test/application data');
  return true;
}

export function assessTwoClientOverlap(a,b){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==3||b.length!==3)
    throw Error('M0-B HTTP incomplete concurrency response');
  const read=(v)=>{
    const start=oneRow(v[0],'start'),end=oneRow(v[2],'end');
    const startAt=Date.parse(start.started_at),endAt=Date.parse(end.ended_at);
    if(!Number.isFinite(startAt)||!Number.isFinite(endAt)||
      endAt<=startAt||String(start.backend_pid)!==String(end.backend_pid))
      throw Error('M0-B HTTP transaction timestamps or backend identity invalid');
    return {pid:String(start.backend_pid),startAt,endAt};
  };
  const x=read(a),y=read(b);
  const overlapMs=Math.min(x.endAt,y.endAt)-Math.max(x.startAt,y.startAt);
  // Distinct server backends AND overlap in server-measured intervals required.
  // No elapsed-time guesses, client-side clocks or same-PID "success" claims.
  return Object.freeze({status:x.pid!==y.pid&&overlapMs>=200?'PASS':'INCONCLUSIVE',
    overlapMs:Math.max(0,overlapMs)});
}

export async function performReadOnlyHttpCheck({neonFactory,connectionString}){
  // A caller must separately perform validateHttpExecutionConfig and provider
  // project+branch+endpoint metadata inspection immediately before this call.
  validateHttpConnection(connectionString);
  if(typeof neonFactory!=='function')throw Error('M0-B HTTP driver factory missing');
  const first=neonFactory(connectionString,{fullResults:false,arrayMode:false});
  const second=neonFactory(connectionString,{fullResults:false,arrayMode:false});
  if(typeof first!=='function'||typeof first.transaction!=='function'||
    typeof second!=='function'||typeof second.transaction!=='function'||first===second)
    throw Error('M0-B HTTP expected two distinct driver query-function instances');
  const preflight=await first.transaction([
    first`SELECT current_database() AS database_name,current_user AS role_name,
      current_setting('server_version_num') AS pg_version_num,
      current_setting('transaction_read_only') AS transaction_read_only,
      current_setting('transaction_isolation') AS isolation_level`,
    first`SELECT (SELECT count(*)::integer FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE') AS public_user_tables,
      (SELECT count(*)::integer FROM pg_namespace
      WHERE nspname LIKE 'ft_m0b_%') AS m0b_fixture_schemas`
  ],READ_OPTIONS);
  validateIdentity(preflight);
  const hold=(sql)=>sql.transaction([
    sql`SELECT pg_backend_pid() AS backend_pid,clock_timestamp() AS started_at`,
    sql`SELECT pg_sleep(1.1) AS pause`,
    sql`SELECT pg_backend_pid() AS backend_pid,clock_timestamp() AS ended_at`
  ],READ_OPTIONS);
  const settled=await Promise.allSettled([hold(first),hold(second)]);
  if(settled.some(v=>v.status!=='fulfilled'))
    throw Error('M0-B HTTP one or both read-only client batches failed');
  return assessTwoClientOverlap(settled[0].value,settled[1].value);
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const scope=validateHttpExecutionConfig(process.env);
    if(scope.projectId!==M0B_READ_ONLY_EXPECTED.projectId)
      throw Error('M0-B HTTP unexpected provider scope');
    // Load network-capable driver ONLY after all offline target checks pass.
    const {neon}=await import('@neondatabase/serverless');
    const result=await performReadOnlyHttpCheck({
      neonFactory:neon,connectionString:process.env.FLYTALLY_M0B_HTTP_READONLY_URL
    });
    console.log('M0-B HTTP: exact isolated DB identity and READ ONLY transaction PASS');
    console.log('M0-B HTTP: two-client server interval '+result.status);
    process.exitCode=result.status==='PASS'?0:2;
  }catch{
    // DO NOT print raw database errors: they can contain URLs or credentials.
    console.error('M0-B HTTP: FAIL (no credentials or driver errors disclosed)');
    process.exitCode=1;
  }
}
