import "server-only";
import { gzipSync,gunzipSync } from "node:zlib";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { buildAccountBackup } from "@/lib/account-backup";
import { parsePortableBackup } from "@/lib/portable-backup";

export type BackupKind="automatic"|"manual"|"pre_restore";
export type StoredBackup={id:number;kind:BackupKind;version:number;exportedAt:string;createdAt:string;digest:string;rawBytes:number;compressedBytes:number;counts:Record<string,number>};

const mapCounts=(value:unknown):Record<string,number>=>{let source=value;if(typeof source==="string")try{source=JSON.parse(source)}catch{source={}};if(!source||typeof source!=="object"||Array.isArray(source))return{};return Object.fromEntries(Object.entries(source as Record<string,unknown>).map(([key,count])=>[key,Number(count)||0]))};

async function pruneBackups(userId:number){
  await sql`WITH automatic AS (
      SELECT id,created_at,ROW_NUMBER() OVER(ORDER BY created_at DESC,id DESC) daily_rank FROM account_backups WHERE user_id=${userId} AND kind='automatic'
    ), weekly_representatives AS (
      SELECT DISTINCT ON (date_trunc('week',created_at)) id,created_at FROM account_backups WHERE user_id=${userId} AND kind='automatic' ORDER BY date_trunc('week',created_at),created_at DESC,id DESC
    ), weekly AS (SELECT id,ROW_NUMBER() OVER(ORDER BY created_at DESC,id DESC) rank FROM weekly_representatives), monthly_representatives AS (
      SELECT DISTINCT ON (date_trunc('month',created_at)) id,created_at FROM account_backups WHERE user_id=${userId} AND kind='automatic' ORDER BY date_trunc('month',created_at),created_at DESC,id DESC
    ), monthly AS (SELECT id,ROW_NUMBER() OVER(ORDER BY created_at DESC,id DESC) rank FROM monthly_representatives), manual AS (
      SELECT id,ROW_NUMBER() OVER(ORDER BY created_at DESC,id DESC) rank FROM account_backups WHERE user_id=${userId} AND kind='manual'
    ), pre_restore AS (
      SELECT id,ROW_NUMBER() OVER(ORDER BY created_at DESC,id DESC) rank FROM account_backups WHERE user_id=${userId} AND kind='pre_restore'
    ), keep AS (
      SELECT id FROM automatic WHERE daily_rank<=7 UNION SELECT id FROM weekly WHERE rank<=4 UNION SELECT id FROM monthly WHERE rank<=6 UNION SELECT id FROM manual WHERE rank<=10 UNION SELECT id FROM pre_restore WHERE rank<=5
    ) DELETE FROM account_backups WHERE user_id=${userId} AND id NOT IN(SELECT id FROM keep)`;
}

export async function createStoredBackup(userId:number,kind:BackupKind):Promise<StoredBackup|null>{
  await ensureDatabaseOptimizations();
  if(kind==="automatic"){
    const recent=await sql`SELECT id FROM account_backups WHERE user_id=${userId} AND kind='automatic' AND created_at>NOW()-INTERVAL '20 hours' LIMIT 1`;
    if(recent[0])return null;
  }
  const built=await buildAccountBackup(userId),raw=Buffer.from(built.json,"utf8"),compressed=gzipSync(raw,{level:9});
  if(compressed.byteLength>50*1024*1024)throw new Error("Compressed backup exceeds the 50 MB storage safety limit.");
  const rows=await sql`INSERT INTO account_backups(user_id,kind,version,exported_at,payload_base64,payload_sha256,raw_bytes,compressed_bytes,counts)
    SELECT ${userId},${kind},${built.backup.version},${built.backup.exported_at},${compressed.toString("base64")},${built.digest},${raw.byteLength},${compressed.byteLength},${JSON.stringify(built.backup.counts)}::jsonb
    WHERE ${kind}<>'automatic' OR NOT EXISTS(SELECT 1 FROM account_backups WHERE user_id=${userId} AND kind='automatic' AND created_at>NOW()-INTERVAL '20 hours')
    RETURNING id,kind,version,exported_at,created_at,payload_sha256,raw_bytes,compressed_bytes,counts` as Array<Record<string,unknown>>;
  if(!rows[0])return null;await pruneBackups(userId);return mapStoredBackup(rows[0]);
}

const mapStoredBackup=(row:Record<string,unknown>):StoredBackup=>({id:Number(row.id),kind:String(row.kind) as BackupKind,version:Number(row.version),exportedAt:String(row.exported_at||""),createdAt:String(row.created_at||""),digest:String(row.payload_sha256||""),rawBytes:Number(row.raw_bytes||0),compressedBytes:Number(row.compressed_bytes||0),counts:mapCounts(row.counts)});

export async function listStoredBackups(userId:number):Promise<StoredBackup[]>{
  await ensureDatabaseOptimizations();const rows=await sql`SELECT id,kind,version,exported_at,created_at,payload_sha256,raw_bytes,compressed_bytes,counts FROM account_backups WHERE user_id=${userId} ORDER BY created_at DESC,id DESC LIMIT 30` as Array<Record<string,unknown>>;return rows.map(mapStoredBackup);
}

export async function loadStoredBackup(userId:number,id:number){
  await ensureDatabaseOptimizations();const rows=await sql`SELECT payload_base64,payload_sha256 FROM account_backups WHERE id=${id} AND user_id=${userId} LIMIT 1` as Array<{payload_base64:string;payload_sha256:string}>;if(!rows[0])throw new Error("Backup not found.");
  let json:string;try{json=gunzipSync(Buffer.from(rows[0].payload_base64,"base64")).toString("utf8")}catch{throw new Error("Stored backup could not be decompressed.")}
  const parsed=await parsePortableBackup(json);if(parsed.digest!==rows[0].payload_sha256)throw new Error("Stored backup integrity check failed.");return{...parsed,json};
}

export async function ensureDailyBackup(userId:number){try{return await createStoredBackup(userId,"automatic")}catch(error){console.error("automatic-backup-failed",{userId,error});return null}}
