/** Offline D2-B research-only diagnostic model.
 * A caller-supplied normalized TrackInspection cannot prove original source
 * bytes, row indices, units, accuracy, datum, or a trusted parser revision.
 * Never import this module into production GPS or canonical flight workflows.
 */
export type ProvenanceUnavailableReason="MALFORMED_INSPECTION"|"SOURCE_LINEAGE_NOT_ATTESTED";
export type UnavailablePilotEvidence={
  availability:"UNAVAILABLE";
  vertical:"UNAVAILABLE";
  horizontal:"UNAVAILABLE";
  eventTime:"UNAVAILABLE";
  normalizedToRawIndex:"UNAVAILABLE";
  groundContact:"UNRESOLVED";
  wholeFlightLandings:"UNAVAILABLE";
  canAffectCanonicalFlight:false;
};

/** Distinct from authoritatively validated source evidence.
 * The only possible pilot-facing state at this stage is UNAVAILABLE. */
export type LegacyInspectionProvenance=
  | {status:"UNAVAILABLE";reason:"MALFORMED_INSPECTION";pilot:UnavailablePilotEvidence}
  | {
      status:"DIAGNOSTIC_ONLY";
      reason:"SOURCE_LINEAGE_NOT_ATTESTED";
      inputKind:"CALLER_SUPPLIED_NORMALIZED_INSPECTION";
      format:"kml"|"gpx"|"csv";
      /** Counts describe the normalized array only, not source records. */
      normalizedPointCount:number;
      nullAltitudeCount:number;
      numericZeroAltitudeCount:number;
      nullTimestampCount:number;
      /** A normalized zero could be genuine OR a coerced missing coordinate. */
      zeroCoordinateCount:number;
      transformations:{
        originalSampleOrder:"UNAVAILABLE";
        originalRowMapping:"UNAVAILABLE";
        deduplicationLineage:"UNAVAILABLE";
        altitudeUnitConversionLineage:"UNAVAILABLE";
      };
      sourceClaims:{
        sourceUnit:"UNKNOWN";
        altitudeMode:"UNKNOWN";
        verticalDatum:"UNKNOWN";
        horizontalAccuracy:"UNKNOWN";
        verticalAccuracy:"UNKNOWN";
        externalSensorProvenance:"UNKNOWN";
        parserRevision:"UNKNOWN";
      };
      pilot:UnavailablePilotEvidence;
    };

const PILOT_UNAVAILABLE:UnavailablePilotEvidence=Object.freeze({
  availability:"UNAVAILABLE",
  vertical:"UNAVAILABLE",
  horizontal:"UNAVAILABLE",
  eventTime:"UNAVAILABLE",
  normalizedToRawIndex:"UNAVAILABLE",
  groundContact:"UNRESOLVED",
  wholeFlightLandings:"UNAVAILABLE",
  canAffectCanonicalFlight:false
});
const own=(value:Record<string,unknown>,key:string)=>Object.prototype.hasOwnProperty.call(value,key);
const record=(value:unknown):value is Record<string,unknown>=>
  value!==null&&typeof value==="object"&&!Array.isArray(value);
const exactKeys=(value:Record<string,unknown>,keys:readonly string[])=>
  Object.keys(value).length===keys.length&&keys.every(key=>own(value,key));
const validPoint=(value:unknown):value is {lat:number;lon:number;alt:number|null;time:string|null}=>{
  if(!record(value)||!exactKeys(value,["lat","lon","alt","time"]))return false;
  return typeof value.lat==="number"&&Number.isFinite(value.lat)&&Math.abs(value.lat)<=90&&
    typeof value.lon==="number"&&Number.isFinite(value.lon)&&Math.abs(value.lon)<=180&&
    (value.alt===null||(typeof value.alt==="number"&&Number.isFinite(value.alt)))&&
    (value.time===null||typeof value.time==="string");
};

/** Does not invoke the parser or read files/DB. Caller-provided TrackInspection
 * is inherently untrusted; even perfect shape cannot authenticate raw bytes.
 * Never return coordinates, times, altitude values, filenames, or track IDs.
 */
export function characterizeUnattestedLegacyInspection(input:unknown):LegacyInspectionProvenance{
  const invalid=():LegacyInspectionProvenance=>({
    status:"UNAVAILABLE",reason:"MALFORMED_INSPECTION",pilot:PILOT_UNAVAILABLE
  });
  if(!record(input)||!exactKeys(input,["format","source","points","quality"]))return invalid();
  if(input.format!=="csv"&&input.format!=="kml"&&input.format!=="gpx")return invalid();
  if(!["generic","skydemon","flightradar24","adsbexchange"].includes(String(input.source)))return invalid();
  if(!record(input.quality)||!["good","review","poor"].includes(String(input.quality.status)))return invalid();
  if(!Array.isArray(input.points)||!input.points.every(validPoint))return invalid();
  const points=input.points as {lat:number;lon:number;alt:number|null;time:string|null}[];
  return{
    status:"DIAGNOSTIC_ONLY",
    reason:"SOURCE_LINEAGE_NOT_ATTESTED",
    inputKind:"CALLER_SUPPLIED_NORMALIZED_INSPECTION",
    format:input.format,
    normalizedPointCount:points.length,
    nullAltitudeCount:points.filter(point=>point.alt===null).length,
    numericZeroAltitudeCount:points.filter(point=>point.alt===0).length,
    nullTimestampCount:points.filter(point=>point.time===null).length,
    zeroCoordinateCount:points.filter(point=>point.lat===0||point.lon===0).length,
    transformations:{
      originalSampleOrder:"UNAVAILABLE",
      originalRowMapping:"UNAVAILABLE",
      deduplicationLineage:"UNAVAILABLE",
      altitudeUnitConversionLineage:"UNAVAILABLE"
    },
    sourceClaims:{
      sourceUnit:"UNKNOWN",
      altitudeMode:"UNKNOWN",
      verticalDatum:"UNKNOWN",
      horizontalAccuracy:"UNKNOWN",
      verticalAccuracy:"UNKNOWN",
      externalSensorProvenance:"UNKNOWN",
      parserRevision:"UNKNOWN"
    },
    pilot:PILOT_UNAVAILABLE
  };
}
