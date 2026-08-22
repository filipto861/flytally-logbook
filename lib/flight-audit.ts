export type FlightAuditAction="created"|"updated"|"deleted";
export type FlightAuditEvent={id:number;flightId:number;action:FlightAuditAction;changedAt:string;actor:string;oldData:Record<string,unknown>|null;newData:Record<string,unknown>|null};
export type FlightAuditChange={field:string;label:string;before:string;after:string};

const visibleFields=[
  ["date","Date"],["registration","Registration"],["aircraft_type","Aircraft type"],["aircraft_class","Class"],["evidence","Logbook"],
  ["departure","Departure"],["arrival","Arrival"],["off_block","Off-block"],["takeoff","Takeoff"],["landing","Landing"],["on_block","On-block"],
  ["starts","Landings"],["commander","Commander"],["instructor","Instructor"],["role","Role"],["task","Task"],
  ["price_per_hour","Hourly rate"],["billing_basis","Billing"],["note","Notes"],["locked_at","Lock status"],
] as const;

function display(field:string,value:unknown){
  if(field==="locked_at")return value?"Locked":"Unlocked";
  if(value===null||value===undefined||value==="")return"—";
  if(field==="price_per_hour"&&Number.isFinite(Number(value)))return`${Number(value).toLocaleString("en-GB")} CZK/h`;
  return String(value);
}

export function flightAuditChanges(oldData:Record<string,unknown>|null,newData:Record<string,unknown>|null):FlightAuditChange[]{
  const before=oldData??{},after=newData??{};
  return visibleFields.flatMap(([field,label])=>{
    const previous=display(field,before[field]),next=display(field,after[field]);
    return previous===next?[]:[{field,label,before:previous,after:next}];
  });
}
