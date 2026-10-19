/**
 * D4.3-R2-1: candidate-independent, source-altitude quality inventory.
 *
 * Research only. This examines recorded HEIGHT ENDPOINTS, not wheel contact,
 * verified vertical movement or continuous telemetry. It cannot produce events.
 * No I/O, network access, persistence, flight records or source coordinates
 * in results. All returned diagnostics are aggregate-only.
 */
import {createHash} from "node:crypto";
import {parseKml} from "../../lib/track-processing.ts";
import {GPS_V2_ALGORITHM_REVISION} from "../../lib/gps-v2-advisory.ts";
import {
  D4_LINEAGE_REVISION,inspectD4MultiGxLineage,
} from "./multi-gx-track-lineage.ts";
import {
  D43_R1_REVISION,inspectD43R1Coverage,
} from "./stage-d43-r1-coverage.ts";

export const D43_R2_QUALITY_REVISION="GPS_D43_R2_ALTITUDE_QUALITY_V1" as const;
const EXPECTED_D4="GPS_D4_MULTI_GX_SIDECAR_V1" as const;
const EXPECTED_R1="GPS_D43_R1_SOURCE_COVERAGE_V1" as const;
const EXPECTED_V2="GPS_V2_HORIZONTAL_V3" as const;
/** Historical comparator reference only, NOT an altitude quality certification. */
const LEGACY_DERIVATIVE_REFERENCE_MPS=25;
const LEGACY_DERIVATIVE_MAX_DT_S=15;
const MAX_SOURCE_CHARS=2_000_000;
type UnavailableReason=
 "INVALID_CONTEXT"|"SOURCE_LIMIT"|"INVALID_SPLIT"|"STALE_CONTEXT"|
 "REVISION_MISMATCH"|"UNSUPPORTED_SOURCE"|"MALFORMED_SOURCE"|
 "CANONICAL_SOURCE_MISMATCH"|"SOURCE_ORDER_UNAVAILABLE";
type ReasonCount=Readonly<{reason:string;edges:number}>;
type Base=Readonly<{
 revision:typeof D43_R2_QUALITY_REVISION;
 sourceParserRevision:typeof EXPECTED_D4;
 sourceCoverageRevision:typeof EXPECTED_R1;
 horizontalReferenceRevision:typeof EXPECTED_V2;
 physicalContact:"UNRESOLVED";
 actualLandings:"UNAVAILABLE";
 recencyEvidence:"UNAVAILABLE";
 canAffectCanonicalFlight:false;
}>;
export type D43R2Quality=
 | Base & Readonly<{status:"UNAVAILABLE";reason:UnavailableReason;quality:null}>
 | Base & Readonly<{
     status:"SOURCE_ALTITUDE_QUALITY_DIAGNOSTIC_ONLY";reason:null;
     quality:Readonly<{
       interpretation:"SOURCE_HEIGHT_ENDPOINTS_ONLY_INTERVENING_MOTION_UNKNOWN";
       sourceAltitudeDatum:"UNKNOWN";sourceAltitudeAccuracy:"UNKNOWN";
       sourceAltitudeAuthenticity:"UNKNOWN";
       sourceBlocks:number;canonicalFixes:number;
       finiteAltitudeFixes:number;zeroAltitudeFixes:number;nullAltitudeFixes:number;
       adjacentPairs:number;interveningMotionUnknownPairs:number;
       uniqueIssueEdges:number;issueReasons:readonly ReasonCount[];
       sourceOrSplitBoundaries:number;
       positiveWithinBoundaryTimePairs:number;
       finiteHeightEndpointPairs:number;
       missingHeightEndpointPairs:number;
       referenceAssessedPairs:number;
       referenceExceedances:number;
       /** 0 < dt <= 15s only, measured source altitude difference / dt. */
       referenceInterpretation:"GLOBAL_SOURCE_EDGE_COMPARISON_NOT_LEGACY_WINDOW_REJECTION";
       /** >15s is skipped by the frozen legacy derivative guard, NOT quality-approved. */
       over15SecondsUnassessedPairs:number;
       invalidOrZeroElapsedPairs:number;
       sourceCadenceMaxSeconds:number|null;
       candidateAnalysis:"NOT_PERFORMED";
       unknownManeuvers:"UNAVAILABLE";
     }>;
   }>;

