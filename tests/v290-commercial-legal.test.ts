import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getCommercialLegalPublicationState } from "../lib/commercial-legal.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.9 C2 commercial legal publication fails closed without reviewed committed content",()=>{
  const state=getCommercialLegalPublicationState({});
  assert.equal(state.publicationReady,false);
  assert.equal(state.implementedContentVersion,null);
  assert.ok(state.blockers.includes("commercial-legal-content"));
  assert.ok(state.blockers.includes("commercial-legal-version"));
});

test("v2.9 C2 version flags cannot publish content that is not implemented in code",()=>{
  const state=getCommercialLegalPublicationState({
    COMMERCIAL_LEGAL_BUNDLE_VERSION:"2026-09-v1",
    COMMERCIAL_LEGAL_REVIEWED_VERSION:"2026-09-v1",
    COMMERCIAL_LEGAL_PUBLISHED_VERSION:"2026-09-v1",
  });
  assert.equal(state.versionChainComplete,false);
  assert.equal(state.publicationReady,false);
  assert.ok(state.blockers.includes("commercial-legal-content"));
});

test("v2.9 C2 requires the complete commercial consumer document set",()=>{
  const state=getCommercialLegalPublicationState({});
  assert.deepEqual(state.artifacts.map(item=>item.key),[
    "terms",
    "pricing-billing",
    "cancellation-refunds",
    "withdrawal",
    "adr",
  ]);
  assert.ok(state.artifacts.every(item=>item.requiredForCommercialLaunch));
});

test("v2.9 C2 exposes a public non-effective commercial information surface",()=>{
  const page=read("app/legal/commercial/page.tsx");
  const legalIndex=read("app/legal/page.tsx");
  assert.match(page,/not currently presenting these commercial documents as effective terms/i);
  assert.match(page,/current private-beta terms remain the applicable/i);
  assert.match(page,/not evidence of lawyer, consumer-authority, ÚCL, LAA ČR, EASA/i);
  assert.match(legalIndex,/Commercial launch information/);
  assert.match(legalIndex,/\/legal\/commercial/);
});
