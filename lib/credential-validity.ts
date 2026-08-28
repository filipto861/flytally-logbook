export type ValidityMode="unlimited"|"date"|"recency";
export function normalizeValidityMode(value:unknown):ValidityMode{
  const mode=String(value??"").trim().toLowerCase();return mode==="unlimited"||mode==="recency"?mode:"date";
}
const dayNumber=(value:string)=>Math.floor(new Date(`${value}T00:00:00Z`).getTime()/86400000);
export function credentialValidity(input:{mode:unknown;validUntil?:unknown;recencyUntil?:unknown;warningDays?:unknown},today=new Date().toISOString().slice(0,10)){
  const mode=normalizeValidityMode(input.mode),until=String(mode==="recency"?input.recencyUntil:input.validUntil??"").slice(0,10),warningDays=Math.max(0,Number(input.warningDays??30)||0);
  if(mode==="unlimited")return{mode,status:"valid" as const,label:"Unlimited",daysRemaining:null,until:""};
  if(!until)return{mode,status:"incomplete" as const,label:mode==="recency"?"Recency not recorded":"Expiry not recorded",daysRemaining:null,until:""};
  const daysRemaining=dayNumber(until)-dayNumber(today),label=`${mode==="recency"?"Current until":"Valid until"} ${until}`;
  if(daysRemaining<0)return{mode,status:"expired" as const,label,daysRemaining,until};
  if(daysRemaining<=warningDays)return{mode,status:"warning" as const,label,daysRemaining,until};
  return{mode,status:"valid" as const,label,daysRemaining,until};
}
