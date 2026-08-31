export const AIRCRAFT_ENDORSEMENTS=[
  {code:"VP",label:"Variable-pitch propeller"},
  {code:"RU",label:"Retractable undercarriage"},
  {code:"T",label:"Turbocharged / supercharged engine"},
  {code:"P",label:"Cabin pressurisation"},
  {code:"TW",label:"Tailwheel"},
  {code:"EFIS",label:"Electronic flight instrument system"},
  {code:"SLPC",label:"Single-lever power control"},
] as const;

export type AircraftEndorsementCode=(typeof AIRCRAFT_ENDORSEMENTS)[number]["code"];
const known=new Set<string>(AIRCRAFT_ENDORSEMENTS.map(item=>item.code));

export function parseAircraftEndorsements(value:unknown):{codes:AircraftEndorsementCode[];custom:string}{
  const raw=String(value??"").trim();
  if(!raw)return{codes:[],custom:""};
  const selected=new Set<AircraftEndorsementCode>(),custom:string[]=[];
  for(const token of raw.split(/\s*(?:·|,|;|\||\/)\s*/).map(item=>item.trim()).filter(Boolean)){
    const code=token.toUpperCase();
    if(known.has(code))selected.add(code as AircraftEndorsementCode);
    else custom.push(token);
  }
  return{codes:AIRCRAFT_ENDORSEMENTS.map(item=>item.code).filter(code=>selected.has(code)),custom:custom.join(" · ")};
}

export function serializeAircraftEndorsements(values:Iterable<unknown>,custom=""){
  const requested=new Set([...values].map(value=>String(value??"").trim().toUpperCase()).filter(value=>known.has(value)));
  const codes=AIRCRAFT_ENDORSEMENTS.map(item=>item.code).filter(code=>requested.has(code));
  const other=String(custom??"").trim().replace(/\s*·\s*/g," · ").slice(0,420);
  return [...codes,...(other?[other]:[])].join(" · ").slice(0,500);
}
