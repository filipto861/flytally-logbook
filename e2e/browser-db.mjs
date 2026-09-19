import { spawnSync } from "node:child_process";

const LOCAL_HOSTS=new Set(["127.0.0.1","localhost","::1","[::1]"]);

function databaseUrl(){
  const value=process.env.DATABASE_URL?.trim();
  if(!value)throw new Error("DATABASE_URL is required for authenticated mutation smoke.");
  const parsed=new URL(value);
  if(!LOCAL_HOSTS.has(parsed.hostname))throw new Error("Authenticated mutation smoke may only reset a localhost database.");
  return value;
}

export function runBrowserSql(statement){
  if(process.env.FLYTALLY_AUTH_BROWSER!=="1")throw new Error("Browser DB reset is only available in authenticated smoke mode.");
  const result=spawnSync("psql",[databaseUrl(),"-X","-q","-v","ON_ERROR_STOP=1","-c",statement],{
    encoding:"utf8",
    env:{...process.env,PGCONNECTTIMEOUT:"5"},
    maxBuffer:4*1024*1024,
  });
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Browser fixture reset failed: ${String(result.stderr||result.stdout).trim()}`);
}

export function resetAppearanceFixture(){
  runBrowserSql(`UPDATE user_settings SET preferences_json='{}'::jsonb,updated_at=NOW() WHERE user_id=9001;`);
}

export function resetConnectionFixture(){
  runBrowserSql(`
    UPDATE pilot_connections SET status='pending',accepted_at=NULL,updated_at=NOW() WHERE id=7001;
    DELETE FROM user_notifications WHERE user_id=9002 AND dedupe_key='connection-accepted:7001';
    INSERT INTO user_notifications(user_id,kind,title,body,href,dedupe_key,read_at)
    VALUES(9001,'connection_request','New connection request','Browser fixture request','/connections','connection:7001',NULL)
    ON CONFLICT(user_id,dedupe_key) DO UPDATE SET read_at=NULL,created_at=NOW();
  `);
}
