import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
test("v1.28 approval schema remains available as a compatibility projection",()=>{const migration=read("lib/db-optimization.ts"),actions=read("app/(protected)/flights/instructor-actions.ts");assert.match(migration,/CREATE TABLE IF NOT EXISTS instructor_flight_approvals/);assert.match(migration,/UNIQUE\(flight_id,record_revision\)/);assert.match(actions,/f\.certification_hash=a\.flight_hash/);assert.match(actions,/COALESCE\(f\.record_revision,1\)=a\.record_revision/)});
test("only an accepted connected instructor can receive a request",()=>{const helper=read("lib/training-verification.ts");assert.match(helper,/c\.status='accepted'/);assert.match(helper,/UPPER\(COALESCE\(f\.role,''\)\) IN \('DUAL','SPIC','PICUS'\)/);assert.match(helper,/participant_role='INSTRUCTOR'/)});
test("verified instructor is printed in remarks",()=>{const print=read("app/(protected)/print/page.tsx");assert.match(print,/FI SIGNED:/);assert.match(print,/flight_verifications/)});
