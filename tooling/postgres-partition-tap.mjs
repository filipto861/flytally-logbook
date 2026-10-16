import {createHash} from "node:crypto";

const expectedSummaryFields=["tests","suites","pass","fail","cancelled","skipped","todo"];
const die=(reason)=>{throw new Error("PARTITION_TAP_INVALID: "+reason);};
const sha256=(value)=>createHash("sha256").update(value,"utf8").digest("hex");
const unsigned=(value,label)=>{
  if(!/^(0|[1-9][0-9]*)$/.test(value))die("non-canonical "+label);
  const n=Number(value);
  if(!Number.isSafeInteger(n))die("unsafe count "+label);
  return n;
};

/**
 * Verify actual Node 24 --test-reporter=tap output, without inferring success
 * from a summary alone. A TAP suite assertion is NOT a test case.
 * This is M2 pure evidence checking, not authorization to issue a release PASS.
 */
export function parseStrictPartitionTap(stdout,{expectedTests}={}){
  if(typeof stdout!=="string"||stdout.length===0||stdout.length>64*1024*1024){
    die("missing or oversized TAP stdout");
  }
  if(!Number.isSafeInteger(expectedTests)||expectedTests<=0)die("expected test count is required");
  const lines=stdout.replaceAll("\r\n","\n").split("\n");
  if(lines[0]!=="TAP version 13")die("TAP version 13 header missing");
  if(lines.some(line=>line.includes("\r")))die("bare CR in TAP output");
  const nonempty=lines.map((s,i)=>({s,i})).filter(x=>x.s!=="");
  if(!nonempty.length)die("empty TAP content");
  const summary=new Map();
  const rootCases=[],allAssertions=[];
  const rootPlans=[];
  let duration=-1;
  let firstSummary=Infinity;
  for(const {s,i} of nonempty){
    const sum=s.match(/^# (tests|suites|pass|fail|cancelled|skipped|todo) ([0-9]+)$/);
    if(sum){
      if(summary.has(sum[1]))die("duplicate summary field "+sum[1]);
      summary.set(sum[1],unsigned(sum[2],sum[1]));
      firstSummary=Math.min(firstSummary,i);
      continue;
    }
    if(s.startsWith("# duration_ms ")){
      if(duration!==-1||!/^# duration_ms (?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(s)){
        die("missing/duplicated/invalid duration");
      }
      duration=i;
      continue;
    }
    const plan=s.match(/^(\s*)1\.\.(\d+)$/);
    if(plan&&plan[1]==="")rootPlans.push({i,planned:unsigned(plan[2],"root plan")});
    const assertion=s.match(/^(\s*)(ok|not ok) ([1-9][0-9]*)(?:\s+-\s+.*)?$/);
    if(assertion){
      const record={i,indent:assertion[1].length,status:assertion[2],
        number:unsigned(assertion[3],"assertion number"),line:s};
      allAssertions.push(record);
      if(record.indent===0)rootCases.push(record);
      if(/#\s*(?:SKIP|TODO)(?:\s|$)/i.test(s))die("SKIP/TODO directive");
      if(record.status==="not ok")die("failing TAP assertion");
    }
    if(/(^|\s)#\s*(?:SKIP|TODO)(?:\s|$)/i.test(s))die("unexpected SKIP/TODO directive");
  }
  if(expectedSummaryFields.some(k=>!summary.has(k))||summary.size!==expectedSummaryFields.length){
    die("incomplete test summary");
  }
  if(rootPlans.length!==1)die("missing/duplicate root plan");
  const plan=rootPlans[0];
  if(plan.planned<1||plan.i>=firstSummary||duration!==nonempty.at(-1).i){
    die("invalid TAP root plan, summary or trailing output");
  }
  if(rootCases.length!==plan.planned||
    rootCases.some((entry,i)=>entry.number!==i+1)||rootCases.some(entry=>entry.i>=plan.i)){
    die("root assertions and plan disagree");
  }
  if(nonempty.some(({s,i})=>i>plan.i&&i<duration&&!/^# (?:tests|suites|pass|fail|cancelled|skipped|todo) [0-9]+$/.test(s))){
    die("unrecognized output after root plan");
  }
  const typedTest=lines.filter(s=>/^\s+type: ['"]?test['"]?$/.test(s)).length;
  const typedSuite=lines.filter(s=>/^\s+type: ['"]?suite['"]?$/.test(s)).length;
  const planned=summary.get("tests"),passed=summary.get("pass");
  if(planned!==expectedTests||passed!==expectedTests||
     summary.get("fail")!==0||summary.get("skipped")!==0||
     summary.get("cancelled")!==0||summary.get("todo")!==0){
    die("test totals, expected count or unresolved cases");
  }
  if(typedTest!==planned||typedSuite!==summary.get("suites")||
     typedTest+typedSuite!==allAssertions.length){
    die("typed TAP test/suite assertions disagree with summary");
  }
  if(rootCases.length===0||allAssertions.length===0){
    die("no asserted test evidence");
  }
  return Object.freeze({
    planned,passed,failed:0,skipped:0,cancelled:0,todo:0,notApplicable:0,retries:0,
    suites:typedSuite,rootAssertions:rootCases.length,tapSha256:sha256(stdout),
  });
}

const requireIdentity=(value,label)=>{
  if(typeof value!=="string"||!/^[a-f0-9]{64}$/.test(value)){
    die("missing or malformed "+label);
  }
  return value;
};
const requireDatabase=(value)=>{
  if(typeof value!=="string"||
    !/^flytally_currency_test\|flytally\|127\.0\.0\.1\|([1-9][0-9]{3,4})\|16[0-9]{4}$/.test(value)){
    die("unverified database identity");
  }
  const port=Number(value.split("|")[3]);
  if(port<=1024||port===5432||port===55432||port>65535){
    die("disallowed database port");
  }
  return value;
};

/**
 * Aggregate already captured exact-candidate partition evidence. No DB, no
 * execution, no ledger mutation. "VALIDATED-ONLY" MUST NEVER be treated as
 * "postgres-acceptance PASS"; the M3 trusted executor remains required.
 */
export function aggregatePartitionTapEvidence({
  registry,candidateId,headSha,configHash,toolchainHash,registrySha256,observations,
}={}){
  requireIdentity(candidateId,"candidate");
  requireIdentity(headSha,"head SHA");
  requireIdentity(configHash,"configuration");
  requireIdentity(toolchainHash,"toolchain");
  requireIdentity(registrySha256,"registry");
  if(!registry||registry.schemaVersion!==1||registry.stage!=="M1-INVENTORY-ONLY-NO-EXECUTION"||
    !Array.isArray(registry.partitions)||registry.partitions.length!==6||
    !Array.isArray(observations)||observations.length!==registry.partitions.length){
    die("partition inventory or evidence cardinality");
  }
  const matched=new Set(),databases=new Set();
  let total=0;
  const partitions=[];
  for(const observation of observations){
    if(!observation||typeof observation!=="object"){
      die("malformed partition observation");
    }
    const partition=registry.partitions.find(part=>part.id===observation.partitionId);
    if(!partition||matched.has(partition.id))die("unknown or duplicate partition");
    matched.add(partition.id);
    for(const [key,expected] of Object.entries({candidateId,headSha,configHash,toolchainHash,registrySha256})){
      if(observation[key]!==expected)die("stale or foreign "+key);
    }
    if(observation.exitCode!==0||typeof observation.command!=="string"||
      !/(^|\s)--test-reporter=tap(\s|$)/.test(observation.command)||
      !/(^|\s)--test(\s|$)/.test(observation.command)||
      observation.stderr!==""||
      typeof observation.stdout!=="string"){
      die("partition process did not execute cleanly");
    }
    const database=requireDatabase(observation.databaseIdentity);
    if(databases.has(database))die("database reused across independent partitions");
    databases.add(database);
    const evidence=parseStrictPartitionTap(observation.stdout,{expectedTests:partition.expectedTests});
    partitions.push(Object.freeze({
      id:partition.id,planned:evidence.planned,passed:evidence.passed,
      tapSha256:evidence.tapSha256,databaseIdentity:database,
    }));
    total+=evidence.passed;
  }
  if(matched.size!==registry.partitions.length||total!==registry.expectedTests){
    die("incomplete partition evidence");
  }
  return Object.freeze({
    status:"VALIDATED-ONLY",releaseEvidence:"NOT RUN",
    candidateId,headSha,registrySha256,partitions:Object.freeze(partitions),
    planned:total,passed:total,
  });
}
