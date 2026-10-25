import assert from "node:assert/strict";
import test from "node:test";
import { buildCredentialOverview,partitionCredentialDocuments } from "../lib/dashboard-credential-overview.ts";

const asOf="2026-10-25";
const licence=(id:number,validityMode:string,validUntil:string,licenceType="PPL(A)")=>({id,licenceType,validityMode,validUntil,recencyUntil:""});
const rating=(id:number,validityMode:string,validUntil:string,licenceType="PPL(A)",qualificationType="SEP")=>({id,licenceType,qualificationType,validityMode,validUntil,recencyUntil:""});
const doc=(id:number,label:string,expiryDate:string,category="Document")=>({id,category,label,expiryDate});

test("V11 groups generic Document-labelled Medical records exactly once",()=>{
  const list=[
    doc(1,"Medical Class 2","2027-01-01"),
    doc(2,"ICAO English Language Proficiency","2027-06-01"),
    doc(3,"LAPL Medical","2026-11-01"),
    doc(4,"Radiotelephony Licence","9999-12-31"),
    doc(5,"Medical","2027-11-01","MEDICAL"),
  ];
  const partition=partitionCredentialDocuments(list);
  assert.deepEqual(partition.documents.map(x=>x.id),[2,4]);
  assert.deepEqual(partition.medical.map(x=>x.id),[1,3,5]);
  const summary=buildCredentialOverview({licences:[],qualifications:[],documents:list,asOf});
  assert.equal(summary.documents.count,2);
  assert.equal(summary.medical.count,3);
  assert.equal(summary.medical.status,"Due soon");
  assert.equal(summary.documents.status,"No date alerts");
  assert.equal(summary.documents.count+summary.medical.count,list.length);
});

test("V11 priorities: a passed recorded date beats soon, unknown and normal dates",()=>{
  const input={licences:[
    licence(1,"date","2027-02-01"),licence(2,"date","2026-11-01"),licence(3,"date","2026-10-01"),licence(4,"date","2026-02-30")],
    qualifications:[],documents:[],asOf};
  const result=buildCredentialOverview(input);
  assert.deepEqual(result.licences,{count:4,status:"Date passed",tone:"danger",reviewCount:3});
  assert.equal(buildCredentialOverview({...input,licences:input.licences.slice(0,2)}).licences.status,"Due soon");
  assert.equal(buildCredentialOverview({...input,licences:[input.licences[3]]}).licences.status,"Needs review");
});

test("V11 missing, zero-year, malformed or unrecorded validity cannot show a positive expiry status",()=>{
  const group=buildCredentialOverview({licences:[licence(1,"date","0000-01-01"),licence(2,"","2027-01-01"),licence(3,"date","2026-02-31")],qualifications:[],documents:[doc(1,"Medical Class 1","bad")],asOf});
  assert.equal(group.licences.status,"Needs review");
  assert.equal(group.licences.reviewCount,3);
  assert.equal(group.medical.status,"Needs review");
  assert.equal(group.medical.reviewCount,1);
  assert.equal(group.ratings.status,"Not recorded");
});

test("V11 LAPL indefinite licence date does not silently clear its SEP/TMG recency",()=>{
  const output=buildCredentialOverview({licences:[licence(1,"date","","LAPL(A)")],qualifications:[
    rating(1,"date","2028-01-01","LAPL(A)","SEP"),
    rating(2,"unlimited","","LAPL(A)","TMG"),
  ],documents:[],asOf});
  assert.equal(output.licences.status,"No date alerts");
  assert.equal(output.ratings.status,"Needs review");
  assert.equal(output.ratings.reviewCount,2);
  assert.equal(buildCredentialOverview({licences:[],qualifications:[rating(1,"recency","2027-01-01")],documents:[],asOf}).ratings.status,"Needs review");
});

test("V11 displayed group state stays independent of the number of records",()=>{
  const documents=Array.from({length:50},(_,i)=>doc(i+1,"Language endorsement","2027-12-31"));
  const normal=buildCredentialOverview({licences:[],qualifications:[],documents,asOf});
  assert.deepEqual(normal.documents,{count:50,status:"No date alerts",tone:"neutral",reviewCount:0});
  const flagged=buildCredentialOverview({licences:[],qualifications:[],documents:[...documents,doc(999,"Medical Class 2","2026-09-01")],asOf});
  assert.equal(flagged.documents.count,50);
  assert.equal(flagged.medical.status,"Date passed");
  assert.equal(flagged.medical.reviewCount,1);
});
