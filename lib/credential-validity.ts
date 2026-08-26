export type ValidityMode="unlimited"|"date"|"recency";
export function normalizeValidityMode(value:unknown):ValidityMode{
  const mode=String(value??"").trim().toLowerCase();return mode==="unlimited"||mode==="recency"?mode:"date";
}
export function credentialValidity(input:{mode:unknown;validUntil?:unknown;recencyUntil?:unknown},today=new Date().toISOString().slice(0,10)){
  const mode=normalizeValidityMode(input.mode),until=String(mode==="recency"?input.recencyUntil:input.validUntil??"").slice(0,10);
  if(mode==="unlimited")return{mode,status:"valid" as const,label:"Unlimited"};
  if(!until)return{mode,status:"incomplete" as const,label:mode==="recency"?"Recency not recorded":"Expiry not recorded"};
  return{mode,status:until<today?"expired" as const:"valid" as const,label:`${mode==="recency"?"Current until":"Valid until"} ${until}`};
}
