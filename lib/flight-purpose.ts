export const FLIGHT_PURPOSES=[
  {code:"",label:"General / other training",task:""},
  {code:"LAPL_FCL140A_REFRESHER",label:"LAPL(A) · FCL.140.A refresher training",task:"FCL.140.A refresher training"},
] as const;

export type FlightPurposeCode=(typeof FLIGHT_PURPOSES)[number]["code"];

export function normalizeFlightPurposeCode(value:unknown):FlightPurposeCode{
  const code=String(value??"").trim().toUpperCase();
  return FLIGHT_PURPOSES.some(item=>item.code===code)?code as FlightPurposeCode:"";
}

export function flightPurposeTask(code:unknown){
  return FLIGHT_PURPOSES.find(item=>item.code===normalizeFlightPurposeCode(code))?.task??"";
}

export function isLaplRefresherPurpose(value:unknown){return normalizeFlightPurposeCode(value)==="LAPL_FCL140A_REFRESHER"}
