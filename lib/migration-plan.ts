export const DATABASE_SCHEMA_VERSION=15;

export const DATABASE_MIGRATIONS=[
  {version:1,name:"flight audit and locking"},
  {version:2,name:"backups and recoverable trash"},
  {version:3,name:"core query indexes"},
  {version:4,name:"restore and route performance indexes"},
  {version:5,name:"EASA FCL.050 flight logbook fields"},
  {version:6,name:"FCL.050 structured aircraft, FSTD and certification"},
  {version:7,name:"certified flight correction revisions"},
  {version:8,name:"certified FSTD correction revisions"},
  {version:9,name:"private beta authentication foundation"},
  {version:10,name:"private pilot connections"},
  {version:11,name:"instructor flight approvals"},
  {version:12,name:"shared flight participation"},
  {version:13,name:"crew connections and verified approvals"},
  {version:14,name:"user-owned structured flight expenses"},
  {version:15,name:"revocable public flight sharing"},
] as const;

export function pendingMigrationVersions(applied:Iterable<number>){
  const completed=new Set(applied);
  return DATABASE_MIGRATIONS.filter(migration=>!completed.has(migration.version)).map(migration=>migration.version);
}