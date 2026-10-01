import { serializeOptionalBilling } from "./billing.ts";
import { flightDateKey } from "./dashboard-math.ts";
import { allocatedFunctionTimes,defaultEngineType,durationMinutes,EASA_ROLES,ENGINE_TYPES,OPERATION_TYPES } from "./easa-logbook.ts";
import { manualFlightCandidate,type CandidateSemantic,type FlightDraftCandidate } from "./flight-draft-candidate.ts";
import { flightPurposeTask,normalizeFlightPurposeCodes,primaryFlightPurposeCode,stripFlightPurposeTasks } from "./flight-purpose.ts";
import { regulatoryAircraftCategory,type RegulatoryAircraftCategory } from "./flight-entry-profile.ts";
import { aircraftCategoryCapabilities,EASA_AIRCRAFT_PROFILE_CLASSES,REGULATORY_AIRCRAFT_CATEGORIES } from "./aircraft-category.ts";
import { normalizeProfessionalOperationContext,supportsProfessionalContext } from "./professional-context.ts";

export const EVIDENCE = ["ULL", "EASA"] as const;
export const CLASSES = ["ULL",...EASA_AIRCRAFT_PROFILE_CLASSES] as const;
export const ROLES = [...EASA_ROLES,"PAX","OBSERVER"] as const;
export const BILLING = ["BLOCK", "AIR"] as const;
export const REGULATORY_CATEGORIES=REGULATORY_AIRCRAFT_CATEGORIES;
export const LAUNCH_METHODS=["WINCH","AEROTOW","SELF_LAUNCH","CAR","BUNGEE","OTHER"] as const;
export const BALLOON_CLASSES=["HOT_AIR_BALLOON","GAS_BALLOON","HOT_AIR_AIRSHIP","MIXED_BALLOON"] as const;
export const BALLOON_GROUPS=["A","B","C","D"] as const;
export const BALLOON_OPERATIONS=["FREE","TETHERED"] as const;
export type BalloonClass=(typeof BALLOON_CLASSES)[number];
export type BalloonGroup=(typeof BALLOON_GROUPS)[number]|"";
export type BalloonOperation=(typeof BALLOON_OPERATIONS)[number]|"";
export type FlightInput={date:string;registration:string;aircraftType:string;aircraftClass:string;regulatoryCategory:RegulatoryAircraftCategory;balloonClass:string;balloonGroup:string;balloonOperation:string;launchMethod:string;launches:number;evidence:string;departure:string;arrival:string;offBlock:string;takeoff:string;landing:string;onBlock:string;starts:number;operationType:string;engineType:string;operatorName:string;flightNumber:string;operationContext:string;landingsDay:number;landingsNight:number;movementEvidenceRecorded:boolean;takeoffsDay:number;takeoffsNight:number;approachesDay:number;approachesNight:number;nightMinutes:number;ifrMinutes:number;picMinutes:number;copilotMinutes:number;dualMinutes:number;instructorMinutes:number;verificationName:string;verificationReference:string;commander:string;instructor:string;role:string;task:string;purposeCode:string;billingBasis:string;note:string};

function text(value:unknown,max:number){return String(value??"").trim().slice(0,max)}
function requiredOption<T extends readonly string[]>(value:string,values:T,label:string){if(!values.includes(value as T[number]))return{error:`Select a valid ${label}.`} as const;return{value:value as T[number]} as const}
function option<T extends readonly string[]>(value:string,values:T,fallback:T[number]){return values.includes(value as T[number])?value:fallback}
const counter=(value:unknown)=>Math.max(0,Math.min(99,Number.parseInt(text(value,2)||"0",10)||0));
const LEGACY_REFRESHER=/\bFCL[.]140[.]A\s+refresher\s+training\b\s*(?:[·|\-]\s*)?/i;

type ResolvedCandidateValue={value:unknown;error?:undefined}|{value?:undefined;error:string};

function candidateValue(value:unknown,label:string):ResolvedCandidateValue{
  if(value&&typeof value==="object"&&"state" in value){
    const semantic=value as {state?:unknown;value?:unknown;reason?:unknown};
    if(semantic.state==="unresolved")return{error:text(semantic.reason,300)||`${label} needs configuration.`};
    if(semantic.state==="provided")return{value:semantic.value};
  }
  return{value};
}

