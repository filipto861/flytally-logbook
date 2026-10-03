export const NIGHT_DEFINITIONS=["MANUAL","SERA"] as const;
export type NightDefinition=(typeof NIGHT_DEFINITIONS)[number];

export function normalizeNightDefinition(value:unknown):NightDefinition{
  return String(value??"").trim().toUpperCase()==="SERA"?"SERA":"MANUAL";
}

export function nightDefinitionFromPreferences(value:unknown):NightDefinition{
  if(value&&typeof value==="object"&&!Array.isArray(value)){
    return normalizeNightDefinition((value as Record<string,unknown>).night_definition);
  }
  try{
    const parsed=JSON.parse(String(value??"{}"));
    return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)
      ?normalizeNightDefinition((parsed as Record<string,unknown>).night_definition)
      :"MANUAL";
  }catch{return"MANUAL"}
}