function unavailable(reason:UnavailableReason):D43R2Quality{
 return {
  revision:D43_R2_QUALITY_REVISION,status:"UNAVAILABLE",reason,
  sourceParserRevision:EXPECTED_D4,sourceCoverageRevision:EXPECTED_R1,
  horizontalReferenceRevision:EXPECTED_V2,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
  recencyEvidence:"UNAVAILABLE",canAffectCanonicalFlight:false,quality:null,
 };
}
type Input=Readonly<{
 sourceText:string;splitCuts?:readonly number[];
 uploadRevision?:string;splitRevision?:string;expectedBinding?:string;
}>;
function inputValid(input:unknown):input is Input{
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const r=input as Record<string,unknown>;
 if(!Object.keys(r).every(k=>[
  "sourceText","splitCuts","uploadRevision","splitRevision","expectedBinding",
 ].includes(k)))return false;
 return typeof r.sourceText==="string"&&
  (r.splitCuts===undefined||Array.isArray(r.splitCuts)&&
   r.splitCuts.every(v=>Number.isSafeInteger(v)))&&
  (r.uploadRevision===undefined||typeof r.uploadRevision==="string"&&r.uploadRevision.length<=128)&&
  (r.splitRevision===undefined||typeof r.splitRevision==="string"&&r.splitRevision.length<=128)&&
  (r.expectedBinding===undefined||typeof r.expectedBinding==="string"&&r.expectedBinding.length===64);
}
/** Private comparison token; NEVER include this in public reports or logs. */
export function d43R2QualityLocalBinding(input:Omit<Input,"expectedBinding">):string{
 return createHash("sha256").update(JSON.stringify([
  input.sourceText,input.splitCuts??[],input.uploadRevision??"",
  input.splitRevision??"",D43_R2_QUALITY_REVISION,EXPECTED_D4,EXPECTED_R1,
  EXPECTED_V2,LEGACY_DERIVATIVE_REFERENCE_MPS,LEGACY_DERIVATIVE_MAX_DT_S,
 ])).digest("hex");
}
export function inspectD43R2AltitudeQuality(input:unknown):D43R2Quality{
 if(!inputValid(input))return unavailable("INVALID_CONTEXT");
 if(!input.sourceText||input.sourceText.length>MAX_SOURCE_CHARS)
  return unavailable("SOURCE_LIMIT");
 if(D4_LINEAGE_REVISION!==EXPECTED_D4||D43_R1_REVISION!==EXPECTED_R1||
    GPS_V2_ALGORITHM_REVISION!==EXPECTED_V2)return unavailable("REVISION_MISMATCH");
 if(input.expectedBinding!==undefined&&
   d43R2QualityLocalBinding(input)!==input.expectedBinding)
  return unavailable("STALE_CONTEXT");
 const prior=inspectD43R1Coverage({
  sourceText:input.sourceText,splitCuts:input.splitCuts,
  uploadRevision:input.uploadRevision,splitRevision:input.splitRevision,
 });
 if(prior.status==="UNAVAILABLE")return unavailable(prior.reason);
 const lineage=inspectD4MultiGxLineage(input.sourceText);
 if(lineage.status==="UNAVAILABLE")return unavailable(lineage.reason);
 const c=prior.coverage;
 if(c.canonicalFixes!==lineage.canonicalFixCount||
    c.sourceBlocks!==lineage.blockCount||c.rawFixes!==lineage.rawFixCount)
  return unavailable("CANONICAL_SOURCE_MISMATCH");
 const points=parseKml(input.sourceText);
 if(points.length!==c.canonicalFixes)return unavailable("CANONICAL_SOURCE_MISMATCH");
 const reasons=new Map<number,readonly string[]>(
  c.issueEdges.map(e=>[e.beforeFix,e.reasons]),
 );
 const sourceOrSplit=new Set<number>([
  ...lineage.blockedEdges,...(input.splitCuts??[]),
 ]);
 let finite=0,zero=0,missing=0;
 for(const p of points){
  if(p.alt===null||!Number.isFinite(p.alt))missing++;
  else{finite++;if(p.alt===0)zero++;}
 }
 let positive=0,finitePairs=0,missingPairs=0,assessed=0,exceeded=0;
 let skippedOver15=0,invalidElapsed=0;
 for(let i=0;i<points.length-1;i++){
  // Never join provenance source edges, dedup-conflicts or manual splits.
  if(sourceOrSplit.has(i))continue;
  const t0=points[i].time?Date.parse(points[i].time):NaN;
  const t1=points[i+1].time?Date.parse(points[i+1].time):NaN;
  const dt=(t1-t0)/1000;
  if(!Number.isFinite(dt)||dt<=0){invalidElapsed++;continue;}
  positive++;
  const h0=points[i].alt,h1=points[i+1].alt;
  if(h0===null||h1===null||!Number.isFinite(h0)||!Number.isFinite(h1)){
   missingPairs++;continue;
  }
  finitePairs++;
  // R1 issue reasons are additive. No edge with ANY known quality issue
  // may be used to call a derivative reference comparison trustworthy.
  if((reasons.get(i)?.length??0)>0)continue;
  if(dt>LEGACY_DERIVATIVE_MAX_DT_S){
   skippedOver15++;continue;
  }
  assessed++;
  if(Math.abs(h1-h0)/dt>LEGACY_DERIVATIVE_REFERENCE_MPS)exceeded++;
 }
 const issueCounts=new Map<string,number>();
 for(const edge of c.issueEdges)
  for(const reason of edge.reasons)
   issueCounts.set(reason,(issueCounts.get(reason)??0)+1);
 return {
  revision:D43_R2_QUALITY_REVISION,
  status:"SOURCE_ALTITUDE_QUALITY_DIAGNOSTIC_ONLY",reason:null,
  sourceParserRevision:EXPECTED_D4,sourceCoverageRevision:EXPECTED_R1,
  horizontalReferenceRevision:EXPECTED_V2,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
  recencyEvidence:"UNAVAILABLE",canAffectCanonicalFlight:false,
  quality:{
   interpretation:"SOURCE_HEIGHT_ENDPOINTS_ONLY_INTERVENING_MOTION_UNKNOWN",
   sourceAltitudeDatum:"UNKNOWN",sourceAltitudeAccuracy:"UNKNOWN",
   sourceAltitudeAuthenticity:"UNKNOWN",
   sourceBlocks:c.sourceBlocks,canonicalFixes:c.canonicalFixes,
   finiteAltitudeFixes:finite,zeroAltitudeFixes:zero,nullAltitudeFixes:missing,
   adjacentPairs:Math.max(0,points.length-1),
   interveningMotionUnknownPairs:Math.max(0,points.length-1),
   uniqueIssueEdges:c.issueEdges.length,
   issueReasons:[...issueCounts].sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([reason,edges])=>({reason,edges})),
   sourceOrSplitBoundaries:sourceOrSplit.size,
   positiveWithinBoundaryTimePairs:positive,
   finiteHeightEndpointPairs:finitePairs,
   missingHeightEndpointPairs:missingPairs,
   referenceAssessedPairs:assessed,referenceExceedances:exceeded,
   referenceInterpretation:"GLOBAL_SOURCE_EDGE_COMPARISON_NOT_LEGACY_WINDOW_REJECTION",
   over15SecondsUnassessedPairs:skippedOver15,
   invalidOrZeroElapsedPairs:invalidElapsed,
   sourceCadenceMaxSeconds:c.sourceCadenceMaxSeconds,
   candidateAnalysis:"NOT_PERFORMED",unknownManeuvers:"UNAVAILABLE",
  },
 };
}
