/**
 * Local-only transaction option gate for the existing psql-backed adapter.
 * This is a pure script transform so legacy mutation transactions stay
 * byte-for-byte identical and unknown snapshot modes fail closed.
 *
 * Neon HTTP's option names use "RepeatableRead" and readOnly:true.
 * PostgreSQL BEGIN uses the SQL spelling below.
 */
export type LocalReadOnlySnapshotOptions={
  isolationLevel:"RepeatableRead";
  readOnly:true;
};

export function applyLocalPostgresTransactionOptions(
  legacyScript:string,
  options?:LocalReadOnlySnapshotOptions,
):string{
  if(options===undefined)return legacyScript;
  if(!options||typeof options!=="object"||Array.isArray(options)
    ||Reflect.ownKeys(options).length!==2
    ||!Object.prototype.hasOwnProperty.call(options,"isolationLevel")
    ||!Object.prototype.hasOwnProperty.call(options,"readOnly")
    ||options.isolationLevel!=="RepeatableRead"
    ||options.readOnly!==true){
    throw new Error("Unsupported local PostgreSQL transaction options; no SQL executed.");
  }
  if(!legacyScript.startsWith("BEGIN;\n")||!legacyScript.endsWith("\nCOMMIT;")){
    throw new Error("Unexpected local PostgreSQL transaction script; no SQL executed.");
  }
  return "BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;"
    +legacyScript.slice("BEGIN;".length);
}

/**
 * All locally batched statements must emit exactly one result marker,
 * including successful statements returning zero rows. A missing marker
 * is NOT an empty query result: silently replacing one could sign an
 * incomplete backup or misreport a committed restore.
 *
 * Only the local PostgreSQL smoke adapter uses this parser. It never
 * prints or persists query results, GPS records, account data or secrets.
 */
const LOCAL_RESULT_PREFIX="__flytally_local_tx__";

export function parseLocalPostgresTransactionResults(
  output:string,
  expectedStatements:number,
):Array<Array<Record<string,unknown>>>{
  if(!Number.isSafeInteger(expectedStatements)||expectedStatements<0)
    throw new Error("Local PostgreSQL transaction has an invalid statement count.");
  const results:Array<Array<Record<string,unknown>>>=Array.from({length:expectedStatements},()=>[]);
  const seen=new Set<number>();
  for(const line of output.split(/\r?\n/)){
    if(line==="")continue;
    if(!line.startsWith(LOCAL_RESULT_PREFIX))
      throw new Error("Local PostgreSQL transaction returned unexpected output.");
    const separator=line.indexOf(":",LOCAL_RESULT_PREFIX.length);
    const indexToken=line.slice(LOCAL_RESULT_PREFIX.length,separator);
    if(separator<0||!/^(?:0|[1-9]\d*)$/.test(indexToken))
      throw new Error("Local PostgreSQL transaction has an invalid result marker.");
    const index=Number(indexToken);
    if(!Number.isSafeInteger(index)||index>=expectedStatements||seen.has(index))
      throw new Error("Local PostgreSQL transaction has an unexpected or duplicate result.");
    let parsed:unknown;
    try{parsed=JSON.parse(line.slice(separator+1));}
    catch{throw new Error("Local PostgreSQL transaction returned malformed JSON.");}
    if(!Array.isArray(parsed)||parsed.some(row=>row===null||typeof row!=="object"||Array.isArray(row)))
      throw new Error("Local PostgreSQL transaction returned malformed row data.");
    seen.add(index);
    results[index]=parsed as Array<Record<string,unknown>>;
  }
  if(seen.size!==expectedStatements)
    throw new Error("Local PostgreSQL transaction returned an incomplete result set.");
  return results;
}
