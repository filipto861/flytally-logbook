export const METERS_TO_FEET=3.28084;

export function metersToFeet(value:unknown){
  const metres=Number(value);
  return Number.isFinite(metres)?Math.round(metres*METERS_TO_FEET):0;
}
