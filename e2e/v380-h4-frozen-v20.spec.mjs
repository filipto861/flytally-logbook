import {test,expect} from "@playwright/test";
import {loginBrowserPilot} from "./browser-actions.mjs";
import {runBrowserSql,browserSqlScalar} from "./browser-db.mjs";

// This spec is copied into the temporary detached worktree pinned to the
// ACTUAL frozen production v20 SHA; it executes only with the old application.
// No production DB or historical user data can be addressed by this fixture.
const enabled=process.env.FLYTALLY_AUTH_BROWSER==="1"
  &&process.env.FLYTALLY_LOCAL_POSTGRES==="1"
  &&process.env.FLYTALLY_CURRENCY_V21_BROWSER===undefined;

test("H4: frozen v20 authenticates and reads its existing flight and aircraft workspace on schema v21",async({page})=>{
  test.skip(!enabled,"H4 is exclusively for purpose-bound disposable old-v20 browser runner.");
  const fixture=browserSqlScalar("SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())");
  expect(fixture).toBe("flytally_currency_test|flytally|127.0.0.1");
  expect(browserSqlScalar("SELECT COUNT(*) FROM flytally_schema_migrations WHERE version=21 AND name='source-backed currency exact-money'")).toBe("1");
  const flightId=Number(browserSqlScalar("SELECT id FROM flights WHERE user_id=9001 AND registration='OK-E2E' ORDER BY id LIMIT 1"));
  expect(Number.isSafeInteger(flightId)&&flightId>0).toBe(true);

  await loginBrowserPilot(page,"/flights");
  await expect(page.getByRole("heading",{name:"Flights",level:1})).toBeVisible();
  await page.goto(`/flights/${flightId}`);
  await expect(page.getByRole("heading",{level:1})).toContainText("OK-E2E");
  await expect(page.getByText("LKLT").first()).toBeVisible();

  await page.goto("/database");
  await expect(page.getByRole("heading",{name:"Aircraft & airports",level:1})).toBeVisible();
  await expect(page.getByText("OK-E2E").first()).toBeVisible();
});

test("H4: frozen v20 preserves synthetic certified flight while rendering on v21",async({page})=>{
  test.skip(!enabled,"H4 requires the isolated fixture and frozen runtime.");
  const id=9983;
  // Synthetic certificate data is test-only, never a real regulatory record.
  runBrowserSql(`INSERT INTO flights(
    id,user_id,date,evidence,registration,aircraft_type,aircraft_class,regulatory_category,
    departure,arrival,off_block,takeoff,landing,on_block,role,starts,landings_day,
    certified_at,certified_by_user_id,certification_hash,locked_at,locked_by_user_id
  ) VALUES(
    ${id},9001,'2026-10-08','EASA','OK-E2E','B23','SEP','AEROPLANE',
    'LKLT','LKPR','08:00','08:05','08:45','08:50','PIC',1,1,
    NOW(),9001,repeat('c',64),NOW(),9001
  );`);
  const before=browserSqlScalar(`SELECT certified_at IS NOT NULL FROM flights WHERE id=${id} AND user_id=9001`);
  expect(before).toBe("t");
  await loginBrowserPilot(page,`/flights/${id}`);
  await expect(page.getByRole("heading",{level:1})).toContainText("OK-E2E");
  await expect(page.getByText(/CERTIFIED R1/).first()).toBeVisible();
  expect(browserSqlScalar(`SELECT certified_at IS NOT NULL FROM flights WHERE id=${id} AND user_id=9001`)).toBe("t");
  expect(browserSqlScalar(`SELECT price_currency_code IS NULL AND price_currency_minor_units IS NULL AND price_per_hour_decimal IS NULL FROM flights WHERE id=${id}`)).toBe("t");
});
