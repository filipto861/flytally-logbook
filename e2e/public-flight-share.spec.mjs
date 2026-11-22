import {test,expect} from "@playwright/test";
import {loginBrowserPilot} from "./browser-actions.mjs";
import {runBrowserSql,runBrowserFlightFixtureCleanup,browserSqlScalar} from "./browser-db.mjs";

// End-to-end privacy check of public flight sharing: a link is only created from a certified
// record, the public page carries only the deliberately limited view, and a rotated, revoked
// or corrected record is no longer reachable. Isolated localhost browser DB only.
const authenticated=process.env.FLYTALLY_AUTH_BROWSER==="1"&&process.env.FLYTALLY_LOCAL_POSTGRES==="1";
const PRIVATE=["PRIVATE-NOTE-MARKER","PRIVATE-TASK-MARKER","Private Commander Marker","Private Instructor Marker","PRIVATE-SIGNATURE-REF","Private Verifier Marker","Private Operator Marker","PX9935"];

function seed(flightId,trackId,certified){
  // Recover from interrupted runs that left this synthetic flight certified.
  runBrowserFlightFixtureCleanup(`
    DELETE FROM flight_public_shares WHERE user_id=9001 AND flight_id=${flightId};
    DELETE FROM flight_tracks WHERE user_id=9001 AND flight_id=${flightId};
    DELETE FROM flights WHERE user_id=9001 AND id=${flightId};
  `);
  const points=JSON.stringify([
    {lat:50.1001,lon:14.2601,alt:380,time:"2026-10-14T10:05:00Z"},
    {lat:50.1502,lon:14.3302,alt:900,time:"2026-10-14T10:15:00Z"},
    {lat:50.2203,lon:14.4103,alt:1100,time:"2026-10-14T10:30:00Z"},
    {lat:50.2804,lon:14.4804,alt:420,time:"2026-10-14T10:50:00Z"},
  ]);
  runBrowserSql(`
    INSERT INTO flights(id,user_id,date,evidence,registration,aircraft_type,aircraft_make,aircraft_model,
      aircraft_class,regulatory_category,operation_type,engine_type,departure,arrival,
      off_block,takeoff,landing,on_block,role,starts,landings_day,commander,instructor,task,note,
      verification_name,verification_reference,operator_name,flight_number,billing_basis,price_per_hour)
    VALUES(${flightId},9001,'2026-10-14','EASA','OK-PRV','B23','BRM Aero','Bristell B23',
      'SEP','AEROPLANE','SP','SE','LKPR','LKTB','10:00','10:05','10:50','11:00','PIC',1,1,
      'Private Commander Marker','Private Instructor Marker','PRIVATE-TASK-MARKER','PRIVATE-NOTE-MARKER',
      'Private Verifier Marker','PRIVATE-SIGNATURE-REF','Private Operator Marker','PX9935','BLOCK',4321.5);
    INSERT INTO flight_tracks(id,user_id,flight_id,file_name,point_count,distance_km,coordinates_json,overview_coordinates_json)
    VALUES(${trackId},9001,${flightId},'private-file-name.kml',4,25,'${points}','${points}');
    ${certified?`UPDATE flights SET certified_at=NOW(),certified_by_user_id=9001,certification_hash=repeat('c',64),
      locked_at=NOW(),locked_by_user_id=9001 WHERE id=${flightId} AND user_id=9001;`:""}
  `);
}
function cleanup(flightId){
  runBrowserFlightFixtureCleanup(`
    DELETE FROM flight_public_shares WHERE user_id=9001 AND flight_id=${flightId};
    DELETE FROM flight_tracks WHERE user_id=9001 AND flight_id=${flightId};
    DELETE FROM flights WHERE user_id=9001 AND id=${flightId};
  `);
}
async function createLink(page,flightId,{registration,date,track}){
  await page.goto(`/flights/${flightId}/share`);
  const form=page.locator("form.share-options");
  await form.getByLabel("Include aircraft registration").setChecked(registration);
  await form.getByLabel("Include flight date").setChecked(date);
  await form.getByLabel("Include GPS route and distance").setChecked(track);
  await form.getByRole("button",{name:/Create (public|new) link/}).click();
  await expect(page).toHaveURL(/\/share\?token=/,{timeout:15000});
  const token=new URL(page.url()).searchParams.get("token");
  expect(token).toMatch(/^[A-Za-z0-9_-]{20,80}$/);
  return token;
}
async function publicPage(browser,token){
  // A fresh context without the pilot's session, exactly like an outside viewer.
  const context=await browser.newContext();
  try{
    const response=await context.request.get(`/f/${token}`);
    return {status:response.status(),html:await response.text()};
  }finally{await context.close()}
}

