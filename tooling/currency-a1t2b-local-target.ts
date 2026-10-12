/**
 * A1-T2b: fail-closed identity preflight for disposable local PostgreSQL 16.
 * Pure checks; never contacts the database and never authorizes a remote write.
 */
export type DisposablePgTarget = Readonly<{
  database: "flytally_currency_test";
  user: "flytally";
  address: "127.0.0.1";
  port: number;
}>;
export type TargetResult = {ok:true;target:DisposablePgTarget}|{ok:false;reason:string};

export function validateDisposablePgTarget(connection:unknown):TargetResult {
  if(typeof connection!=="string"||!connection) return {ok:false,reason:"missing_database_url"};
  let url:URL;
  try{url=new URL(connection)}catch{return {ok:false,reason:"invalid_database_url"}}
  if(!["postgres:","postgresql:"].includes(url.protocol)||
    url.hostname!=="127.0.0.1"||
    url.username!=="flytally"||url.password!==""||
    url.pathname!=="/flytally_currency_test"||
    url.search!==""||url.hash!==""||
    !/^[0-9]{4,5}$/.test(url.port)) return {ok:false,reason:"not_disposable_loopback_target"};
  const port=Number(url.port);
  if(!Number.isSafeInteger(port)||port<1025||port>65535||port===5432) return {ok:false,reason:"not_disposable_loopback_target"};
  return {ok:true,target:{database:"flytally_currency_test",user:"flytally",address:"127.0.0.1",port}};
}

export type PgActualIdentity=Readonly<{
  database:unknown;
  user:unknown;
  address:unknown;
  port:unknown;
  serverVersionNumber:unknown;
}>;

/** Must be checked BEFORE CREATE SCHEMA or any DDL. */
export function verifyDisposablePg16Identity(actual:PgActualIdentity,target:DisposablePgTarget):boolean {
  return actual.database===target.database&&actual.user===target.user&&
    actual.address===target.address&&Number(actual.port)===target.port&&
    /^16[0-9]{4}$/.test(String(actual.serverVersionNumber));
}
