import { test,expect } from "@playwright/test";
import { resetAppearanceFixture,resetConnectionFixture,resetAccountSettingsFixture,resetConnectionManagerFixture } from "./browser-db.mjs";

async function expectNoHorizontalOverflow(page){
  const state=await page.evaluate(()=>{
    const viewport=document.documentElement.clientWidth;
    const overflow=document.documentElement.scrollWidth-viewport;
    const offenders=[...document.querySelectorAll("body *")].map(element=>{
      const rect=element.getBoundingClientRect();
      const style=getComputedStyle(element);
      return{
        tag:element.tagName.toLowerCase(),
        id:element.id||"",
        className:typeof element.className==="string"?element.className.slice(0,140):"",
        left:Math.round(rect.left*10)/10,
        right:Math.round(rect.right*10)/10,
        width:Math.round(rect.width*10)/10,
        scrollWidth:element instanceof HTMLElement?element.scrollWidth:0,
        overflowX:style.overflowX,
      };
    }).filter(item=>item.right>viewport+1||item.left<-1).slice(0,20);
    return{viewport,scrollWidth:document.documentElement.scrollWidth,overflow,offenders};
  });
  expect(state.overflow,JSON.stringify(state,null,2)).toBeLessThanOrEqual(1);
}

test("login shell is usable without horizontal overflow",async({page})=>{
  await page.goto("/login");
  await expect(page.getByRole("heading",{name:"FlyTally"})).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  const submit=page.getByRole("button",{name:"Sign in"});
  await expect(submit).toBeVisible();
  const box=await submit.boundingBox();
  expect(box?.height??0).toBeGreaterThanOrEqual(40);
  await expectNoHorizontalOverflow(page);
});

test("protected routes redirect unauthenticated browsers to sign in",async({page})=>{
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading",{name:"FlyTally"})).toBeVisible();
});

