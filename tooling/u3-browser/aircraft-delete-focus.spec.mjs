import { test,expect } from "@playwright/test";
import { loginBrowserPilot,expectNoHorizontalOverflow } from "../../e2e/browser-actions.mjs";
import { runBrowserSql,browserSqlScalar } from "../../e2e/browser-db.mjs";

// U3-only destructive acceptance. Keep outside e2e/ frozen normal-suite baseline.
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


const responsiveCases=[
  {name:"mobile-320",width:320,height:740},
  {name:"mobile-390",width:390,height:844},
  {name:"ipad-portrait",width:768,height:1024},
  {name:"ipad-landscape",width:1024,height:768},
];

test("U3: responsive focus, deletion and Escape across mobile/iPad Chrome emulation @u3-responsive",async({browser},testInfo)=>{
  test.skip(testInfo.project.name!=="desktop-chromium","Matrix owns its own Chrome touch contexts.");
  test.setTimeout(480_000);
  const db=new URL(process.env.DATABASE_URL||"");
  if(process.env.FLYTALLY_AUTH_BROWSER!=="1"||
     process.env.FLYTALLY_LOCAL_POSTGRES!=="1"||
     process.env.FLYTALLY_U3_SCHEMA_FIRST!=="1"||
     process.env.VERCEL!==undefined||process.env.VERCEL_ENV!==undefined||
     db.protocol!=="postgresql:"||db.hostname!=="127.0.0.1"||
     db.port!=="55433"||db.pathname!=="/flytally_ui_u3_20261021"||
     db.username!=="flytally_u3"||db.password!==""){
    throw new Error("U3 responsive browser requires only the verified disposable DB and purpose flags.");
  }

  for(const [index,viewport] of responsiveCases.entries()){
    for(const theme of ["light","dark"]){
      const registration="OK-U3"+String(index*2+(theme==="dark"?2:1)).padStart(2,"0");
      // Recreate only synthetic no-flight test profiles; never reset the whole schema here.
      expect(browserSqlScalar(
        "SELECT COUNT(*) FROM flights WHERE user_id=9001 AND registration='"+registration+"';"
      ),"U3 test aircraft must have no saved flights").toBe("0");
      runBrowserSql(
        "DELETE FROM aircraft WHERE user_id=9001 AND registration='"+registration+"'; "+
        "INSERT INTO aircraft(user_id,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_class,regulatory_category,evidence,default_role,billing_basis,default_price_per_hour,active) "+
        "VALUES(9001,'"+registration+"','B23','BRM Aero','Bristell B23','SEP','AEROPLANE','EASA','PIC','BLOCK',0,1);"
      );

      const context=await browser.newContext({
        baseURL:"http://127.0.0.1:3000",
        viewport:{width:viewport.width,height:viewport.height},
        colorScheme:theme,isMobile:true,hasTouch:true,
      });
      try{
        const page=await context.newPage();
        await loginBrowserPilot(page,"/database");
        await expect.poll(()=>page.locator("html").getAttribute("data-theme")).toBe(theme);
        await expectNoHorizontalOverflow(page);
        const card=page.locator("article.aircraft-card").filter({hasText:registration});
        await card.getByRole("button",{name:"Manage aircraft"}).click();
        const dialog=page.getByRole("dialog");
        await expect(dialog.getByRole("heading",{name:registration})).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await dialog.locator("details.aircraft-delete-zone > summary").click();
        await expect(dialog.getByRole("button",{name:"Delete permanently"})).toBeEnabled();
        await dialog.getByRole("button",{name:"Delete permanently"}).click();
        await expect(dialog).toHaveCount(0);
        await expect(card).toHaveCount(0);
        const status=page.locator(".aircraft-library-status[role=status]");
        await expect(status).toBeVisible();
        await expect(status).toBeFocused();
        expect(browserSqlScalar(
          "SELECT COUNT(*) FROM aircraft WHERE user_id=9001 AND registration='"+registration+"';"
        )).toBe("0");
        await expectNoHorizontalOverflow(page);
        await testInfo.attach(viewport.name+"-"+theme+"-delete-status",{
          body:await page.screenshot({animations:"disabled"}),
          contentType:"image/png",
        });

        const remaining=page.locator("article.aircraft-card").filter({hasText:"OK-SP2E"});
        const opener=remaining.getByRole("button",{name:"Manage aircraft"});
        await opener.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(opener).toBeFocused();
        await page.waitForTimeout(100);
        await expect(opener).toBeFocused();
        await expectNoHorizontalOverflow(page);
        await testInfo.attach(viewport.name+"-"+theme+"-escape-focus",{
          body:await page.screenshot({animations:"disabled"}),
          contentType:"image/png",
        });
      }finally{
        await context.close();
      }
    }
  }
});
