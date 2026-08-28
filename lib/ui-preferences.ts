export const APPEARANCE_OPTIONS=[
  {value:"system",label:"System"},
  {value:"dark",label:"Dark"},
  {value:"light",label:"Light"},
] as const;

export type AppearancePreference=(typeof APPEARANCE_OPTIONS)[number]["value"];

export function normalizeAppearance(value:unknown):AppearancePreference{
  const normalized=String(value??"").trim().toLowerCase();
  return APPEARANCE_OPTIONS.some(option=>option.value===normalized)?normalized as AppearancePreference:"system";
}

export function appearanceFromPreferences(preferences:Record<string,unknown>|null|undefined){
  return normalizeAppearance(preferences?.appearance);
}
