import { test,expect } from "@playwright/test";
import { loginBrowserPilot } from "./browser-actions.mjs";
import { runBrowserSql,browserSqlScalar } from "./browser-db.mjs";

// Destructive test: only run through the authenticated runner against a disposable U3 database.
test("U3: aircraft deletion restores confirmation focus without replay @u3-delete-focus",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="desktop-chromium","One serial, destructive acceptance case.");
  const db=new URL(process.env.DATABASE_URL||"");
  if(process.env.FLYTALLY_AUTH_BROWSER!=="1"||process.env.FLYTALLY_LOCAL_POSTGRES!=="1"||
     db.hostname!=="127.0.0.1"||db.port!=="55433"||
     db.pathname!=="/flytally_ui_u3_20261021"||db.username!=="flytally_u3"){
    throw new Error("U3 browser acceptance requires the dedicated disposable DB on 127.0.0.1:55433.");
  }
  runBrowserSql(`DELETE FROM aircraft WHERE user_id=9001 AND registration='OK-U3ZZ';
    INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_class,regulatory_category,evidence,default_role,billing_basis,default_price_per_hour,active)
    VALUES(9001,'OK-U3ZZ','B23','BRM Aero','Bristell B23','SEP','AEROPLANE','EASA','PIC','BLOCK',0,1);`);
  await loginBrowserPilot(page,"/database");
  const spare=page.locator("article.aircraft-card").filter({hasText:"OK-U3ZZ"});
  await spare.getByRole("button",{name:"Manage aircraft"}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog.getByRole("heading",{name:"OK-U3ZZ"})).toBeVisible();
  await dialog.locator("details.aircraft-delete-zone > summary").click();
  await dialog.getByRole("button",{name:"Delete permanently"}).click();
  await expect(spare).toHaveCount(0);
  const notice=page.locator(".aircraft-library-status[role=status]");
  await expect(notice).toBeVisible();
  await expect(notice).toBeFocused();
  expect(browserSqlScalar("SELECT COUNT(*) FROM aircraft WHERE user_id=9001 AND registration='OK-U3ZZ';")).toBe("0");

  const existing=page.locator("article.aircraft-card").filter({hasText:"OK-SP2E"});
  const opener=existing.getByRole("button",{name:"Manage aircraft"});
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.waitForTimeout(100);
  await expect(opener).toBeFocused();

  // Saved-flight aircraft stays protected from deletion.
  const protectedCard=page.locator("article.aircraft-card").filter({hasText:"OK-E2E"});
  await protectedCard.getByRole("button",{name:"Manage aircraft"}).click();
  const protectedDialog=page.getByRole("dialog");
  await protectedDialog.locator("details.aircraft-delete-zone > summary").click();
  await expect(protectedDialog.getByRole("button",{name:"Delete permanently"})).toBeDisabled();
  expect(browserSqlScalar("SELECT COUNT(*) FROM aircraft WHERE user_id=9001 AND registration='OK-E2E';")).toBe("1");
});
