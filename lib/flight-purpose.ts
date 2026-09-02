export const FLIGHT_PURPOSES=[
  {code:"AIRCRAFT_DIFFERENCES",label:"Aircraft differences training / endorsement",task:"Differences training"},
  {code:"AIRCRAFT_FAMILIARISATION",label:"Aircraft familiarisation",task:"Familiarisation"},
  {code:"LAPL_FCL140A_REFRESHER",label:"LAPL(A) · FCL.140.A refresher training",task:"FCL.140.A refresher training"},
  {code:"LAPL_H_FCL140H_REFRESHER",label:"LAPL(H) · FCL.140.H refresher training",task:"FCL.140.H refresher training"},
  {code:"SEP_TMG_FCL740A_REFRESHER",label:"SEP/TMG · FCL.740.A refresher training",task:"FCL.740.A refresher training"},
  {code:"SPL_SFCL160_TRAINING",label:"SPL · SFCL.160 recency training",task:"SFCL.160 training flight"},
] as const;

export type FlightPurposeCode=(typeof FLIGHT_PURPOSES)[number]["code"];
const known=new Set<string>(FLIGHT_PURPOSES.map(item=>item.code));
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

function values(value:unknown):string[]{
  if(Array.isArray(value))return value.flatMap(item=>values(item));
  return String(value??"").split(/[|,]/).map(item=>item.trim()).filter(Boolean);
}

export function normalizeFlightPurposeCodes(value:unknown):FlightPurposeCode[]{
  const selected=new Set(values(value).map(item=>item.toUpperCase()).filter(item=>known.has(item)) as FlightPurposeCode[]);
  return FLIGHT_PURPOSES.map(item=>item.code).filter(code=>selected.has(code));
}

export function serializeFlightPurposeCodes(value:unknown){return normalizeFlightPurposeCodes(value).join("|")}

export function normalizeFlightPurposeCode(value:unknown):FlightPurposeCode|""{return normalizeFlightPurposeCodes(value)[0]??""}

export function primaryFlightPurposeCode(value:unknown):FlightPurposeCode|""{
  const selected=new Set(normalizeFlightPurposeCodes(value));
  for(const code of ["LAPL_FCL140A_REFRESHER","LAPL_H_FCL140H_REFRESHER","SEP_TMG_FCL740A_REFRESHER","SPL_SFCL160_TRAINING","AIRCRAFT_DIFFERENCES","AIRCRAFT_FAMILIARISATION"] as const)if(selected.has(code))return code;
  return "";
}

export function flightPurposeTask(value:unknown){
  const selected=new Set(normalizeFlightPurposeCodes(value));
  return FLIGHT_PURPOSES.filter(item=>selected.has(item.code)).map(item=>item.task).join(" · ");
}

export function flightPurposeCodesFromTask(value:unknown):FlightPurposeCode[]{
  let text=String(value??"").trim();
  const selected:FlightPurposeCode[]=[];
  let changed=true;
  while(changed){
    changed=false;
    for(const item of FLIGHT_PURPOSES){
      if(selected.includes(item.code))continue;
      const pattern=new RegExp(`^${escapeRegExp(item.task)}\\s*(?:·\\s*)?`,"i");
      const next=text.replace(pattern,"").trim();
      if(next!==text){selected.push(item.code);text=next;changed=true}
    }
  }
  return normalizeFlightPurposeCodes(selected);
}

export function stripFlightPurposeTasks(value:unknown){
  let text=String(value??"").trim();
  let changed=true;
  while(changed){
    changed=false;
    for(const item of FLIGHT_PURPOSES){
      const pattern=new RegExp(`^${escapeRegExp(item.task)}\\s*(?:·\\s*)?`,"i");
      const next=text.replace(pattern,"").trim();
      if(next!==text){text=next;changed=true}
    }
  }
  return text;
}

export function hasFlightPurpose(value:unknown,code:FlightPurposeCode){return normalizeFlightPurposeCodes(value).includes(code)}
export function isLaplRefresherPurpose(value:unknown){return hasFlightPurpose(value,"LAPL_FCL140A_REFRESHER")}
export function isLaplHRefresherPurpose(value:unknown){return hasFlightPurpose(value,"LAPL_H_FCL140H_REFRESHER")}
