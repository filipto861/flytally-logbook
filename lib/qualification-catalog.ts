import type { QualificationCategory,QualificationFamily,QualificationRole } from "@/lib/qualification-structure";

export type QualificationCatalogEntry={code:string;label:string;family:QualificationFamily;category:QualificationCategory;role:QualificationRole;reference:string};

export const QUALIFICATION_CATALOG:QualificationCatalogEntry[]=[
  {code:"SEP(land)",label:"SEP(land)",family:"CLASS_TYPE",category:"AEROPLANE",role:"PILOT",reference:"Part-FCL Subpart H"},
  {code:"SEP(sea)",label:"SEP(sea)",family:"CLASS_TYPE",category:"AEROPLANE",role:"PILOT",reference:"Part-FCL Subpart H"},
  {code:"MEP(land)",label:"MEP(land)",family:"CLASS_TYPE",category:"AEROPLANE",role:"PILOT",reference:"Part-FCL Subpart H"},
  {code:"MEP(sea)",label:"MEP(sea)",family:"CLASS_TYPE",category:"AEROPLANE",role:"PILOT",reference:"Part-FCL Subpart H"},
  {code:"TMG",label:"TMG",family:"CLASS_TYPE",category:"AEROPLANE",role:"PILOT",reference:"Part-FCL Subpart H / Part-SFCL context"},
  {code:"IR(A)",label:"Instrument rating — aeroplane",family:"INSTRUMENT",category:"AEROPLANE",role:"PILOT",reference:"Part-FCL Subpart G"},
  {code:"BIR(A)",label:"Basic instrument rating",family:"INSTRUMENT",category:"AEROPLANE",role:"PILOT",reference:"FCL.835"},
  {code:"NIGHT(A)",label:"Night rating — aeroplane",family:"OPERATIONAL",category:"AEROPLANE",role:"PILOT",reference:"FCL.810"},
  {code:"AEROBATIC(A)",label:"Aerobatic rating — aeroplane / powered TMG",family:"OPERATIONAL",category:"AEROPLANE",role:"PILOT",reference:"FCL.800"},
  {code:"SAILPLANE TOWING(A)",label:"Sailplane towing rating",family:"OPERATIONAL",category:"AEROPLANE",role:"PILOT",reference:"FCL.805"},
  {code:"BANNER TOWING(A)",label:"Banner towing rating",family:"OPERATIONAL",category:"AEROPLANE",role:"PILOT",reference:"FCL.805"},
  {code:"MOUNTAIN(A)",label:"Mountain rating",family:"OPERATIONAL",category:"AEROPLANE",role:"PILOT",reference:"FCL.815"},
  {code:"IR(H)",label:"Instrument rating — helicopter",family:"INSTRUMENT",category:"HELICOPTER",role:"PILOT",reference:"Part-FCL Subpart G"},
  {code:"NIGHT(H)",label:"Night rating — helicopter",family:"OPERATIONAL",category:"HELICOPTER",role:"PILOT",reference:"FCL.810"},
  {code:"BASIC AEROBATIC(S)",label:"Basic aerobatic privileges",family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",reference:"SFCL.200"},
  {code:"ADVANCED AEROBATIC(S)",label:"Advanced aerobatic privileges",family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",reference:"SFCL.200"},
  {code:"SAILPLANE TOWING(S)",label:"Sailplane towing with TMG",family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",reference:"SFCL.205"},
  {code:"BANNER TOWING(S)",label:"Banner towing with TMG",family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",reference:"SFCL.205"},
  {code:"TMG NIGHT",label:"TMG night rating",family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",reference:"SFCL.210"},
  {code:"SAILPLANE CLOUD",label:"Sailplane cloud flying privileges",family:"OPERATIONAL",category:"SAILPLANE",role:"PILOT",reference:"SFCL.215"},
  {code:"HOT AIR BALLOON",label:"Hot-air balloon class",family:"BALLOON_PRIVILEGE",category:"BALLOON",role:"PILOT",reference:"BFCL.150"},
  {code:"GAS BALLOON",label:"Gas balloon class",family:"BALLOON_PRIVILEGE",category:"BALLOON",role:"PILOT",reference:"BFCL.150"},
  {code:"MIXED BALLOON",label:"Mixed balloon class",family:"BALLOON_PRIVILEGE",category:"BALLOON",role:"PILOT",reference:"BFCL.150"},
  {code:"HOT AIR AIRSHIP",label:"Hot-air airship class",family:"BALLOON_PRIVILEGE",category:"BALLOON",role:"PILOT",reference:"BFCL.150"},
  {code:"TETHERED BALLOON",label:"Tethered hot-air balloon flight rating",family:"OPERATIONAL",category:"BALLOON",role:"PILOT",reference:"BFCL.200"},
  {code:"NIGHT(B)",label:"Night rating — balloon",family:"OPERATIONAL",category:"BALLOON",role:"PILOT",reference:"BFCL.210"},
  {code:"COMMERCIAL(B)",label:"Commercial operation rating — balloon",family:"OPERATIONAL",category:"BALLOON",role:"PILOT",reference:"BFCL.215"},
  ...(["FI(A)","CRI(A)","IRI(A)","TRI(A)","SFI(A)","MCCI(A)","STI(A)"] as const).map(code=>({code,label:code,family:"INSTRUCTOR" as const,category:"AEROPLANE" as const,role:"INSTRUCTOR" as const,reference:"Part-FCL Subpart J"})),
  ...(["FI(H)","IRI(H)","TRI(H)","SFI(H)","MCCI(H)","STI(H)"] as const).map(code=>({code,label:code,family:"INSTRUCTOR" as const,category:"HELICOPTER" as const,role:"INSTRUCTOR" as const,reference:"Part-FCL Subpart J"})),
  {code:"FI(S)",label:"Flight instructor — sailplanes",family:"INSTRUCTOR",category:"SAILPLANE",role:"INSTRUCTOR",reference:"SFCL.315"},
  {code:"FI(B)",label:"Flight instructor — balloons",family:"INSTRUCTOR",category:"BALLOON",role:"INSTRUCTOR",reference:"BFCL.315"},
  ...(["FE(A)","CRE(A)","IRE(A)","TRE(A)","SFE(A)","FIE(A)"] as const).map(code=>({code,label:code,family:"EXAMINER" as const,category:"AEROPLANE" as const,role:"EXAMINER" as const,reference:"Part-FCL Subpart K"})),
  ...(["FE(H)","IRE(H)","TRE(H)","SFE(H)","FIE(H)"] as const).map(code=>({code,label:code,family:"EXAMINER" as const,category:"HELICOPTER" as const,role:"EXAMINER" as const,reference:"Part-FCL Subpart K"})),
  {code:"FE(S)",label:"Flight examiner — sailplanes",family:"EXAMINER",category:"SAILPLANE",role:"EXAMINER",reference:"SFCL.415"},
  {code:"FE(B)",label:"Flight examiner — balloons",family:"EXAMINER",category:"BALLOON",role:"EXAMINER",reference:"BFCL.415"},
];

export function qualificationCatalogEntry(value:unknown){const code=String(value??"").trim().toUpperCase();return QUALIFICATION_CATALOG.find(item=>item.code.toUpperCase()===code)||null}
