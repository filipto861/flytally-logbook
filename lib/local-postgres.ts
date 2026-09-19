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

function quote(value:string){
  if(value.includes("\0"))throw new Error("NUL bytes are not allowed in SQL values.");
  return `'${value.replaceAll("'","''")}'`;
}

function render(strings:TemplateStringsArray,values:unknown[]){
  let statement=strings[0]??"";
  for(let index=0;index<values.length;index+=1)statement+=literal(values[index])+(strings[index+1]??"");
  return statement.trim().replace(/;\s*$/,"");
}

function execute(statement:string){
  const rowProducing=/^(?:SELECT|WITH)\b/i.test(statement)||/\bRETURNING\b/i.test(statement);
  const command=rowProducing
    ? `WITH __flytally_local_result AS (${statement}) SELECT COALESCE(json_agg(row_to_json(__flytally_local_result)),'[]'::json)::text FROM __flytally_local_result;`
    : statement;
  const result=spawnSync("psql",[localDatabaseUrl(),"-X","-qAt","-v","ON_ERROR_STOP=1","-c",command],{
    encoding:"utf8",
    env:{...process.env,PGCONNECT_TIMEOUT:"5"},
    maxBuffer:16*1024*1024,
  });
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Local PostgreSQL query failed: ${String(result.stderr||result.stdout).trim()}`);
  if(!rowProducing)return[];
  const output=String(result.stdout??"").trim();
  if(!output)return[];
  return JSON.parse(output) as Array<Record<string,unknown>>;
}

type LocalPostgresQuery=((strings:TemplateStringsArray,...values:unknown[])=>Promise<Array<Record<string,unknown>>>)&{
  transaction:(queries:unknown[])=>Promise<never>;
};

export function createLocalPostgresQuery(){
  const query=((strings:TemplateStringsArray,...values:unknown[])=>{
    const statement=render(strings,values);
    return Promise.resolve().then(()=>execute(statement));
  }) as LocalPostgresQuery;
  query.transaction=async()=>{
    throw new Error("Local PostgreSQL smoke adapter does not support transactions. Browser smoke must pre-bootstrap the schema.");
  };
  return query;
}