test("login submission exposes a disabled pending state before the request completes",async({page})=>{
  let releaseRequest=()=>{};
  const requestGate=new Promise(resolve=>{releaseRequest=resolve});
  await page.route("**/login*",async route=>{
    if(route.request().method()==="POST"){
      await requestGate;
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto("/login");
  await page.getByLabel("E-mail").fill("browser-smoke@example.test");
  await page.getByLabel("Password").fill("not-a-real-password");
  const submit=page.getByRole("button",{name:"Sign in"});
  const clicking=submit.click().catch(()=>undefined);

  const pending=page.getByRole("button",{name:"Signing in…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");

  releaseRequest();
  await clicking;
});

const authenticatedBrowser=process.env.FLYTALLY_AUTH_BROWSER==="1";

async function expectAuthenticatedRoute(page,heading){
  await expect(page.getByRole("heading",{name:heading,level:1})).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

async function navigateMain(page,label){
  const toggle=page.getByRole("button",{name:"Open navigation"});
  if(await toggle.isVisible())await toggle.click();
  const link=page.getByRole("link",{name:label,exact:true});
  await expect(link).toBeVisible();
  await link.click();
}

async function loginBrowserPilot(page,returnTo){
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("E-mail").fill("browser-auth@example.test");
  await page.getByLabel("Password").fill(process.env.FLYTALLY_BROWSER_PASSWORD||"FlyTally-Browser-2026!");
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page).toHaveURL(new RegExp(`${returnTo}(?:\\?|$)`));
}

async function holdPost(page,pattern){
  let releaseRequest=()=>{};
  let posts=0;
  const gate=new Promise(resolve=>{releaseRequest=resolve});
  const handler=async route=>{
    if(route.request().method()==="POST"){
      posts+=1;
      await gate;
    }
    await route.continue();
  };
  await page.route(pattern,handler);
  return{
    count:()=>posts,
    release:releaseRequest,
    cleanup:()=>page.unroute(pattern,handler),
  };
}

test("authenticated pilot can navigate the core product shell",async({page,context})=>{
  test.skip(!authenticatedBrowser,"Authenticated browser smoke requires the isolated CI database.");
  await loginBrowserPilot(page,"/dashboard");

  await expectAuthenticatedRoute(page,"At a glance");
  const session=(await context.cookies()).find(cookie=>cookie.name==="logbook_session");
  expect(session).toBeTruthy();
  expect(session?.httpOnly).toBeTruthy();

  await navigateMain(page,"Flights");
  await expect(page).toHaveURL(/\/flights$/);
  await expectAuthenticatedRoute(page,"Flights");
  await expect(page.getByRole("row",{name:/OK-E2E/})).toBeVisible();

  await navigateMain(page,"Settings");
  await expect(page).toHaveURL(/\/profile(?:\?|$)/);
  await expectAuthenticatedRoute(page,"Settings");

  await navigateMain(page,"Connections");
  await expect(page).toHaveURL(/\/connections$/);
  await expectAuthenticatedRoute(page,"Connections");
});

test("appearance mutation disables duplicate submit and persists",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated mutation smoke requires the isolated CI database.");
  resetAppearanceFixture();
  await loginBrowserPilot(page,"/profile");

  const appearance=page.getByLabel("Appearance");
  await appearance.selectOption("dark");
  const gate=await holdPost(page,"**/profile*");
  const save=page.getByRole("button",{name:"Save appearance"});
  const clicking=save.click();

  const pending=page.getByRole("button",{name:"Saving…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");
  await page.evaluate(()=>document.querySelector(".appearance-form button")?.click());
  await page.waitForTimeout(100);
  expect(gate.count()).toBe(1);

  gate.release();
  await clicking;
  await gate.cleanup();
  await expect(page.getByRole("button",{name:"Save appearance"})).toBeEnabled();

  await page.reload();
  await expect(page.getByLabel("Appearance")).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
});

test("connection acceptance disables duplicate submit and persists",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated mutation smoke requires the isolated CI database.");
  resetConnectionFixture();
  await loginBrowserPilot(page,"/connections");
  await expect(page.getByRole("heading",{name:"Connection requests"})).toBeVisible();
  await expect(page.getByText("Browser Friend",{exact:true}).first()).toBeVisible();

  const gate=await holdPost(page,"**/connections*");
  const accept=page.getByRole("button",{name:"Accept"});
  const clicking=accept.click();

  const pending=page.getByRole("button",{name:"Accepting…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");
  await page.evaluate(()=>document.querySelector(".connection-inbox .connection-actions form:first-child button")?.click());
  await page.waitForTimeout(100);
  expect(gate.count()).toBe(1);

  gate.release();
  await clicking;
  await gate.cleanup();

  const connected=page.locator("details.connection-manager").filter({hasText:"Browser Friend"});
  await expect(connected).toBeVisible();
  await page.reload();
  await expect(page.locator("details.connection-manager").filter({hasText:"Browser Friend"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Accept"})).toHaveCount(0);
});


test("account settings transaction disables duplicate submit and persists both records",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated transaction smoke requires the isolated CI database.");
  resetAccountSettingsFixture();
  await loginBrowserPilot(page,"/profile");

  await page.getByLabel("Name").fill("Browser Transaction Pilot");
  await page.getByLabel("Home airport").fill("LKPR");
  await page.getByLabel("Currency").selectOption("EUR");
  await page.getByLabel("Default logbook").selectOption("EASA");

  const gate=await holdPost(page,"**/profile*");
  const save=page.getByRole("button",{name:"Save changes"});
  const clicking=save.click();

  const pending=page.getByRole("button",{name:"Saving…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");
  await page.evaluate(()=>document.querySelector(".account-settings-form button")?.click());
  await page.waitForTimeout(100);
  expect(gate.count()).toBe(1);

  gate.release();
  await clicking;
  await gate.cleanup();
  await expect(page.getByRole("button",{name:"Save changes"})).toBeEnabled();

  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Browser Transaction Pilot");
  await expect(page.getByLabel("Home airport")).toHaveValue("LKPR");
  await expect(page.getByLabel("Currency")).toHaveValue("EUR");
  await expect(page.getByLabel("Default logbook")).toHaveValue("EASA");
});

test("connection access update disables duplicate submit and persists",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated transaction smoke requires the isolated CI database.");
  resetConnectionManagerFixture();
  await loginBrowserPilot(page,"/connections");

  const manager=page.locator("details.connection-manager").filter({hasText:"Browser Friend"});
  await expect(manager).toBeVisible();
  await manager.locator("summary").first().click();
  await manager.getByLabel("Relationship").selectOption("instructor");
  await manager.getByLabel("Allow read-only logbook view").check();

  const gate=await holdPost(page,"**/connections*");
  const save=manager.getByRole("button",{name:"Save access"});
  const clicking=save.click();

  const pending=manager.getByRole("button",{name:"Saving…"});
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy","true");
  await expect(pending).toHaveAttribute("data-loading","true");
  await page.evaluate(()=>document.querySelector("details.connection-manager[open] .connection-editor form button")?.click());
  await page.waitForTimeout(100);
  expect(gate.count()).toBe(1);

  gate.release();
  await clicking;
  await gate.cleanup();

  await page.reload();
  const persisted=page.locator("details.connection-manager").filter({hasText:"Browser Friend"});
  await expect(persisted).toContainText("Instructor");
  await expect(persisted).toContainText("Can view your logbook");
  await persisted.locator("summary").first().click();
  await expect(persisted.getByLabel("Relationship")).toHaveValue("instructor");
  await expect(persisted.getByLabel("Allow read-only logbook view")).toBeChecked();
});


test("flight detail tabs support roving keyboard selection",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated browser smoke requires the isolated CI database.");
  await loginBrowserPilot(page,"/flights");
  const row=page.getByRole("row",{name:/OK-E2E/});
  await row.getByRole("link",{name:"Open flight LKLT to LKPR"}).click();

  const overview=page.getByRole("tab",{name:"Overview"});
  const gps=page.getByRole("tab",{name:/GPS track/});
  const logbook=page.getByRole("tab",{name:"Logbook data"});
  await expect(overview).toHaveAttribute("aria-selected","true");
  await expect(overview).toHaveAttribute("tabindex","0");
  await expect(gps).toHaveAttribute("tabindex","-1");
  await expect(logbook).toHaveAttribute("tabindex","-1");

  await overview.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(logbook).toBeFocused();
  await expect(logbook).toHaveAttribute("aria-selected","true");

  await page.keyboard.press("Home");
  await expect(overview).toBeFocused();
  await expect(overview).toHaveAttribute("aria-selected","true");

  await page.keyboard.press("ArrowRight");
  await expect(gps).toBeFocused();
  await expect(gps).toHaveAttribute("aria-selected","true");

  await page.keyboard.press("End");
  await expect(logbook).toBeFocused();
  await expect(logbook).toHaveAttribute("aria-selected","true");
});

test("touch target hardening keeps the mobile top bar and quick-aircraft dialog inside the viewport",async({page})=>{
  test.skip(!authenticatedBrowser,"Authenticated browser smoke requires the isolated CI database.");
  await loginBrowserPilot(page,"/flights/new");
  await expectNoHorizontalOverflow(page);

  const mobileToggle=page.getByRole("button",{name:"Open navigation"});
  if(await mobileToggle.isVisible()){
    const toggleBox=await mobileToggle.boundingBox();
    expect(toggleBox?.width??0).toBeGreaterThanOrEqual(44);
    const bell=page.getByRole("link",{name:/^Notifications/});
    const bellBox=await bell.boundingBox();
    expect(bellBox?.width??0).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button",{name:"Add aircraft",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Add aircraft"});
  await expect(dialog).toBeVisible();
  await expectNoHorizontalOverflow(page);

  if(await mobileToggle.isVisible()){
    const close=dialog.getByRole("button",{name:"Close"});
    const closeBox=await close.boundingBox();
    expect(closeBox?.width??0).toBeGreaterThanOrEqual(44);
  }
});
