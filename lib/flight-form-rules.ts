export function normalizeRegistration(value:unknown){return String(value??"").trim().toUpperCase()}

export function normalizeChoice<T extends readonly string[]>(value:unknown,allowed:T,fallback:""|T[number]=""){const normalized=String(value??"").trim().toUpperCase();return allowed.includes(normalized as T[number])?normalized as T[number]:fallback}

export function shouldApplyAircraftProfileDefaults(editing:boolean,initialRegistration:unknown,nextRegistration:unknown){
  return !editing||normalizeRegistration(initialRegistration)!==normalizeRegistration(nextRegistration);
}
