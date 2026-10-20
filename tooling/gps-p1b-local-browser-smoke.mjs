/**
 * Owner-local GPS P1B browser smoke against already-running isolated server.
 * Usage: node tooling/gps-p1b-local-browser-smoke.mjs on|off
 * Only invented synthetic gx:Track fixtures; no user-private KML or saves.
 * Standalone smoke, not the registered authenticated Playwright suite.
 */
import assert from "node:assert/strict";
import {chromium,expect} from "@playwright/test";

const mode=process.argv[2];
if(!["on","off"].includes(mode)||process.argv.length!==3){
 console.error("Usage: node tooling/gps-p1b-local-browser-smoke.mjs on|off");
 process.exit(2);
}
const origin="http://127.0.0.1:3000";
const WAIT=15000;
const altitudes=[320,310,300,290,270,250,230,210,190,180,170,171,
 180,190,235,245,270,300,320,340,350];
const points=altitudes.map((alt,index)=>({
 alt,lat:50.001,lon:14.002+index*.001,
 time:new Date(Date.UTC(2026,0,10,7,0,0)+(index===14?66:index*5)*1000)
  .toISOString().replace(".000Z","Z"),
}));
function kml(rows){
 return '<kml xmlns:gx="http://www.google.com/kml/ext/2.2">'+
  '<gx:Track>'+
  rows.map(x=>'<when>'+x.time+'</when>').join("")+
  rows.map(x=>'<gx:coord>'+x.lon+' '+x.lat+' '+x.alt+'</gx:coord>').join("")+
  '</gx:Track></kml>';
}
const invalid=kml(points);
const stable=kml(points.map((point,i)=>i===14?{...point,alt:190}:point));
const mimetype="application/vnd.google-earth.kml+xml";
let browser;
let checks=0;
function check(label){checks++;console.log("PASS "+label)}
async function upload(gps,name,content){
 await gps.locator('input[name="kml"]').setInputFiles({
  name,mimeType:mimetype,buffer:Buffer.from(content)
 });
 await expect(gps).toContainText("21 GPS points",{timeout:WAIT});
}
async function noOverflow(page,label){
 const m=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  document:document.documentElement.scrollWidth,
 }));
 assert.ok(m.document<=m.viewport+1,
  label+" horizontal overflow: "+JSON.stringify(m));
}
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({
  viewport:{width:1440,height:900},baseURL:origin
 });
 const page=await context.newPage();
 // Navigation and auth must remain on the explicitly local test origin.
 await page.route("**/*",async route=>{
  const url=new URL(route.request().url());
  if(["http:","https:"].includes(url.protocol)
    &&!(url.hostname==="127.0.0.1"&&url.port==="3000")){
   await route.abort();
   return;
  }
  await route.continue();
 });
 await page.goto(origin+"/login",{waitUntil:"domcontentloaded"});
 await expect(page.getByRole("heading",{name:"FlyTally"}))
  .toBeVisible({timeout:WAIT});
 await page.getByLabel("Email").fill("browser-auth@example.test");
 await page.getByLabel("Password").fill("FlyTally-Browser-2026!");
 await page.getByRole("button",{name:"Sign in"}).click();
 await expect(page).toHaveURL(/\/dashboard(?:\?|$)/,{timeout:WAIT});
 check("local fixture authentication");

 await page.goto(origin+"/flights/new",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Import GPS track"}).click();
 const gps=page.locator("form.kml-wizard");
 await expect(gps).toBeVisible({timeout:WAIT});
 await upload(gps,"synthetic-bad-edge.kml",invalid);
 const notice=gps.locator("[data-gps-r3-quality-review]");
 const review=gps.locator("details.gps-track-review");
 const starts=gps.locator('input[name="part_0_starts"]');
 await expect(starts).toBeVisible({timeout:WAIT});
 const initialStarts=await starts.inputValue();
 if(mode==="on"){
  await expect(notice).toHaveCount(1,{timeout:WAIT});
  await expect(notice).toContainText("GPS altitude needs pilot review");
  await expect(notice).toContainText("GPS cannot confirm wheel contact");
  await expect(review).toHaveAttribute("open","",{timeout:WAIT});
  await expect(gps.locator("[data-gps-v2-preview]")).toHaveCount(0);
  await expect(starts).toHaveValue(initialStarts);
  assert.equal(await notice.locator("input,button,form").count(),0);
  check("one read-only quality notice, legacy count unchanged");
 }else{
  await expect(notice).toHaveCount(0,{timeout:WAIT});
  await expect(starts).toHaveValue(initialStarts);
  check("R3 disabled means zero quality notices");
 }

 if(mode==="on"){
  const viewports=[
   ["desktop",1440,900],["ipad-landscape",1024,768],
   ["ipad-portrait",768,1024],["mobile",390,844],
  ];
  for(const [label,width,height] of viewports){
   await page.setViewportSize({width,height});
   for(const theme of ["light","dark"]){
    await page.evaluate(value=>{document.documentElement.dataset.theme=value},theme);
    await expect(notice).toBeVisible();
    await noOverflow(page,label+" "+theme);
   }
  }
  check("desktop/iPad/mobile light/dark without overflow");
  await page.setViewportSize({width:1440,height:900});
 }

 await upload(gps,"synthetic-no-step.kml",stable);
 await expect(notice).toHaveCount(0,{timeout:WAIT});
 check("source replacement clears stale warning");
 await upload(gps,"synthetic-step-again.kml",invalid);
 if(mode==="on"){
  await expect(notice).toHaveCount(1,{timeout:WAIT});
  check("new source recalculates warning");
  await gps.getByRole("button",{name:"Split into multiple flights"}).click();
  const slider=gps.locator('.split-row input[type="range"]').first();
  await expect(slider).toBeVisible();
  await slider.focus();
  await slider.press("Home");
  for(let i=0;i<10;i++)await slider.press("ArrowRight");
  await expect(slider).toHaveValue("12",{timeout:WAIT});
  await expect(notice).toHaveCount(0,{timeout:WAIT});
  await gps.getByRole("button",{name:"Single flight"}).click();
  await expect(notice).toHaveCount(1,{timeout:WAIT});
  check("split invalidates and restoring source returns context");
 }
 // No submit/save action. Browser fixture auth sessions are disposable.
 await context.close();
 console.log("GPS P1B LOCAL BROWSER "+mode.toUpperCase()+" PASS ("+checks+" checks)");
}catch(error){
 console.error("GPS P1B LOCAL BROWSER "+mode.toUpperCase()+" FAIL");
 console.error(error instanceof Error?error.message:String(error));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
}
