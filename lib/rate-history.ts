export type EffectiveRate={valid_from:string|null;price_per_hour:number};

export function validIsoDate(value:unknown):value is string{
  const text=String(value??"");
  return /^\d{4}-\d{2}-\d{2}$/.test(text)&&!Number.isNaN(Date.parse(`${text}T00:00:00Z`));
}

export function effectiveRateForDate(rates:EffectiveRate[],date:string):EffectiveRate|null{
  if(!validIsoDate(date))return null;
  return rates
    .filter(rate=>rate.valid_from===null||(validIsoDate(rate.valid_from)&&rate.valid_from<=date))
    .sort((a,b)=>String(b.valid_from??"").localeCompare(String(a.valid_from??"")))[0]??null;
}

export function shouldResolveStoredPrice(existing:{registration:unknown;date:unknown;price_per_hour:unknown},registration:string,date:string){
  const oldRegistration=String(existing.registration??"").trim().toUpperCase();
  const oldDate=String(existing.date??"").slice(0,10);
  const storedPrice=Number(existing.price_per_hour);
  return oldRegistration!==registration.trim().toUpperCase()||oldDate!==date||!Number.isFinite(storedPrice)||storedPrice<=0;
}
