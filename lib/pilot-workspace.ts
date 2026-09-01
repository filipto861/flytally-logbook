export type PilotWorkspaceCategory="aeroplane"|"helicopter"|"sailplane"|"balloon"|"ull"|"other";
export type PilotWorkspaceTone="current"|"attention"|"review"|"info";

export type PilotWorkspaceItem={
  id:string;
  kind:"licence"|"privilege"|"document"|"recency";
  category:PilotWorkspaceCategory;
  label:string;
  detail?:string;
  statusLabel:string;
  tone:PilotWorkspaceTone;
  href:string;
};

const compact=(value:unknown)=>String(value??"").trim().toUpperCase().replace(/\s+/g,"");

/** Presentation-only categorisation. It never decides regulatory eligibility or flight credit. */
export function pilotWorkspaceCategory(value:unknown):PilotWorkspaceCategory{
  const q=compact(value);
  if(q==="ULL"||q.includes("ULTRALIGHT"))return"ull";
  if(q==="SPL"||q.includes("SAILPLANE")||q.includes("GLIDER"))return"sailplane";
  if(q==="BPL"||q.includes("BALLOON"))return"balloon";
  if(q.includes("(H)")||q.includes("HELICOPTER"))return"helicopter";
  if(q.includes("(A)")||["SEP","TMG","MEP","NIGHT","IR","IR(A)","FI(A)","CRI(A)","IRI(A)","FE(A)"].includes(q))return"aeroplane";
  return"other";
}

export function validityTone(status:unknown):PilotWorkspaceTone{
  const value=compact(status).toLowerCase();
  return value==="valid"?"current":value==="warning"?"review":"attention";
}

export function workspaceToneRank(tone:PilotWorkspaceTone){
  return tone==="attention"?0:tone==="review"?1:tone==="current"?2:3;
}

export function sortPilotWorkspaceItems(items:PilotWorkspaceItem[]){
  return [...items].sort((a,b)=>workspaceToneRank(a.tone)-workspaceToneRank(b.tone)||a.label.localeCompare(b.label));
}
