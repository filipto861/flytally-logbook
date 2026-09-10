import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { safeLocalReturnTo } from "../lib/auth/return-to.ts";

const trainingStart = fs.readFileSync(new URL("../app/api/auth/training/start/route.ts", import.meta.url), "utf8");
const loginPage = fs.readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
const loginAction = fs.readFileSync(new URL("../app/login/actions.ts", import.meta.url), "utf8");
const googleStart = fs.readFileSync(new URL("../app/api/auth/google/start/route.ts", import.meta.url), "utf8");
const googleCallback = fs.readFileSync(new URL("../app/api/auth/google/callback/route.ts", import.meta.url), "utf8");
const googleContract = fs.readFileSync(new URL("../lib/auth/google.ts", import.meta.url), "utf8");

test("auth return target accepts only same-origin local paths", () => {
  const target = "/api/auth/training/start?next=%2Faircraft%2Flearjet-35-36%2Fprogress";
  assert.equal(safeLocalReturnTo(target), target);
  assert.equal(safeLocalReturnTo("https://evil.example/steal"), "/dashboard");
  assert.equal(safeLocalReturnTo("//evil.example/steal"), "/dashboard");
  assert.equal(safeLocalReturnTo("/\\evil.example/steal"), "/dashboard");
  assert.equal(safeLocalReturnTo("javascript:alert(1)"), "/dashboard");
});

test("Training provider sends unauthenticated pilots to login with a resumable local handoff", () => {
  assert.match(trainingStart, /login\.searchParams\.set\("returnTo"/);
  assert.match(trainingStart, /source\.pathname.*source\.search/);
  assert.doesNotMatch(trainingStart, /searchParams\.set\("returnTo",\s*source\.searchParams\.get/);
});

test("password login sanitizes and resumes the requested local auth flow", () => {
  assert.match(loginPage, /safeLocalReturnTo\(params\.returnTo\)/);
  assert.match(loginPage, /redirect\(returnTo\)/);
  assert.match(loginAction, /safeLocalReturnTo\(formData\.get\("returnTo"\)\)/);
  assert.match(loginAction, /redirect\(returnTo\)/);
});

test("Google login carries the local handoff only inside the signed flow cookie", () => {
  assert.match(googleContract, /returnTo\?:string/);
  assert.match(googleStart, /safeLocalReturnTo\(request\.nextUrl\.searchParams\.get\("returnTo"\)\)/);
  assert.match(googleStart, /\{returnTo\}/);
  assert.match(googleStart, /encodeGoogleFlow\(flow\)/);
  assert.match(googleCallback, /safeLocalReturnTo\(flow\.returnTo\)/);
  assert.match(googleCallback, /NextResponse\.redirect\(new URL\(returnTo,request\.url\)\)/);
});
