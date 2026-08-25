const PIC_ROLES=new Set(["PIC","SOLO","SPIC","PICUS","INSTRUKTOR","INSTRUCTOR","EXAMINER"]);

const clean=(value:unknown)=>String(value??"").trim().toUpperCase();
const minutes=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));

export function normalizedPilotRole(role:unknown,instructor:unknown=""){
  const value=clean(role);
  if(value==="INSTRUKTOR")return "INSTRUCTOR";
  if(value==="STUDENT"||(!value&&clean(instructor)))return "DUAL";
  return value;
}

export function effectivePicMinutes(role:unknown,storedPicMinutes:unknown,blockMinutes:unknown){
  const stored=minutes(storedPicMinutes);
  if(stored>0)return stored;
  return PIC_ROLES.has(normalizedPilotRole(role))?minutes(blockMinutes):0;
}

export function includedInDashboardTotal(role:unknown){
  return !["PAX","OBSERVER"].includes(normalizedPilotRole(role));
}
