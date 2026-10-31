import {test,expect} from "@playwright/test";
import {loginBrowserPilot} from "./browser-actions.mjs";
import {runBrowserSql,browserSqlScalar} from "./browser-db.mjs";

// Destructive browser fixtures are permitted ONLY in an isolated, freshly
// bootstrapped localhost PostgreSQL cluster. The dedicated PowerShell runner
// supplies a unique temporary cluster; NEVER run against an existing database.
const authenticated=process.env.FLYTALLY_AUTH_BROWSER==="1" &&
  process.env.FLYTALLY_LOCAL_POSTGRES==="1";

function scalar(sql){return browserSqlScalar(sql);}
function seed(flightId,withParticipation=false){
  if(!authenticated)throw new Error("D3b browser mutation fixture requires isolated auth browser mode.");
  const selected=flightId*10+1,retained=flightId*10+2;
  runBrowserSql(`
    BEGIN;
    DELETE FROM deleted_flights WHERE original_flight_id=${flightId} AND user_id=9001;
    DELETE FROM flight_participations WHERE source_flight_id=${flightId} AND source_user_id=9001;
    DELETE FROM track_points WHERE track_id IN (${selected},${retained}) AND user_id=9001;
    DELETE FROM flight_tracks WHERE id IN (${selected},${retained}) AND user_id=9001;
    DELETE FROM flight_expenses WHERE flight_id=${flightId} AND user_id=9001;
    DELETE FROM flights WHERE id=${flightId} AND user_id=9001 AND certified_at IS NULL;
    INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_type,aircraft_make,aircraft_model,
      aircraft_class,regulatory_category,operation_type,engine_t¶»§q«^