test("public flight link shows only the limited view and dies on rotation, revocation and correction",async({page,browser},testInfo)=>{
  test.skip(!authenticated,"Requires the isolated authenticated browser DB.");
  test.setTimeout(90_000);
  const mobile=testInfo.project.name==="mobile-chromium";
  const flightId=mobile?9937:9935,trackId=mobile?9987:9985;
  // The share table is created lazily by the public route itself.
  expect((await page.request.get("/f/FlyTallySharePrivacyProbe20261122")).status()).toBe(404);
  seed(flightId,trackId,true);
  const pilotName=browserSqlScalar("SELECT display_name FROM users WHERE id=9001");
  try{
    await loginBrowserPilot(page,`/flights/${flightId}/share`);

    // Default view: date and route shared, registration withheld.
    const first=await createLink(page,flightId,{registration:false,date:true,track:true});
    const shared=await publicPage(browser,first);
    expect(shared.status).toBe(200);
    expect(shared.html).toContain("LKPR");
    expect(shared.html).toContain("2026-10-14");
    expect(shared.html).toContain("50.1001");
    for(const marker of [...PRIVATE,"OK-PRV",pilotName,"private-file-name","4321.5",flightId+"","c".repeat(64)])expect(shared.html,marker).not.toContain(marker);
    // Track timestamps are relative; the real flight time never leaves the server.
    expect(shared.html).not.toContain("2026-10-14T10:");
    expect(browserSqlScalar(`SELECT COUNT(*) FROM flight_public_shares WHERE user_id=9001 AND flight_id=${flightId} AND token_hash<>'' AND revoked_at IS NULL`)).toBe("1");
    expect(browserSqlScalar(`SELECT COUNT(*) FROM flight_public_shares WHERE token_hash='${first}'`)).toBe("0");

    // Rotation: the new link replaces the old one; registration on, date and route off.
    const second=await createLink(page,flightId,{registration:true,date:false,track:false});
    expect((await publicPage(browser,first)).status).toBe(404);
    const rotated=await publicPage(browser,second);
    expect(rotated.status).toBe(200);
    expect(rotated.html).toContain("OK-PRV");
    expect(rotated.html).not.toContain("2026-10-14");
    expect(rotated.html).not.toContain("50.1001");
    for(const marker of PRIVATE)expect(rotated.html,marker).not.toContain(marker);

    // Revocation.
    await page.getByRole("button",{name:"Revoke public link"}).click();
    await expect(page.getByText("No public link is active.")).toBeVisible({timeout:15000});
    expect((await publicPage(browser,second)).status).toBe(404);

    // A record that is no longer certified (a correction was opened) is not public any more.
    const third=await createLink(page,flightId,{registration:false,date:true,track:true});
    expect((await publicPage(browser,third)).status).toBe(200);
    runBrowserFlightFixtureCleanup(`UPDATE flights SET certified_at=NULL,locked_at=NULL WHERE id=${flightId} AND user_id=9001;`);
    expect((await publicPage(browser,third)).status).toBe(404);
  }finally{cleanup(flightId)}
});

test("a draft flight cannot be shared",async({page},testInfo)=>{
  test.skip(!authenticated,"Requires the isolated authenticated browser DB.");
  const mobile=testInfo.project.name==="mobile-chromium";
  const flightId=mobile?9938:9936,trackId=mobile?9988:9986;
  expect((await page.request.get("/f/FlyTallySharePrivacyProbe20261122")).status()).toBe(404);
  seed(flightId,trackId,false);
  try{
    await loginBrowserPilot(page,`/flights/${flightId}/share`);
    await expect(page.getByRole("heading",{name:"Certify the final record first"})).toBeVisible();
    await expect(page.getByRole("button",{name:/Create (public|new) link/})).toHaveCount(0);
    expect(browserSqlScalar(`SELECT COUNT(*) FROM flight_public_shares WHERE user_id=9001 AND flight_id=${flightId}`)).toBe("0");
  }finally{cleanup(flightId)}
});
