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
  const result=spawnSync("psql",[localDatabaseUrl(),"-X","-qAt","-v","ON_ERROR_STOP=1","-c",statement],{
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
  const command=producesRows
    ? `WITH __flytally_local_result AS (${statement}) SELECT COALESCE(json_agg(row_to_json(__flytally_local_result)),'[]'::json)::text FROM __flytally_local_result;`
    : statement;
  const output=spawn(command);
  if(!producesRows||!output)return[];
  return JSON.parse(output) as Array<Record<string,unknown>>;
}

function executeMutationTransaction(statements:string[]){
  if(statements.some(rowProducing))throw new Error("Local PostgreSQL smoke transactions support mutation statements only.");
  spawn(`BEGIN;\n${statements.join(";\n")};\nCOMMIT;`);
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
      await Promise.resolve().then(()=>executeMutationTransaction(localQueries.map(item=>item.__flytallyLocalStatement)));
      const results=localQueries.map(()=>[] as Rows);
      localQueries.forEach((item,index)=>item.__flytallyLocalResolve(results[index]));
      return results;
    }catch(error){
      localQueries.forEach(item=>item.__flytallyLocalResolve([]));
      throw error;
    }
  };
  return query;
}
