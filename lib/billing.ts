export type BillingBasis = "BLOCK" | "AIR";

export type BillingSettings = {
  basis: BillingBasis;
  share: number;
};

export type OptionalBillingResult =
  | { value: string; settings: BillingSettings | null; error?: undefined }
  | { value: ""; settings: null; error: string };

export const BILLING_SHARES = [1, 2, 3, 4] as const;

const billingShare=(value:unknown)=>{
  const raw=String(value??"").trim();
  if(!raw)return 1;
  const parsed=Number(raw);
  return Number.isSafeInteger(parsed)&&parsed>=1&&parsed<=20?parsed:null;
};

export function parseOptionalBilling(value:unknown):OptionalBillingResult{
  const raw=String(value??"").trim().toUpperCase();
  if(!raw)return{value:"",settings:null};
  const match=/^(BLOCK|AIR)(?:\/(\d+))?$/.exec(raw);
  if(!match)return{value:"",settings:null,error:"Select a valid billing time basis."};
  const share=billingShare(match[2]??"1");
  if(share===null)return{value:"",settings:null,error:"Select a valid billing share."};
  const basis=match[1] as BillingBasis;
  return{value:share===1?basis:`${basis}/${share}`,settings:{basis,share}};
}

export function serializeOptionalBilling(basis:unknown,share:unknown):OptionalBillingResult{
  const normalized=String(basis??"").trim().toUpperCase();
  if(!normalized)return{value:"",settings:null};
  if(normalized!=="BLOCK"&&normalized!=="AIR")return{value:"",settings:null,error:"Select a valid billing time basis."};
  const parsedShare=billingShare(share);
  if(parsedShare===null)return{value:"",settings:null,error:"Select a valid billing share."};
  const typedBasis=normalized as BillingBasis;
  return{value:parsedShare===1?typedBasis:`${typedBasis}/${parsedShare}`,settings:{basis:typedBasis,share:parsedShare}};
}

// Legacy helpers stay compatible for old callers that intentionally expect a
// BLOCK fallback. New optional-cost flows must use the optional helpers above.
export function parseBilling(value: unknown): BillingSettings {
  const parsed=parseOptionalBilling(value);
  return parsed.settings??{basis:"BLOCK",share:1};
}

export function serializeBilling(basis: unknown, share: unknown): string {
  const normalizedBasis: BillingBasis = String(basis).toUpperCase() === "AIR" ? "AIR" : "BLOCK";
  const parsedShare = Number(share);
  const normalizedShare = Number.isSafeInteger(parsedShare) && parsedShare >= 1 && parsedShare <= 20 ? parsedShare : 1;
  return normalizedShare === 1 ? normalizedBasis : `${normalizedBasis}/${normalizedShare}`;
}

export function calculatedFlightPrice(
  pricePerHour: unknown,
  blockMinutes: unknown,
  airMinutes: unknown,
  billing: unknown,
): number {
  const hourly = Math.max(0, Number(pricePerHour) || 0);
  const parsed=parseOptionalBilling(billing);
  if(!parsed.settings)return 0;
  const { basis, share }=parsed.settings;
  const minutes = Math.max(0, Number(basis === "AIR" ? airMinutes : blockMinutes) || 0);
  return (hourly * minutes) / 60 / share;
}

export function billingLabel(value: unknown): string {
  const parsed=parseOptionalBilling(value);
  if(!parsed.settings)return "Not tracked";
  const { basis, share }=parsed.settings;
  return `${basis}${share > 1 ? ` · share 1/${share}` : " · full price"}`;
}
