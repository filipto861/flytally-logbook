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
  await page.goto(`/flights/${flightId}?tab=gps`);
  const gpsTab=page.getByRole("tab",{name:/GPS track/});
  await expect(gpsTab).toBeVisible();
  await gpsTab.click();
  const manager=page.locator("details.track-manager");
  await manager.locator("summary").click();
  const removeSelected=manager.locator("form.track-row").filter({hasText:"selected.csv"});
  await expect(removeSelected).toBeVisible();
  const backupsBefore=Number(scalar("SELECT COUNT(*) FROM account_backups WHERE user_id=9001 AND kind='pre_restore'"));
  await removeSelected.getByRole("button",{name:"Delete"}).click();
  await expect(manager.locator("form.track-row").filter({hasText:"selected.csv"})).toHaveCount(0);
  expect(Number(scalar("SELECT COUNT(*) FROM account_backups WHERE user_id=9001 AND kind='pre_restore'"))).toBe(backupsBefore+1);
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
  await expect(page.locator("p.form-error[role=alert]")).toContainText("not moved to Trash");
  expect(scalar(`SELECT COUNT(*) FROM flights WHERE id=${flightId} AND user_id=9001`)).toBe("1");
  expect(scalar(`SELECT COUNT(*) FROM deleted_flights WHERE original_flight_id=${flightId} AND user_id=9001`)).toBe("0");
  expect(scalar(`SELECT COUNT(*) FROM flight_participations WHERE source_flight_id=${flightId} AND source_user_id=9001 AND status='pending'`)).toBe("1");
  expect(scalar(`SELECT COUNT(*) FROM flight_tracks WHERE id IN (${selected},${retained}) AND user_id=9001`)).toBe("2");
  expect(scalar(`SELECT COUNT(*) FROM track_points WHERE track_id IN (${selected},${retained}) AND user_id=9001`)).toBe("4");
  expect(scalar(`SELECT COUNT(*) FROM flight_expenses WHERE flight_id=${flightId} AND user_id=9001`)).toBe("1");
});


test("Currency 3.8 browser: archived KWD/JPY flight restores exact metadata through UI",async({page},testInfo)=>{
  test.skip(!authenticated,"Requires dedicated disposable localhost PostgreSQL16 and authenticated browser fixture.");
  const flightId=testInfo.project.name==="mobile-chromium"?9973:9963;
  const registration=testInfo.project.name==="mobile-chromium"?"OK-C383":"OK-C380";
  seed(flightId);
  runBrowserSql(`
    BEGIN;
    UPDATE flights SET registration='${registration}',price_per_hour=1234.125,
      price_currency_code='KWD',price_currency_minor_units=3,price_per_hour_decimal=1234.125
      WHERE id=${flightId} AND user_id=9001;
    UPDATE flight_expenses SET amount_minor=12345,currency='KWD',
      amount_encoding='iso_minor_units',amount_minor_units=3
      WHERE flight_id=${flightId} AND user_id=9001;
    INSERT INTO flight_expenses(user_id,flight_id,category,label,amount_minor,currency,amount_encoding,amount_minor_units)
    VALUES(9001,${flightId},'PARKING','JPY fee',250,'JPY','iso_minor_units',0);
    COMMIT;
  `);
  await loginBrowserPilot(page,`/flights/${flightId}`);
  await page.locator("details.flight-detail-more").locator("summary").click();
  await page.getByRole("button",{name:"Move to trash"}).click();
  await page.getByRole("button",{name:"Confirm deletion"}).click();
  await expect(page).toHaveURL(/\/flights(?:\?|$)/,{timeout:20000});
  expect(scalar(`SELECT COUNT(*) FROM flights WHERE id=${flightId} AND user_id=9001`)).toBe("0");
  expect(scalar(`SELECT COUNT(*) FROM deleted_flights WHERE original_flight_id=${flightId}
    AND user_id=9001 AND flight_data->>'price_currency_code'='KWD'
    AND expenses_data @> '[{"amount_encoding":"iso_minor_units","amount_minor_units":0,"currency":"JPY"}]'::jsonb`)).toBe("1");
  await page.goto("/data?view=deleted");
  const row=page.locator(".flight-trash article").filter({hasText:registration});
  await expect(row).toHaveCount(1);
  await row.getByRole("button",{name:"Restore flight"}).click();
  await expect.poll(async()=>{
    const success=await page.locator(".flight-trash [role=status]").allTextContents();
    const errors=await page.locator(".flight-trash [role=alert]").allTextContents();
    return success.join(" ")||errors.map(message=>"Recovery error: "+message).join("; ")||"Waiting for recovery";
  },{timeout:15000}).toContain("Flight restored");
  const restoredId=scalar(`SELECT restored_flight_id FROM deleted_flights
    WHERE original_flight_id=${flightId} AND user_id=9001 AND restored_at IS NOT NULL ORDER BY id DESC LIMIT 1`);
  expect(restoredId).toMatch(/^[0-9]+$/);
  expect(scalar(`SELECT price_currency_code||':'||price_currency_minor_units||':'||price_per_hour_decimal::text
    FROM flights WHERE id=${restoredId} AND user_id=9001`)).toBe("KWD:3:1234.125");
  expect(scalar(`SELECT amount_minor||':'||currency||':'||amount_encoding||':'||amount_minor_units
    FROM flight_expenses WHERE flight_id=${restoredId} AND user_id=9001 AND currency='KWD'`)).toBe("12345:KWD:iso_minor_units:3");
  expect(scalar(`SELECT amount_minor||':'||currency||':'||amount_encoding||':'||amount_minor_units
    FROM flight_expenses WHERE flight_id=${restoredId} AND user_id=9001 AND currency='JPY'`)).toBe("250:JPY:iso_minor_units:0");
  expect(scalar(`SELECT COUNT(*) FROM flight_tracks WHERE flight_id=${restoredId} AND user_id=9001`)).toBe("2");
});


