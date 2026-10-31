// Currency v21 release guard and evidence parser.
// Kept independent of the database client so denied paths can be tested without
// starting Next.js or connecting to a real database.
export type CurrencyV21ShapeEvidence={
  columns_count:number|string;
  checks_count:number|string;
};

export function allowDisposableLocalV21Migration(env:Readonly<Record<string,string|undefined>>):boolean{
  // Routing to local PostgreSQL is NOT itself permission to run schema DDL.
  if(env.FLYTALLY_LOCAL_POSTGRES!=="1"
    ||env.FLYTALLY_AUTH_BROWSER!=="1"
    ||env.FLYTALLY_CURRENCY_V21_BROWSER!=="1"
    ||env.VERCEL!==undefined
    ||env.VERCEL_ENV!==undefined
    ||!env.DATABASE_URL)return false;
  try{
    const url=new URL(env.DATABASE_URL);
    return ["postgresql:","postgres:"].includes(url.protocol)
      &&url.hostname==="127.0.0.1"
      &&url.port!==""&&url.port!=="5432"&&url.port!=="55432"
      &&url.username==="flytally"
      &&url.password===""
      &&decodeURIComponent(url.pathname)==="/flytally_currency_test";
  }catch{
    return false;
  }
}

export function assertCurrencyV21SchemaEvidence(
  migrationName:string,
  evidence:CurrencyV21ShapeEvidence|undefined,
):void{
  const columns=Number(evidence?.columns_count);
  const checks=Number(evidence?.checks_count);
  if(migrationName!=="source-backed currency exact-money"
    ||!Number.isInteger(columns)||columns!==12
    ||!Number.isInteger(checks)||checks!==4){
    throw new Error("Currency schema v21 registry present but physical shape invalid.");
  }
}
