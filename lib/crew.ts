export const CREW_ROLES=["CO-PILOT","SAFETY PILOT","INSTRUCTOR","EXAMINER","OBSERVER"] as const;
export type CrewRole=(typeof CREW_ROLES)[number];

export const VERIFIER_ROLES=["INSTRUCTOR","SUPERVISING PIC","EXAMINER"] as const;
export type VerifierRole=(typeof VERIFIER_ROLES)[number];

export function normalizeCrewRole(value:unknown):CrewRole|null{
  const role=String(value??"").trim().toUpperCase();
  return CREW_ROLES.includes(role as CrewRole)?role as CrewRole:null;
}

export function crewRoleCredits(role:unknown,blockMinutes:number){
  const normalized=normalizeCrewRole(role),minutes=Math.max(0,Math.round(blockMinutes)||0);
  return{
    role:normalized,
    pic:normalized==="INSTRUCTOR"||normalized==="EXAMINER"?minutes:0,
    copilot:normalized==="CO-PILOT"?minutes:0,
    instructor:normalized==="INSTRUCTOR"?minutes:0,
  };
}

export function verifierRoleForFlight(role:unknown):VerifierRole|null{
  const normalized=String(role??"").trim().toUpperCase();
  if(normalized==="DUAL")return"INSTRUCTOR";
  if(normalized==="SPIC"||normalized==="PICUS")return"SUPERVISING PIC";
  if(normalized==="EXAM")return"EXAMINER";
  return null;
}

export function validCrewCombination(sourceRole:unknown,participantRole:unknown){
  const source=String(sourceRole??"").trim().toUpperCase(),participant=normalizeCrewRole(participantRole);
  if(!participant)return false;
  if(participant==="SAFETY PILOT")return source==="PIC";
  if(participant==="INSTRUCTOR")return ["DUAL","SPIC","PICUS","SOLO","PIC"].includes(source);
  if(participant==="EXAMINER")return ["PIC","SPIC","PICUS","DUAL"].includes(source);
  return true;
}

export const REQUEST_STATES=["pending","accepted","declined","signed","superseded","cancelled","revoked"] as const;
export function isRequestState(value:unknown){return REQUEST_STATES.includes(String(value??"") as (typeof REQUEST_STATES)[number])}
