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


export function resetAccountSettingsFixture(){
  runBrowserSql(`
    UPDATE users SET display_name='Browser Smoke Pilot',updated_at=NOW() WHERE id=9001;
    UPDATE user_settings SET timezone='Europe/Prague',currency='CZK',home_airport='LKLT',default_role='PIC',preferences_json='{}'::jsonb,updated_at=NOW() WHERE user_id=9001;
  `);
}

export function resetConnectionManagerFixture(){
  runBrowserSql(`
    UPDATE pilot_connections
    SET relationship='pilot',status='accepted',requester_label='friend',recipient_label='friend',
        requester_shares_logbook=FALSE,recipient_shares_logbook=FALSE,accepted_at=NOW(),updated_at=NOW()
    WHERE id=7001;
    DELETE FROM connection_audit_log WHERE entity_type='connection' AND entity_id=7001;
  `);
}


export function resetIntelligentReviewFormScopeFixture(){
  runBrowserSql(`
    CREATE TABLE IF NOT EXISTS airports(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL DEFAULT 0,
      ident TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      latitude_deg DOUBLE PRECISION,
      longitude_deg DOUBLE PRECISION,
      active INTEGER NOT NULL DEFAULT 1,
      closed INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT ''
    );
    DELETE FROM flights WHERE user_id=9001 AND id IN (9911,9912,9913);
    DELETE FROM aircraft WHERE user_id=9001 AND registration='OK-HST1';
    INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_class,regulatory_category,evidence,default_role,billing_basis,default_price_per_hour,active)
    VALUES(9001,'OK-HST1','B23','BRM Aero','Bristell B23','SEP','AEROPLANE','EASA','PIC','BLOCK',0,1);
    INSERT INTO flights(
      id,user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,
      departure,arrival,off_block,takeoff,landing,on_block,role,starts,pic_minutes,landings_day,commander
    ) VALUES
      (9911,9001,'2026-09-16','EASA','OK-HST1','B23','SEP','AEROPLANE','LKLT','LKPR','08:00','08:05','08:45','08:50','PIC',1,50,1,'Browser Smoke Pilot'),
      (9912,9001,'2026-09-17','EASA','OK-HST1','B23','SEP','AEROPLANE','LKPR','LKLT','09:00','09:05','09:45','09:50','PIC',1,50,1,'Browser Smoke Pilot'),
      (9913,9001,'2026-09-18','EASA','OK-HST1','B23','SEP','AEROPLANE','LKLT','LKPR','10:00','10:05','10:45','10:50','PIC',1,50,1,'Browser Smoke Pilot');
  `);
}


export function resetGpsNormalizedImportFixture(){
  runBrowserSql(`
    DELETE FROM flight_tracks
    WHERE user_id=9001 AND flight_id IN(
      SELECT id FROM flights
      WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-01'
        AND off_block='18:00'
    );
    DELETE FROM flights
    WHERE user_id=9001 AND registration='OK-E2E' AND date='2026-10-01'
      AND off_block='18:00' AND certified_at IS NULL;
  `);
}

export function resetSafetyPilotPicFixture(){
  runBrowserSql(`
    UPDATE users SET display_name='Browser Friend' WHERE id=9002;
    UPDATE pilot_connections
    SET relationship='pilot',status='accepted',requester_label='friend',recipient_label='friend',
        accepted_at=NOW(),updated_at=NOW()
    WHERE id=7001;
    DELETE FROM flights WHERE user_id=9001 AND registration='OK-SP2E' AND certified_at IS NULL;
    DELETE FROM flight_connected_crew WHERE source_user_id=9001 OR connected_user_id=9001;
  `);
}

export function renameSafetyPilotPicFixture(displayName){
  const safe=String(displayName??"").replaceAll("'","''");
  runBrowserSql(`UPDATE users SET display_name='${safe}' WHERE id=9002;`);
}

export function revokeSafetyPilotPicConnectionFixture(){
  runBrowserSql(`
    UPDATE pilot_connections SET status='cancelled',accepted_at=NULL,updated_at=NOW() WHERE id=7001;
  `);
}


export function resetSafetyPilotPicInviteFixture(){
  runBrowserSql(`
    UPDATE users SET display_name='Browser Friend' WHERE id=9002;
    UPDATE pilot_connections
    SET relationship='pilot',status='accepted',requester_label='friend',recipient_label='friend',
        accepted_at=NOW(),updated_at=NOW()
    WHERE id=7001;
    DELETE FROM user_notifications WHERE user_id=9002 AND href LIKE '/connections/shared/%';
    DELETE FROM flight_participations WHERE source_flight_id=9903 AND source_user_id=9001;
    DELETE FROM flight_connected_crew WHERE source_flight_id=9903 AND source_user_id=9001;
    DELETE FROM flights WHERE id=9903 AND user_id=9001;
    INSERT INTO flights(
      id,user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,
      departure,arrival,off_block,takeoff,landing,on_block,role,starts,commander,
      landings_day,movement_evidence_recorded,takeoffs_day,approaches_day,
      certified_at,certified_by_user_id,certification_hash,certification_version,
      record_revision,locked_at,locked_by_user_id
    ) VALUES(
      9903,9001,'2026-09-20','EASA','OK-SP2E','B23','SEP','AEROPLANE',
      'LKLT','LKPR','10:00','10:05','11:05','11:12','SAFETY PILOT',3,'Browser Friend',
      3,TRUE,3,3,NOW(),9001,'browser-sp3-hash',8,1,NOW(),9001
    );
    INSERT INTO flight_connected_crew(source_flight_id,source_user_id,connected_user_id,intended_role)
    VALUES(9903,9001,9002,'PIC');
  `);
}

export function revokeSafetyPilotPicInviteConnectionFixture(){
  runBrowserSql(`
    UPDATE pilot_connections SET status='cancelled',accepted_at=NULL,updated_at=NOW() WHERE id=7001;
  `);
}
