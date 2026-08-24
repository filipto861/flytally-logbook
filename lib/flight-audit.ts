export type FlightAuditAction="created"|"updated"|"deleted";
export type FlightAuditEvent={id:number;flightId:number;action:FlightAuditAction;changedAt:string;actor:string;oldData:Record<string,unknown>|null;newData:Record<string,unknown>|null};
export type FlightAuditChange={field:string;label:string;before:string;after:string};

const visibleFields=[
  ["record_revision","Revision"],["certified_at","Certification"],["correction_reason","Correction reason"],
  ["date","Date"],["registration","Registration"],["aircraft_type","Aircraft type"],["aircraft_class","Class"],["evidence","Logbook"],
  ["departure","Departure"],["arrival","Arrival"],["off_block","Off-block"],["takeoff","Takeoff"],["landing","Landing"],["on_block","On-block"],
  ["starts","Landings"],["commander","Commander"],["instructor","Instructor"],["role","Role"],["task","Task"],
  ["operation_type","SP / MP"],["engine_type","SE / ME"],["landings_day","Day landings"],["landings_night","Night landings"],
  ["night_minutes","Night time"],["ifr_minutes","IFR time"],["pic_minutes","PIC time"],["copilot_minutes","Co-pilot time"],["dual_minutes","Dual time"],["instructor_minutes","FI / FE time"],
  ["verification_name","Supervising pilot"],["verification_reference","Verification reference"],
  ["price_per_hour","Hourly rate"],["billing_basis","Billing"],["note","Notes"],["locked_at","Lock status"],
] as const;

function display(field:string,value:unknown){
  if(field==="locked_at")return value?"Locked":"Unlocked";
  if(field==="certified_at")return value?"Certified":"Draft";
  if(value===null||value===undefined||value==="")return"—";
  if(field==="price_per_hour"&&Number.isFinite(Number(value)))return`${Number(value).toLocaleString("en-GB")} CZK/h`;
  if(field.endsWith("_minutes")&&Number.isFinite(Number(value))){const minutes=Math.max(0,Number(value));return`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,"0")}`}
  return String(value);
}

export function flightAuditChanges(oldData:Record<string,unknown>|null,newData:Record<string,unknown>|null):FlightAuditChange[]{
  const before=oldData??{},after=newData??{};
  return visibleFields.flatMap(([field,label])=>{
    const previous=display(field,before[field]),next=display(field,after[field]);
    return previous===next?[]:[{field,label,before:previous,after:next}];
  });
}
