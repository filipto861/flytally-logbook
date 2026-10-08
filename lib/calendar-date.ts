const RAW_OFFSET_TIME_ZONE=/^[+-](?:[01]\d|2[0-3]):?[0-5]\d$/;

export function normalizeSaveableTimeZone(value:unknown){
  const candidate=String(value??"").trim();
  if(!candidate||RAW_OFFSET_TIME_ZONE.test(candidate))return null;
  try{
    new Intl.DateTimeFormat("en-GB",{timeZone:candidate}).format(new Date(0));
    return candidate;
  }catch{
    return null;
  }
}

export function calendarDateInTimeZone(instant:Date|string|number,timeZone:unknown){
  const zone=normalizeSaveableTimeZone(timeZone);
  if(!zone)return null;
  const date=instant instanceof Date?new Date(instant.getTime()):new Date(instant);
  if(Number.isNaN(date.getTime()))return null;
  try{
    const parts=Object.fromEntries(
      new Intl.DateTimeFormat("en-GB",{
        timeZone:zone,
        calendar:"gregory",
        numberingSystem:"latn",
        year:"numeric",
        month:"2-digit",
        day:"2-digit",
      }).formatToParts(date).map(part=>[part.type,part.value]),
    );
    const result=`${parts.year??""}-${parts.month??""}-${parts.day??""}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(result)?result:null;
  }catch{
    return null;
  }
}
