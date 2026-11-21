import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.8 exposes one canonical legal centre and links it from account surfaces",()=>{
  const legal=read("lib/legal.ts"),shell=read("components/app-shell.tsx"),login=read("app/login/page.tsx"),join=read("app/join/page.tsx");
  for(const key of ["privacy","terms","cookies","aviation-safety","subprocessors","report"])assert.match(legal,new RegExp(`\\b${key.replace("-","[-]")}\\b`));
  assert.match(shell,/LegalFooter/);
  assert.match(login,/LegalFooter/);
  assert.match(join,/LegalFooter/);
  assert.match(legal,/does not display a consent banner/i);
  assert.match(legal,/session cookie/i);
});

test("v2.8 public flight sharing remains limited, revocable and search-engine private",()=>{
  const publicPage=read("app/f/[token]/page.tsx"),share=read("app/(protected)/flights/[id]/share/page.tsx");
  assert.match(publicPage,/index:false/);
  assert.match(publicPage,/follow:false/);
  assert.match(publicPage,/nocache:true/);
  assert.match(publicPage,/Report a privacy, copyright or content concern/);
  assert.match(share,/Anyone with the secret URL/);
  assert.match(share,/registration, date and the GPS route\/distance/);
  assert.match(share,/Revoke public link/);
});

test("v2.8 security baseline restricts unnecessary browser capabilities",()=>{
  const config=read("next.config.ts");
  assert.match(config,/Permissions-Policy/);
  assert.match(config,/camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\), usb=\(\)/);
  assert.match(config,/strict-origin-when-cross-origin/);
  assert.match(config,/X-Frame-Options/);
  assert.match(config,/Content-Security-Policy/);
  assert.match(config,/frame-ancestors 'none'/);
  assert.match(config,/object-src 'none'/);
  assert.match(config,/Cross-Origin-Opener-Policy/);
  assert.match(config,/Cross-Origin-Resource-Policy/);
});