test("Currency 3.8 browser: signed portable v13 restores exact flight and expense currency",async({page},testInfo)=>{
  test.skip(!authenticated,"Signed monetary recovery requires isolated authenticated localhost PostgreSQL.");
  const flightId=testInfo.project.name==="mobile-chromium"?9974:9964;
  const registration=testInfo.project.name==="mobile-chromium"?"OK-C384":"OK-C381";
  seed(flightId);
  runBrowserSql(`UPDATE flights SET registration='${registration}',price_per_hour=9876.125,
    price_currency_code='KWD',price_currency_minor_units=3,price_per_hour_decimal=9876.125
    WHERE id=${flightId} AND user_id=9001;
    UPDATE flight_expenses SET amount_minor=6789,currency='KWD',amount_encoding='iso_minor_units',amount_minor_units=3
    WHERE flight_id=${flightId} AND user_id=9001;`);
  await loginBrowserPilot(page,"/data");
  await page.goto("/data?view=recovery");
  const manual=page.getByRole("button",{name:"Create backup now"});
  await expect(manual).toBeVisible();
  const previousBackupId=Number(scalar("SELECT COALESCE(MAX(id),0) FROM account_backups WHERE user_id=9001 AND kind='manual'"));
  await manual.click();
  await expect.poll(()=>Number(scalar("SELECT COALESCE(MAX(id),0) FROM account_backups WHERE user_id=9001 AND kind='manual'"))).toBeGreaterThan(previousBackupId);
  const backupId=scalar("SELECT MAX(id) FROM account_backups WHERE user_id=9001 AND kind='manual'");
  // The stored-backup endpoint authenticates through the real browser session.
  // Playwright's APIRequestContext does not have the same Secure-cookie behavior
  // on this HTTP loopback fixture as browser navigation; use the actual UI link.
  await page.reload();
  const downloadLink=page.locator(`.stored-backup-list a[href="/api/backups/${backupId}"]`);
  await expect(downloadLink).toBeVisible();
  const downloadPromise=page.waitForEvent("download",{timeout:15000});
  await downloadLink.click();
  const downloaded=await downloadPromise;
  expect(downloaded.suggestedFilename()).toMatch(/^flytally-stored-backup-.*\\.json$/);
  const stream=await downloaded.createReadStream();
  const chunks=[];
  for await(const chunk of stream)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  const backup=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(backup.version).toBe(13);
  expect(backup.integrity.signature_version).toBe(1);
  expect(backup.integrity.server_signature).toMatch(/^[a-fA-F0-9]{64}$/);
  expect(backup.flights.find(row=>Number(row.id)===flightId)?.price_currency_code).toBe("KWD");
  expect(String(backup.flights.find(row=>Number(row.id)===flightId)?.price_per_hour_decimal)).toBe("9876.125");
  expect(Number(backup.flight_expenses.find(row=>Number(row.flight_id)===flightId)?.amount_minor_units)).toBe(3);
  await page.goto(`/flights/${flightId}`);
  await page.locator("details.flight-detail-more").locator("summary").click();
  await page.getByRole("button",{name:"Move to trash"}).click();
  await page.getByRole("button",{name:"Confirm deletion"}).click();
  await expect(page).toHaveURL(/\/flights(?:\?|$)/,{timeout:20000});
  expect(scalar(`SELECT COUNT(*) FROM flights WHERE id=${flightId} AND user_id=9001`)).toBe("0");
  await page.goto("/data?view=recovery");
  const backupArticle=page.locator(".stored-backup-list article").filter({
    has:page.locator("span.backup-kind.manual")
  }).first();
  await expect(backupArticle).toBeVisible();
  await backupArticle.getByRole("button",{name:"Restore preview"}).click();
  await expect.poll(async()=>{
    const detail=await backupArticle.allTextContents();
    const errors=await page.locator(".backup-center [role=alert]").allTextContents();
    return detail.some(value=>value.includes("missing records will be added"))
      ?"ready":errors.map(message=>"Preflight error: "+message).join("; ")||"Waiting for preview";
  },{timeout:15000}).toBe("ready");
  await backupArticle.getByRole("textbox",{name:"Type RESTORE"}).fill("RESTORE");
  await backupArticle.getByRole("button",{name:"Restore missing data"}).click();
  await expect.poll(()=>scalar(`SELECT price_currency_code||':'||price_currency_minor_units||':'||price_per_hour_decimal::text
    FROM flights WHERE id=${flightId} AND user_id=9001`),{timeout:15000}).toBe("KWD:3:9876.125");
  expect(scalar(`SELECT amount_minor||':'||currency||':'||amount_encoding||':'||amount_minor_units
    FROM flight_expenses WHERE flight_id=${flightId} AND user_id=9001`)).toBe("6789:KWD:iso_minor_units:3");
});
