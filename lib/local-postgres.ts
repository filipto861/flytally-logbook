import "server-only";
import { spawnSync } from "node:child_process";

const LOCAL_HOSTS=new Set(["127.0.0.1","localhost","::1","[::1]"]);

function localDatabaseUrl(){
  const value=process.env.DATABASE_URL?.trim();
  if(!value)throw new Error("DATABASE_URL is not configured.");
  const parsed=new URL(value);
  if(!LOCAL_HOSTS.has(parsed.hostname))throw new Error("FLYTALLY_LOCAL_POSTGRES may only target localhost.");
  return value;
}

function quote(value:string){
  if(value.includes("\0"))throw new Error("NUL bytes are not allowed in SQL values.");
  return `'${value.replaceAll("'","''")}'`;
}

function literal(value:unknown):string{
  if(value===null||value===undefined)return"NULL";
  if(typeof value==="number"){
    if(!Number.isFinite(value))throw new Error("Non-finite SQL number.");
    return String(value);
  }
  if(typeof value==="bigint")return String(value);
  if(typeof value==="boolean")return value?"TRUE":"FALSE";
  if(value instanceof Date)return quote(value.toISOString());
  if(typeof value==="object")return quote(JSON.stringify(value));
  return quote(String(value));
}

function render(strings:TemplateStringsArray,values:unknown[]){
  let statement=strings[0]??"";
  for(let index=0;index<values.length;index+=1)statement+=literal(values[index])+(strings[index+1]??"");
  return statement.trim().replace(/;\s*$/,"");
}

const rowProducing=(statement:string)=>/^(?:SELECT|WITH)\b/i.test(statement)||/\bRETURNING\b/i.test(statement);

