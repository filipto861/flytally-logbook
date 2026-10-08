import { expect } from "@playwright/test";

export async function expectNoHorizontalOverflow(page){
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

export async function loginBrowserPilot(page,returnTo){
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email").fill("browser-auth@example.test");
  await page.getByLabel("Password").fill(process.env.FLYTALLY_BROWSER_PASSWORD||"FlyTally-Browser-2026!");
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page).toHaveURL(new RegExp(`${returnTo}(?:\\?|$)`),{timeout:15000});
}

export async function expectAuthenticatedRoute(page,heading){
  await expect(page.getByRole("heading",{name:heading,level:1})).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

export async function ensureDetailsOpen(details){
  if(!(await details.evaluate(node=>node.open)))await details.locator("summary").first().click();
  await expect.poll(()=>details.evaluate(node=>node.open)).toBe(true);
}

export async function holdPost(page,pattern){
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

