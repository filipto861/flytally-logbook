export const QUALIFICATION_FAMILIES=["CLASS_TYPE","INSTRUMENT","INSTRUCTOR","EXAMINER","OPERATIONAL","BALLOON_PRIVILEGE","OTHER"] as const;
export const QUALIFICATION_CATEGORIES=["AEROPLANE","HELICOPTER","SAILPLANE","BALLOON","GYROPLANE","MULTI_CATEGORY","OTHER"] as const;
export const QUALIFICATION_ROLES=["PILOT","INSTRUCTOR","EXAMINER","OTHER"] as const;
export type QualificationFamily=typeof QUALIFICATION_FAMILIES[number];
export type QualificationCategory=typeof QUALIFICATION_CATEGORIES[number];
export type QualificationRole=typeof QUALIFICATION_ROLES[number];
export type QualificationClassification={family:QualificationFamily;category:QualificationCategory;role:QualificationRole;scope:string;confidence:"exact"|"context"|"unknown"};

const text=(value:unknown)=>String(value??"").trim().toUpperCase();
const compact=(value:unknown)=>text(value).replace(/\s+/g,"");
const categoryFromSuffix=(value:string):QualificationCategory=>value.endsWith("(A)")?"AEROPLANE":value.endsWith("(H)")?"HELICOPTER":value.endsWith("(S)")?"SAILPLANE":value.endsWith("(B)")?"BALLOON":value.endsWith("(G)")?"GYROPLANE":"OTHER";
const licenceCategory=(value:unknown):QualificationCategory=>{const v=compact(value);if(/\(A\)$/.test(v))return"AEROPLANE";if(/\(H\)$/.test(v))return"HELICOPTER";if(v==="SPL")return"SAILPLANE";if(v==="BPL")return"BALLOON";if(/\(G\)$/.test(v)||v==="GPL")return"GYROPLANE";return"OTHER"};
const normalizedScope=(value:unknown)=>text(value).replace(/_/g," ").replace(/\s+/g," ");

/** Conservative display classifier for legacy labels. It never creates or extends a legal privilege. */
export function classifyQualificationLabel(value:unknown,parentLicence?:unknown):QualificationClassification{
  const raw=compact(value),scope=normalizedScope(value),parent=licenceCategory(parentLicence);
  if(!raw)return{family:"OTHER",category:parent,role:"OTHER",scope:"",confidence:"unknown"};

  if(["SEP(LAND)","SEP(SEA)","MEP(LAND)","MEP(SEA)"].includes(raw))return{family:"CLASS_TYPE",category:"AEROPLANE",role:"PILOT",scope,confidence:"exact"};
  if(raw==="TMG")return{family:"CLASS_TYPE",category:parent==="SAILPLANE"?"SAILPLANE":"AEROPLANE",role:"PILOT",scope,confidence:parent==="SAILPLANE"?"context":"exact"};

  if(raw==="IR"||raw==="IR(A)"||/^(?:SE|ME)[-\/]?IR\(A\)$/.test(raw)||/^IR\(A\)[-\/]?(?:SE|ME)$/.test(raw)||raw==="BIR"||raw==="BIR(A)")return{family:"INSTRUMENT",category:"AEROPLANE",role:"PILOT",scope,confidence:"exact"};
  if(raw==="IR(H)")return{family:"INSTRUMENT",category:"HELICOPTER",role:"PILOT",scope,confidence:"exact"};

  if(/^(FI|CRI|IRI|TRI|SFI|MCCI|STI)\(([AHSBG])\)$/.test(raw))return{family:"INSTRUCTOR",category:categoryFromSuffix(raw),role:"INSTRUCTOR",scope,confidence:"exact"};
  if(/^(FE|CRE|IRE|TRE|SFE|FIE)\(([AHSBG])\)$/.test(raw))return{family:"EXAMINER",category:categoryFromSuffix(raw),role:"EXAMINER",scope,confidence:"exact"};

  if(/^NIGHT\(([AHB])\)$/.test(raw))return{family:"OPERATIONAL",category:categoryFromSuffix(raw),role:"PILOT",scope,confidence:"exact"};
  if(raw==="NIGHT"&&parent==="BALLOON")return{family:"OPERATIONAL",category:"BALLOON",role:"PILOT",scope,confidence:"context"};
  if(raw==="NIGHT"&&parent==="SAILPLANE")return{family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",scope,confidence:"context"};
  if(/^(AEROBATIC|AEROBATICS)(\([AS]\))?$/.test(raw))return{family:"OPERATIONAL",category:raw.includes("(A)")?"AEROPLANE":raw.includes("(S)")?"SAILPLANE":"MULTI_CATEGORY",role:"PILOT",scope,confidence:"exact"};
  if(/^(BASIC|ADVANCED)AEROBATIC(\(S\))?$/.test(raw))return{family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",scope,confidence:"exact"};
  if(raw==="TMGNIGHT"||raw==="SAILPLANECLOUD"||raw==="CLOUD"&&parent==="SAILPLANE")return{family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",scope,confidence:raw==="CLOUD"?"context":"exact"};
  if(/^(SAILPLANE-TOWING|BANNER-TOWING)\(S\)$/.test(raw))return{family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",scope,confidence:"exact"};
  if(/^(TOWING|SAILPLANE-TOWING|BANNER-TOWING)(\(A\))?$/.test(raw))return{family:"OPERATIONAL",category:"AEROPLANE",role:"PILOT",scope,confidence:"exact"};
  if(/^MOUNTAIN(\(A\))?$/.test(raw))return{family:"OPERATIONAL",category:"AEROPLANE",role:"PILOT",scope,confidence:"exact"};

  const balloon=scope.replace(/[-_]/g," ").replace(/\s+/g," ");
  if(["HOT AIR BALLOON","GAS BALLOON","HOT AIR AIRSHIP","MIXED BALLOON"].includes(balloon)||/^HAB[- ]?[ABCD]$/.test(balloon))return{family:"BALLOON_PRIVILEGE",category:"BALLOON",role:"PILOT",scope:balloon,confidence:"exact"};
  if(balloon==="TETHERED"||balloon.includes("TETHERED BALLOON"))return{family:"OPERATIONAL",category:"BALLOON",role:"PILOT",scope,confidence:"exact"};
  if((raw==="COMMERCIAL"||raw==="COMMERCIAL(B)"||raw==="COMMERCIALOPERATIONRATING")&&parent==="BALLOON")return{family:"OPERATIONAL",category:"BALLOON",role:"PILOT",scope,confidence:raw==="COMMERCIAL(B)"?"exact":"context"};

  return{family:"OTHER",category:parent,role:"OTHER",scope,confidence:parent!=="OTHER"?"context":"unknown"};
}

export function qualificationFamilyLabel(value:unknown){return({CLASS_TYPE:"Class / type",INSTRUMENT:"Instrument",INSTRUCTOR:"Instructor",EXAMINER:"Examiner",OPERATIONAL:"Operational privilege",BALLOON_PRIVILEGE:"Balloon class",OTHER:"Other qualification"} as Record<string,string>)[text(value)]||"Other qualification"}
export function qualificationCategoryLabel(value:unknown){return({AEROPLANE:"Aeroplane",HELICOPTER:"Helicopter",SAILPLANE:"Sailplane / TMG",BALLOON:"Balloon",GYROPLANE:"Gyroplane",MULTI_CATEGORY:"Multi-category",OTHER:"Other"} as Record<string,string>)[text(value)]||"Other"}