function semanticValue(value:CandidateSemantic,label:string):ResolvedCandidateValue{
  if(value.state==="unresolved")return{error:text(value.reason,300)||`${label} needs configuration.`};
  return{value:value.value};
}

/**
 * Source-agnostic flight semantic normalization.
 *
 * This function is intentionally pure: it accepts explicit candidate state,
 * performs no FormData/DB/account lookup, and returns only canonical flight
 * semantics or a domain error. Source adapters own extraction/provenance.
 */
export function normalizeFlightDraft(candidate:FlightDraftCandidate):{data?:FlightInput;error?:string}{
  const date=text(candidate.date,10);if(flightDateKey(date)!==date)return{error:"Enter a valid date."};
  const times=[text(candidate.offBlock,5),text(candidate.takeoff,5),text(candidate.landing,5),text(candidate.onBlock,5)];if(times.some(value=>value&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)))return{error:"Times must use HH:MM format."};
  const minute=(value:string)=>value?Number(value.slice(0,2))*60+Number(value.slice(3)):null,delta=(a:string,b:string)=>{const start=minute(a),end=minute(b);return start===null||end===null?null:(end-start+1440)%1440},block=delta(times[0],times[3]),air=delta(times[1],times[2]),taxiOut=delta(times[0],times[1]),taxiIn=delta(times[2],times[3]);if(block!==null&&block>18*60)return{error:"BLOCK time exceeds 18 hours. Check Off-block and On-block."};if(air!==null&&block!==null&&air>block+5)return{error:"AIR time cannot exceed BLOCK time. Check the time order."};if((taxiOut!==null&&taxiOut>180)||(taxiIn!==null&&taxiIn>180))return{error:"Taxi time exceeds 3 hours. Check Off-block, takeoff, landing and On-block."};

  const registration=text(candidate.registration,32).toUpperCase();if(!registration)return{error:"Select or enter an aircraft registration."};
  if(candidate.aircraftContext.state==="unresolved")return{error:text(candidate.aircraftContext.reason,300)||"Selected aircraft profile needs configuration."};
  const context=candidate.aircraftContext;
  const evidenceResult=requiredOption(text(context.evidence,8).toUpperCase(),EVIDENCE,"logbook");if("error" in evidenceResult)return evidenceResult;
  const classResult=requiredOption(text(context.aircraftClass,16).toUpperCase(),CLASSES,"aircraft class or category");if("error" in classResult)return classResult;
  const roleResult=requiredOption(text(candidate.role,24).toUpperCase(),ROLES,"pilot role");if("error" in roleResult)return roleResult;
  const billingResult=serializeOptionalBilling(candidate.billingBasis,candidate.billingShare);if(billingResult.error)return{error:billingResult.error};

  const evidence=evidenceResult.value,aircraftClass=classResult.value,role=roleResult.value,billingBasis=billingResult.value,requestedRegulatory=text(context.regulatoryCategory,16).toUpperCase(),regulatoryCategory=regulatoryAircraftCategory({regulatoryCategory:requestedRegulatory,aircraftClass,evidence});
  if(evidence==="ULL"&&regulatoryCategory!=="ULL")return{error:"ULL flights must use the ULL regulatory category."};
  if(aircraftClass==="GLIDER"&&regulatoryCategory!=="SAILPLANE")return{error:"A non-TMG glider must use the Sailplane / Part-SFCL regulatory category."};
  if(aircraftClass==="HELICOPTER"&&regulatoryCategory!=="HELICOPTER")return{error:"A helicopter must use the Helicopter / Part-FCL regulatory category."};
  if(aircraftClass==="BALLOON"&&regulatoryCategory!=="BALLOON")return{error:"A balloon must use the Balloon / Part-BFCL regulatory category."};
  if(["SEP","MEP","SET"].includes(aircraftClass)&&regulatoryCategory!=="AEROPLANE")return{error:"This aircraft class must use the Aeroplane / Part-FCL regulatory category."};
  if(aircraftClass==="TMG"&&!["AEROPLANE","SAILPLANE"].includes(regulatoryCategory))return{error:"Select whether this TMG flight belongs to the Part-FCL aeroplane or SPL sailplane context."};

  const capabilities=aircraftCategoryCapabilities({regulatoryCategory,aircraftClass,evidence});
  const balloonClassRaw=text(context.balloonClass,24).toUpperCase(),balloonGroupRaw=text(context.balloonGroup,1).toUpperCase(),balloonOperationRaw=text(candidate.balloonOperation,12).toUpperCase(),balloonClass=regulatoryCategory==="BALLOON"&&BALLOON_CLASSES.includes(balloonClassRaw as BalloonClass)?balloonClassRaw:"",balloonGroup=balloonClass==="HOT_AIR_BALLOON"&&BALLOON_GROUPS.includes(balloonGroupRaw as Exclude<BalloonGroup,"">)?balloonGroupRaw:"",balloonOperation=regulatoryCategory==="BALLOON"&&BALLOON_OPERATIONS.includes(balloonOperationRaw as Exclude<BalloonOperation,"">)?balloonOperationRaw:"";
  if(regulatoryCategory==="BALLOON"&&!balloonClass)return{error:"Select the balloon class used for this Part-BFCL flight."};
  if(balloonClass==="HOT_AIR_BALLOON"&&!balloonGroup)return{error:"Select hot-air balloon group A, B, C or D."};
  if(regulatoryCategory==="BALLOON"&&!balloonOperation)return{error:"Select whether this was a free or tethered balloon flight."};

  const legacyStarts=Math.max(0,Math.min(99,Number.parseInt(text(candidate.starts,2)||"0",10)||0)),hasLandings=candidate.hasStructuredLandings;
  let landingsDay=0,landingsNight=0;
  if(hasLandings){
    const day=candidateValue(candidate.landingsDay,"Day landing evidence"),night=candidateValue(candidate.landingsNight,"Night landing evidence");
    if(day.error)return{error:day.error};if(night.error)return{error:night.error};
    landingsDay=counter(day.value);landingsNight=counter(night.value);
  }

  const sailplaneLaunch=capabilities.movementEvidenceMode==="SFCL_LAUNCH",hasLaunches=candidate.hasLaunches;
  let launches=0,launchMethod="";
  if(sailplaneLaunch){
    const launchValue=candidateValue(candidate.launches,"Sailplane launch count"),methodValue=candidateValue(candidate.launchMethod,"Sailplane launch method");
    if(launchValue.error)return{error:launchValue.error};if(methodValue.error)return{error:methodValue.error};
    launches=hasLaunches?counter(launchValue.value):0;
    const launchRaw=text(methodValue.value,20).toUpperCase();launchMethod=LAUNCH_METHODS.includes(launchRaw as typeof LAUNCH_METHODS[number])?launchRaw:"";
    if(hasLaunches&&launches<1)return{error:"Enter at least one sailplane launch for this flight."};
    if(launches>0&&!launchMethod)return{error:"Select the launch method used for this sailplane flight."};
  }
  const starts=sailplaneLaunch?launches:hasLandings?landingsDay+landingsNight:legacyStarts;

  const instructor=text(candidate.instructor,100);
  const operationRaw=semanticValue(candidate.operationType,"Operation"),engineRaw=semanticValue(candidate.engineType,"Engine");
  if(operationRaw.error)return{error:operationRaw.error};if(engineRaw.error)return{error:engineRaw.error};
  const operationType=option(text(operationRaw.value,2).toUpperCase(),OPERATION_TYPES,"SP"),engineType=option(text(engineRaw.value,2).toUpperCase(),ENGINE_TYPES,defaultEngineType(aircraftClass)),professional=supportsProfessionalContext({evidence,regulatoryCategory}),operationContextRaw=text(candidate.operationContext,24).toUpperCase(),operationContext=professional?normalizeProfessionalOperationContext(operationContextRaw):"",operatorName=professional?text(candidate.operatorName,120):"",flightNumber=professional?text(candidate.flightNumber,40).toUpperCase():"";

  const nightRaw=candidateValue(candidate.nightTime,"Night time"),ifrRaw=candidateValue(candidate.ifrTime,"IFR time");
  if(nightRaw.error)return{error:nightRaw.error};if(ifrRaw.error)return{error:ifrRaw.error};
  const nightMinutes=durationMinutes(nightRaw.value),ifrMinutes=durationMinutes(ifrRaw.value),blockMinutes=block??0,airMinutes=air??0,creditedMinutes=["SAILPLANE","BALLOON"].includes(regulatoryCategory)?(airMinutes||blockMinutes):blockMinutes;
  if(operationContextRaw&&professional&&!operationContext)return{error:"Select a valid professional operation context."};if(block!==null&&(nightMinutes>blockMinutes||ifrMinutes>blockMinutes))return{error:"Night and IFR time cannot exceed BLOCK time."};

  const splTmg=capabilities.movementEvidenceMode==="SFCL_TMG",balloonFlight=capabilities.movementEvidenceMode==="BFCL_TAKEOFF_LANDING",partFclMovements=capabilities.supportsFcl060MovementEvidence;
  let movementEvidenceRecorded=false,takeoffsDay=0,takeoffsNight=0,approachesDay=0,approachesNight=0;
  if(partFclMovements){
    const movement=candidateValue(candidate.movementEvidenceRecorded,"Part-FCL movement evidence");if(movement.error)return{error:movement.error};
    movementEvidenceRecorded=String(movement.value??"")==="yes";
  }
  if(splTmg||balloonFlight||movementEvidenceRecorded){
    const day=candidateValue(candidate.takeoffsDay,"Day take-off evidence"),night=candidateValue(candidate.takeoffsNight,"Night take-off evidence");
    if(day.error)return{error:day.error};if(night.error)return{error:night.error};
    takeoffsDay=counter(day.value);takeoffsNight=counter(night.value);
  }
  if(movementEvidenceRecorded){
    const day=candidateValue(candidate.approachesDay,"Day approach evidence"),night=candidateValue(candidate.approachesNight,"Night approach evidence");
    if(day.error)return{error:day.error};if(night.error)return{error:night.error};
    approachesDay=counter(day.value);approachesNight=counter(night.value);
  }

  const verificationName=text(candidate.verificationName,160),verificationReference=text(candidate.verificationReference,160);if(evidence==="EASA"&&["SPIC","PICUS"].includes(role)&&(!verificationName||!verificationReference))return{error:"SPIC and PICUS entries require the supervising pilot's name and countersignature reference."};
  const allocation=allocatedFunctionTimes(role,creditedMinutes),rawTask=text(candidate.task,160),hasPurposeField=candidate.purposeSelectionPresent,selectedPurposes=normalizeFlightPurposeCodes(candidate.purposeCodes),legacyPurposes=!hasPurposeField&&role==="DUAL"&&LEGACY_REFRESHER.test(rawTask)?["LAPL_FCL140A_REFRESHER"] as const:[],allowedPurposes=role==="DUAL"?selectedPurposes:instructor?selectedPurposes.filter(code=>code==="AIRCRAFT_DIFFERENCES"||code==="AIRCRAFT_FAMILIARISATION"):[],purposes=allowedPurposes.length?allowedPurposes:legacyPurposes,purposeCode=primaryFlightPurposeCode(purposes),cleanTask=hasPurposeField?stripFlightPurposeTasks(rawTask):rawTask,purposeTask=flightPurposeTask(purposes),task=purposeTask?`${purposeTask}${cleanTask?` · ${cleanTask}`:""}`.slice(0,160):cleanTask;

  return{data:{date,registration,aircraftType:text(candidate.aircraftType,80),aircraftClass,regulatoryCategory,balloonClass,balloonGroup,balloonOperation,launchMethod,launches,evidence,departure:text(candidate.departure,16).toUpperCase(),arrival:text(candidate.arrival,16).toUpperCase(),offBlock:times[0],takeoff:times[1],landing:times[2],onBlock:times[3],starts,operationType,engineType,operatorName,flightNumber,operationContext,landingsDay:hasLandings?landingsDay:starts,landingsNight:hasLandings?landingsNight:0,movementEvidenceRecorded,takeoffsDay,takeoffsNight,approachesDay,approachesNight,nightMinutes,ifrMinutes,...allocation,verificationName,verificationReference,commander:text(candidate.commander,100),instructor,role,task,purposeCode,billingBasis,note:text(candidate.note,2000)}};
}

export function parseFlightInput(form:FormData):{data?:FlightInput;error?:string}{
  return normalizeFlightDraft(manualFlightCandidate(form));
}
