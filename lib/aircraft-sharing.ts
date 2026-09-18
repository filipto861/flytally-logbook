export type AircraftShareRate={
  aircraftType:string;
  validFrom:string;
  pricePerHour:number;
  dryPricePerHour:number|null;
  source:string;
};

export type AircraftShareProfile={
  registration:string;
  aircraftType:string;
  aircraftMake:string;
  aircraftModel:string;
  aircraftVariant:string;
  icaoType:string;
  aircraftClass:string;
  regulatoryCategory:string;
  balloonClass:string;
  balloonGroup:string;
  evidence:string;
  partFclCreditClass:string;
  partFclCreditBasis:string;
  partFclCreditFrom:string;
};

export type AircraftShareSnapshot={
  profile:AircraftShareProfile;
  defaults?:{defaultRole:string;billingBasis:string};
  currentRate?:AircraftShareRate;
  rateHistory?:AircraftShareRate[];
  note?:string;
};

const text=(value:unknown)=>String(value??"").trim();
const numberOrZero=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:0};
const nullableNumber=(value:unknown)=>{if(value===null||value===undefined||value==="")return null;const n=Number(value);return Number.isFinite(n)?n:null};
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};

export function parseAircraftShareSnapshot(value:unknown):AircraftShareSnapshot{
  const root=object(value),profile=object(root.profile),defaults=object(root.defaults),current=object(root.currentRate),history=Array.isArray(root.rateHistory)?root.rateHistory:[];
  const rate=(row:unknown):AircraftShareRate=>{const r=object(row);return{aircraftType:text(r.aircraftType),validFrom:text(r.validFrom).slice(0,10),pricePerHour:numberOrZero(r.pricePerHour),dryPricePerHour:nullableNumber(r.dryPricePerHour),source:text(r.source).slice(0,300)}};
  const parsed:AircraftShareSnapshot={profile:{
    registration:text(profile.registration).toUpperCase(),
    aircraftType:text(profile.aircraftType),
    aircraftMake:text(profile.aircraftMake),
    aircraftModel:text(profile.aircraftModel),
    aircraftVariant:text(profile.aircraftVariant),
    icaoType:text(profile.icaoType).toUpperCase(),
    aircraftClass:text(profile.aircraftClass).toUpperCase(),
    regulatoryCategory:text(profile.regulatoryCategory).toUpperCase(),
    balloonClass:text(profile.balloonClass).toUpperCase(),
    balloonGroup:text(profile.balloonGroup).toUpperCase(),
    evidence:text(profile.evidence).toUpperCase(),
    partFclCreditClass:text(profile.partFclCreditClass).toUpperCase(),
    partFclCreditBasis:text(profile.partFclCreditBasis).slice(0,300),
    partFclCreditFrom:text(profile.partFclCreditFrom).slice(0,10),
  }};
  if(Object.keys(defaults).length)parsed.defaults={defaultRole:text(defaults.defaultRole)||"PIC",billingBasis:text(defaults.billingBasis)||"BLOCK"};
  if(Object.keys(current).length)parsed.currentRate=rate(current);
  if(history.length)parsed.rateHistory=history.slice(0,250).map(rate).filter(item=>item.pricePerHour>0&&/^\d{4}-\d{2}-\d{2}$/.test(item.validFrom));
  if(typeof root.note==="string")parsed.note=root.note.slice(0,5000);
  return parsed;
}
