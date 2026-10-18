/**
 * R2.1c-D3 Batch 1: OFFLINE/SYNTHETIC, no production import, DB, GPS user
 * records, application authority, sensor attestation or persistent notes.
 * Correct parsing of raw text != authenticated position/altitude evidence.
 */
import {createHash} from "node:crypto";
import {
  CSV_LINEAGE_PARSER_REVISION,
  examineStrictCsvSourceLineage,
  type CsvLineageFailure,
} from "./csv-lineage.ts";

export const R21_D3_ALGORITHM_REVISION="R21_D3_OFFLINE_V1" as const;

export type D3UnavailableReason=
  "INVALID_CONTEXT"|"SOURCE_UNAVAILABLE"|"SOURCE_NOT_VERIFIED"|
  "STALE_CONTEXT"|"INVALID_REVIEW_STATE";

export type D3ReviewBinding={
  /** Local raw-string equality only: never independent sensor/source authority. */
  sourceSha256:string;
  uploadRevision:number;
  splitRevision:number;
  splitStart:number;
  splitEndExclusive:number;
  parserRevision:typeof CSV_LINEAGE_PARSER_REVISION;
  algorithmRevision:typeof R21_D3_ALGORITHM_REVISION;
};

export type D3ReviewSession={
  binding:D3ReviewBinding;
  /** No candidate can receive a note until an independently authorized source gate exists. */
  notes:readonly [];
};

export type D3SourceDiagnostic=
  | {status:"UNAVAILABLE";reason:CsvLineageFailure}
  | {
      status:"PARSED_DIAGNOSTIC_ONLY";
      parserRevision:typeof CSV_LINEAGE_PARSER_REVISION;
      declaredUnit:"m"|"ft";
      normalizedPoints:number;
      selectedPoints:number;
      reordered:boolean;
      /** Exact original lines are intentionally not exposed. */
      rawLineReferences:"NOT_EXPORTED";
      sourceAccuracy:"UNKNOWN";
      altitudeMode:"UNKNOWN";
      verticalDatum:"UNKNOWN";
    };

export type D3PilotUnavailable={
  altitudeCandidates:"HIDDEN";
  horizontalCandidates:"HIDDEN";
  eventTime:"UNAVAILABLE";
  physicalContact:"UNRESOLVED";
  fullFlightLandingCount:"UNAVAILABLE";
  canAffectCanonicalFlight:false;
};

export type D3OfflineReviewDto={
  status:"UNAVAILABLE";
  reason:D3UnavailableReason;
  source:D3SourceDiagnostic|null;
  session:D3ReviewSession|null;
  notePolicy:{initial:"LEAVE_UNRESOLVED";persistence:"NONE";canAddNotes:false};
  pilot:D3PilotUnavailable;
};

const PILOT:D3PilotUnavailable=Object.freeze({
  altitudeCandidates:"HIDDEN",
  horizontalCandidates:"HIDDEN",
  eventTime:"UNAVAILABLE",
  physicalContact:"UNRESOLVED",
  fullFlightLandingCount:"UNAVAILABLE",
  canAffectCanonicalFlight:false,
});
const NOTE_POLICY:D3OfflineReviewDto["notePolicy"]=Object.freeze({
  initial:"LEAVE_UNRESOLVED",persistence:"NONE",canAddNotes:false,
});
const isRecord=(value:unknown):value is Record<string,unknown>=>
  value!==null&&typeof value==="object"&&!Array.isArray(value);
const exactKeys=(value:Record<string,unknown>,keys:readonly string[])=>
  Object.keys(value).length===keys.length&&
  keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
const boundedRevision=(v:unknown)=>
  typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const boundedIndex=(v:unknown)=>
  typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;

function parseContext(input:unknown){
  if(!isRecord(input)||!exactKeys(input,["uploadRevision","splitRevision","split","algorithmRevision"]))
    return null;
  if(!boundedRevision(input.uploadRevision)||!boundedRevision(input.splitRevision)||
    input.algorithmRevision!==R21_D3_ALGORITHM_REVISION||
    !isRecord(input.split)||!exactKeys(input.split,["start","endExclusive"])||
    !boundedIndex(input.split.start)||!boundedIndex(input.split.endExclusive)||
    (input.split.endExclusive as number)<=(input.split.start as number))return null;
  return {
    uploadRevision:input.uploadRevision as number,
    splitRevision:input.splitRevision as number,
    start:input.split.start as number,
    endExclusive:input.split.endExclusive as number,
  };
}