function spawn(statement:string){
  const result=spawnSync("psql",["-d",localDatabaseUrl(),"-X","-qAt","-v","ON_ERROR_STOP=1","-c",statement],{
    encoding:"utf8",
    env:{...process.env,PGCONNECT_TIMEOUT:"5"},
    maxBuffer:16*1024*1024,
  });
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Local PostgreSQL query failed: ${String(result.stderr||result.stdout).trim()}`);
  return String(result.stdout??"").trim();
}

function execute(statement:string){
  const producesRows=rowProducing(statement);
  const command=producesRows?captureRows(statement,""):statement;
  const output=spawn(command);
  if(!producesRows||!output)return[];
  return JSON.parse(output) as Array<Record<string,unknown>>;
}

const TRANSACTION_RESULT_PREFIX="__flytally_local_tx__";

function topLevelCommandIndex(statement:string){
  if(!/^WITH\b/i.test(statement))return-1;
  let depth=0,inSingle=false,inDouble=false,dollarTag="";
  for(let index=0;index<statement.length;index+=1){
    const char=statement[index],next=statement[index+1];
    if(dollarTag){
      if(statement.startsWith(dollarTag,index)){index+=dollarTag.length-1;dollarTag=""}
      continue;
    }
    if(inSingle){
      if(char==="'"&&next==="'"){index+=1;continue}
      if(char==="'")inSingle=false;
      continue;
    }
    if(inDouble){
      if(char==='"'&&next==='"'){index+=1;continue}
      if(char==='"')inDouble=false;
      continue;
    }
    if(char==="'"){inSingle=true;continue}
    if(char==='"'){inDouble=true;continue}
    if(char==="$"){
      const match=statement.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
      if(match){dollarTag=match[0];index+=dollarTag.length-1;continue}
    }
    if(char==="("){depth+=1;continue}
    if(char===")"){depth=Math.max(0,depth-1);continue}
    if(depth!==0)continue;
    const rest=statement.slice(index);
    const match=rest.match(/^(SELECT|INSERT|UPDATE|DELETE)\b/i);
    if(match)return index;
  }
  return-1;
}

function captureRows(statement:string,marker:string){
  const commandIndex=topLevelCommandIndex(statement);
  const aggregate=`SELECT ${quote(marker)} || COALESCE(json_agg(row_to_json(__flytally_local_tx_result)),'[]'::json)::text FROM __flytally_local_tx_result`;
  if(commandIndex>=0){
    const prefix=statement.slice(0,commandIndex).trimEnd(),command=statement.slice(commandIndex);
    return `${prefix}, __flytally_local_tx_result AS (${command}) ${aggregate}`;
  }
  return `WITH __flytally_local_tx_result AS (${statement}) ${aggregate}`;
}

function executeLocalTransaction(statements:string[]){
  const chunks=statements.map((statement,index)=>{
    const marker=`${TRANSACTION_RESULT_PREFIX}${index}:`;
    if(rowProducing(statement))return captureRows(statement,marker);
    return `${statement};
SELECT ${quote(`${marker}[]`)}`;
  });
  const output=spawn(`BEGIN;\n${chunks.join(";\n")};\nCOMMIT;`);
  const results=statements.map(()=>[] as Array<Record<string,unknown>>);
  for(const line of output.split(/\r?\n/)){
    if(!line.startsWith(TRANSACTION_RESULT_PREFIX))continue;
    const separator=line.indexOf(":");
    const index=Number(line.slice(TRANSACTION_RESULT_PREFIX.length,separator));
    if(!Number.isSafeInteger(index)||index<0||index>=results.length)continue;
    const payload=line.slice(separator+1);
    const parsed=JSON.parse(payload);
    if(!Array.isArray(parsed))throw new Error("Local PostgreSQL transaction returned malformed row data.");
    results[index]=parsed as Array<Record<string,unknown>>;
  }
  return results;
}

type Rows=Array<Record<string,unknown>>;
type DeferredLocalQuery=Promise<Rows>&{
  __flytallyLocalStatement:string;
  __flytallyLocalClaimed:boolean;
  __flytallyLocalStarted:boolean;
  __flytallyLocalResolve:(rows:Rows)=>void;
  __flytallyLocalReject:(error:unknown)=>void;
};
type LocalPostgresQuery=((strings:TemplateStringsArray,...values:unknown[])=>Promise<Rows>)&{
  transaction:(queries:unknown[])=>Promise<Rows[]>;
};

function deferredQuery(statement:string):DeferredLocalQuery{
  let resolveQuery:(rows:Rows)=>void=()=>{},rejectQuery:(error:unknown)=>void=()=>{};
  const promise=new Promise<Rows>((resolve,reject)=>{resolveQuery=resolve;rejectQuery=reject}) as DeferredLocalQuery;
  promise.__flytallyLocalStatement=statement;
  promise.__flytallyLocalClaimed=false;
  promise.__flytallyLocalStarted=false;
  promise.__flytallyLocalResolve=resolveQuery;
  promise.__flytallyLocalReject=rejectQuery;
  queueMicrotask(()=>{
    if(promise.__flytallyLocalClaimed)return;
    promise.__flytallyLocalStarted=true;
    try{promise.__flytallyLocalResolve(execute(statement))}
    catch(error){promise.__flytallyLocalReject(error)}
  });
  return promise;
}

function asDeferredLocalQuery(value:unknown):DeferredLocalQuery{
  const query=value as Partial<DeferredLocalQuery>|null;
  if(!query||typeof query!=="object"||typeof query.__flytallyLocalStatement!=="string"||typeof query.__flytallyLocalResolve!=="function"){
    throw new Error("Local PostgreSQL smoke transactions require inline local SQL queries.");
  }
  return query as DeferredLocalQuery;
}

export function createLocalPostgresQuery(){
  const query=((strings:TemplateStringsArray,...values:unknown[])=>deferredQuery(render(strings,values))) as unknown as LocalPostgresQuery;
  query.transaction=async(queries:unknown[])=>{
    const localQueries=queries.map(asDeferredLocalQuery);
    if(localQueries.some(item=>item.__flytallyLocalStarted))throw new Error("Local PostgreSQL transaction queries must be created inline.");
    for(const item of localQueries)item.__flytallyLocalClaimed=true;
    try{
      const results=await Promise.resolve().then(()=>executeLocalTransaction(localQueries.map(item=>item.__flytallyLocalStatement)));
      localQueries.forEach((item,index)=>item.__flytallyLocalResolve(results[index]??[]));
      return results;
    }catch(error){
      localQueries.forEach(item=>item.__flytallyLocalResolve([]));
      throw error;
    }
  };
  return query;
}
