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
      aircraft_class,regulatory_category,operation_type,engine_type,departure,arrival,
      off_block,takeoff,landing,on_block,role,starts,landings_day,commander)
    VALUES(${flightId},9001,'2026-10-12','EASA','OK-E2E','B23','BRM Aero','Bristell B23',
      'SEP','AEROPLANE','SP','SE','LKLT','LKPR','11:00','11:05','11:50','11:55','PIC',1,1,'Browser Smoke Pilot');
    INSERT INTO flight_tracks(id,user_id,flight_id,file_name,point_count,distance_km,coordinates_json)
    VALUES(${selected},9001,${flightId},'selected.csv',2,2.1,'[]'),
          (${retained},9001,${flightId},'retained.csv',2,3.1,'[]');
    INSERT INTO track_points(user_id,track_id)
    VALUES(9001,${selected}),(9001,${selected}),(9001,${retained}),(9001,${retained});
    INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency)
    VALUES(9001,${flightId},'OTHER','Browser fuel',1250,'EUR');
    ${withParticipation?`INSERT INTO flight_participations(source_flight_id,source_user_id,participant_user_id,participant_role,source_revision,source_hash,status)
    VALUES(${flightId},9001,9002,'INSTRUCTOR',1,'','pending');`:""}
    COMMIT;
  `);
  return {selected,retained};
}

test("D3b-1 browser: deleting one GPS track preserves the other, then Trash atomically archives expenses and retained GPS",async({page})=>{
  test.skip(!authenticated,"Requires freshly isolated localhost authentication fixture, not any existing database.");
  const flightId=9961,{selected,retained}=seed(flightId);
  await loginBrowserPilot(page,`/flights/${flightId}`);
  const gpsTab=page.getByRole("tab",{name:/GPS track/});
  await expect(gpsTab).toBeVisible();
  await gpsTab.click();
  const manager=page.locator("details.track-manager");
  await manager.locator("summary").click();
  const removeSelected=manager.locator("form.track-row").filter({hasText:"selected.csv"});
  await expect(removeSelected).toBeVisible();
  await removeSelected.getByRole("button",{name:"Delete"}).click();
  await expect(manager.locator("form.track-row").filter({hasText:"selected.csv"})).toHaveCount(0);
  await expect(manager.locator("form.track-row").filter({hasText:"retained.csv"})).toHaveCount(1);
  expect(scalar(`SELECT COUNT(*) FROM flight_tracks WHERE id=${selected}`)).toBe("0");
  expect(scalar(`SELECT COUNT(*) FROM track_points WHERE track_id=${selected}`)).toBe("0");
  expect(scalar(`SELECT COUNT(*) FROM flight_tracks WHERE id=${retained}`)).toBe("1");
  expect(scalar(`SELECT COUNT(*) FROM track_points WHERE track_id=${retained}`)).toBe("2");

  await page.locator("details.flight-detail-more").locator("summary").click();
  await page.getByRole("button",{name:"Move to trash"}).click();
  await page.getByRole("button",{name:"Confirm deletion"}).click();
  await expect(page).toHaveURL(/\/flights(?:\?|$)/,{timeout:20000});

  expect(scalar(`SELECT COUNT(*) FROM flights WHERE id=${flightId} AND user_id=9001`)).toBe("0");
  expect(scalar(`SELECT COUNT(*) FROM flight_tracks WHERE flight_id=${flightId} AND user_id=9001`)).toBe("0");
  expect(scalar(`SELECT COUNT(*) FROM track_points WHERE track_id IN (${selected},${retained}) AND user_id=9001`)).toBe("0");
  expect(scalar(`SELECT COUNT(*) FROM flight_expenses WHERE flight_id=${flightId} AND user_id=9001`)).toBe("0");
  expect(scalar(`SELECT COUNT(*) FROM deleted_flights WHERE original_flight_id=${flightId} AND user_id=9001 AND restored_at IS NULL`)).toBe("1");
  expect(scalar(`SELECT jsonb_array_length(tracks_data) FROM deleted_flights WHERE original_flight_id=${flightId} AND user_id=9001`)).toBe("1");
  expect(scalar(`SELECT tracks_data->0->>'file_name' FROM deleted_flights WHERE original_flight_id=${flightId} AND user_id=9001`)).toBe("retained.csv");
  expect(scalar(`SELECT jsonb_array_length(expenses_data) FROM deleted_flights WHERE original_flight_id=${flightId} AND user_id=9001`)).toBe("1");
  expect(scalar(`SELECT expenses_data->0->>'label' FROM deleted_flights WHERE original_flight_id=${flightId} AND user_id=9001`)).toBe("Browser fuel");
});

test("D3b-1 browser: pending collaboration refuses ordinary Trash with no archive or evidence deletion",async({page})=>{
  test.skip(!authenticated,"Requires freshly isolated localhost authentication fixture, not any existing database.");
  const flightId=9962,{selected,retained}=seed(flightId,true);
  await loginBrowserPilot(page,`/flights/${flightId}`);
  await page.locator("details.flight-detail-more").locator("summary").click();
  await page.getByRole("button",{name:"Move to trash"}).click();
  await page.getByRole("button",{name:"Confirm deletion"}).click();
  await expect(page).toHaveURL(new RegExp(`/flights/${flightId}\\?trash=blocked`),{timeout:20000});
  await expect(page.getByRole("alert")).toContainText("not moved to Trash");
  expect(scalar(`SELECT COUNT(*) FROM flights WHERE id=${flightId} AND user_id=9001`)).toBe("1");
  expect(scalar(`SELECT COUNT(*) FROM deleted_flights WHERE original_flight_id=${flightId} AND user_id=9001`)).toBe("0");
  expect(scalar(`SELECT COUNT(*) FROM flight_participations WHERE source_flight_id=${flightId} AND source_user_id=9001 AND status='pending'`)).toBe("1");
  expect(scalar(`SELECT COUNT(*) FROM flight_tracks WHERE id IN (${selected},${retained}) AND user_id=9001`)).toBe("2");
  expect(scalar(`SELECT COUNT(*) FROM track_points WHERE track_id IN (${selected},${retained}) AND user_id=9001`)).toBe("4");
  expect(scalar(`SELECT COUNT(*) FROM flight_expenses WHERE flight_id=${flightId} AND user_id=9001`)).toBe("1");
});
