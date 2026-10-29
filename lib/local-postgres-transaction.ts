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
