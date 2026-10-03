export const LEGACY_GPS_IMPORT_TASK="GPS import";

export function isLegacyGpsImportTask(value:unknown){
  return typeof value==="string"&&value===LEGACY_GPS_IMPORT_TASK;
}