const validBinding=(input:unknown):input is D3ReviewBinding=>{
  if(!isRecord(input)||!exactKeys(input,[
    "sourceSha256","uploadRevision","splitRevision","splitStart",
    "splitEndExclusive","parserRevision","algorithmRevision"
  ]))return false;
  return typeof input.sourceSha256==="string"&&/^[a-f0-9]{64}$/.test(input.sourceSha256)&&
    boundedRevision(input.uploadRevision)&&boundedRevision(input.splitRevision)&&
    boundedIndex(input.splitStart)&&boundedIndex(input.splitEndExclusive)&&
    (input.splitEndExclusive as number)>(input.splitStart as number)&&
    input.parserRevision===CSV_LINEAGE_PARSER_REVISION&&
    input.algorithmRevision===R21_D3_ALGORITHM_REVISION;
};
const validSession=(input:unknown):input is D3ReviewSession=>
  isRecord(input)&&exactKeys(input,["binding","notes"])&&
  validBinding(input.binding)&&Array.isArray(input.notes)&&input.notes.length===0;

function unavailable(
  reason:D3UnavailableReason,
  source:D3SourceDiagnostic|null=null,
  session:D3ReviewSession|null=null
):D3OfflineReviewDto{
  return {status:"UNAVAILABLE",reason,source,session,notePolicy:NOTE_POLICY,pilot:PILOT};
}

/** Accepts raw in-memory synthetic CSV, never a caller-supplied approval bit.
 * The source digest binds one local session; a digest is NOT device/sensor trust.
 * Returning UNAVAILABLE for a perfectly parsed file is intentional.
 */
export function buildOfflinePilotReviewDto(input:unknown):D3OfflineReviewDto{
  if(!isRecord(input)||!exactKeys(input,
    Object.prototype.hasOwnProperty.call(input,"previousSession")
      ?["sourceText","context","previousSession"]:["sourceText","context"]))
    return unavailable("INVALID_CONTEXT");
  const context=parseContext(input.context);
  if(!context)return unavailable("INVALID_CONTEXT");
  if(Object.prototype.hasOwnProperty.call(input,"previousSession")&&
    !validSession(input.previousSession))
    return unavailable("INVALID_REVIEW_STATE");
  const report=examineStrictCsvSourceLineage(input.sourceText);
  if(report.status==="UNAVAILABLE")
    return unavailable("SOURCE_UNAVAILABLE",{status:"UNAVAILABLE",reason:report.reason});
  if(context.endExclusive>report.samples.length||context.endExclusive-context.start<2)
    return unavailable("INVALID_CONTEXT");

  const binding:D3ReviewBinding={
    sourceSha256:createHash("sha256").update(input.sourceText as string,"utf8").digest("hex"),
    uploadRevision:context.uploadRevision,
    splitRevision:context.splitRevision,
    splitStart:context.start,
    splitEndExclusive:context.endExclusive,
    parserRevision:CSV_LINEAGE_PARSER_REVISION,
    algorithmRevision:R21_D3_ALGORITHM_REVISION,
  };
  const source:D3SourceDiagnostic={
    status:"PARSED_DIAGNOSTIC_ONLY",parserRevision:CSV_LINEAGE_PARSER_REVISION,
    declaredUnit:report.sourceUnit,
    normalizedPoints:report.samples.length,
    selectedPoints:context.endExclusive-context.start,
    reordered:report.reorder!=="UNCHANGED",
    rawLineReferences:"NOT_EXPORTED",sourceAccuracy:"UNKNOWN",
    altitudeMode:"UNKNOWN",verticalDatum:"UNKNOWN",
  };

  if(Object.prototype.hasOwnProperty.call(input,"previousSession")){
    const previous=(input.previousSession as D3ReviewSession).binding;
    if((Object.keys(binding) as Array<keyof D3ReviewBinding>)
      .some(key=>previous[key]!==binding[key]))
      return unavailable("STALE_CONTEXT",source);
  }
  return unavailable("SOURCE_NOT_VERIFIED",source,{binding,notes:[]});
}
