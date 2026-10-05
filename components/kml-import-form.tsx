"use client";

import { useActionState,useEffect,useMemo,useRef,useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { AircraftOption } from "@/lib/data/aircraft";
import type { AirportCandidate,AirportDetectionResult,AirportDetectionRequest,FlightActionState } from "@/app/(protected)/flights/actions";
import type { MapTrack,TrackPoint } from "@/lib/data/tracks";
import type { ImportReviewEvent } from "@/components/gps-import-review-player";
import { flightEnvelope,hasAirborneMovement,inspectTrackFile,landingCount,overview,splitPoints,suggestedSplitDetails,suggestedSplits,touchAndGoEvents,trackQuality,trackStats,type KmlPoint,type SplitSuggestion,type TrackFileFormat,type TrackQuality,type TrackSource } from "@/lib/track-processing";
import { trackTimeBasis,utcParts,type TrackTimeBasis } from "@/lib/track-time";
import { BILLING_SHARES,parseOptionalBilling } from "@/lib/billing";
import { useUnsavedFormGuard } from "@/components/use-unsaved-form-guard";
import { PendingActionButton } from "@/components/pending-action-button";
import { GPS_IMPORT_ROLES,gpsImportRequiresOperationEngine,gpsImportSourceRequirements,resolveGpsImportAircraftContext,type GpsImportSourceRequirements } from "@/lib/gps-import-integrity";
import { LAUNCH_METHODS } from "@/lib/flight-input";
import { ENGINE_TYPES,OPERATION_TYPES } from "@/lib/easa-logbook";
import { roleCrewSpec } from "@/lib/role-crew";
import type { ConnectedPicOption } from "@/lib/flight-connected-crew";
import { gpsLandingDayNightSuggestion,gpsNightMinutesSuggestion,gpsPfMovementDayNightSuggestion } from "@/lib/civil-twilight";
import type { NightDefinition } from "@/lib/night-definition";

const GpsImportReviewPlayer=dynamic(()=>import("@/components/gps-import-review-player").then(module=>module.GpsImportReviewPlayer),{ssr:false,loading:()=> <div className="track-map-loading">Loading visual GPS review…</div>});

type Action=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;
type AirportAction=(requests:AirportDetectionRequest[])=>Promise<AirportDetectionResult>;
type Analysis={name:string;points:KmlPoint[];suggested:number[];details:SplitSuggestion[];registration:string;timeBasis:TrackTimeBasis;format:TrackFileFormat;source:TrackSource;quality:TrackQuality};
type LandingSplitSource="UNSET"|"SUGGESTED"|"MANUAL";
type NightTimeSource="UNSET"|"SUGGESTED"|"MANUAL";
type Review={date:string;offBlock:string;takeoff:string;landing:string;onBlock:string;departure:string;arrival:string;starts:string;takeoffs:string;landingsDay:string;landingsNight:string;landingSplitSource:LandingSplitSource;pfMovement:""|"yes";takeoffsDay:string;takeoffsNight:string;approachesDay:string;approachesNight:string;launchMethod:string;launches:string;nightTime:string;nightTimeSource:NightTimeSource;ifrTime:string;note:string;reviewed:boolean};
type AirportOptions={departureCandidates:AirportCandidate[];arrivalCandidates:AirportCandidate[]};
type ImportBillingChoice=""|"BLOCK"|"AIR"|"INVALID";
type SafetyPilotMode="manual"|"connected";
type RoleCrewBuffer={role:(typeof GPS_IMPORT_ROLES)[number];instructor:string;commander:string;actualPicMode:SafetyPilotMode;connectedPicUserId:string};
type PartRoleCrewOverride={mode:"INHERIT"}|({mode:"OVERRIDE"}&RoleCrewBuffer);

const sourceLabel=(source:TrackSource)=>source==="adsbexchange"?"ADSBExchange":source==="flightradar24"?"Flightradar24":source==="skydemon"?"SkyDemon":"Generic GPS";
const regulatoryContextLabel=(value:string)=>({AEROPLANE:"Aeroplane · Part-FCL",SAILPLANE:"Sailplane · Part-SFCL",HELICOPTER:"Helicopter · Part-FCL",BALLOON:"Balloon · Part-BFCL",ULL:"ULL",OTHER:"Other"} as Record<string,string>)[value]||value;
const balloonClassLabel=(value:string)=>({HOT_AIR_BALLOON:"Hot-air balloon",GAS_BALLOON:"Gas balloon",HOT_AIR_AIRSHIP:"Hot-air airship",MIXED_BALLOON:"Mixed balloon"} as Record<string,string>)[value]||value;
const compactContextSummary=(parts:Array<string|undefined>)=>[...new Set(parts.filter((value):value is string=>Boolean(value)))].join(" · ");
function roleCrewBufferReady(buffer:RoleCrewBuffer,evidence:string,picConnections:ConnectedPicOption[]){
  const spec=roleCrewSpec(buffer.role,evidence);
  if(!spec)return false;
  if(spec.instructor==="required_save"&&!buffer.instructor.trim())return false;
  if(buffer.role!=="SAFETY PILOT")return true;
  if(buffer.actualPicMode==="manual")return spec.commander!=="external_resolver"||Boolean(buffer.commander.trim());
  const id=Number(buffer.connectedPicUserId);
  return Number.isSafeInteger(id)&&id>0&&picConnections.some(option=>option.id===id);
}
function roleCrewSummary(buffer:RoleCrewBuffer,picConnections:ConnectedPicOption[]){
  if(buffer.role==="DUAL")return `DUAL · ${buffer.instructor||"Instructor / PIC required"}`;
  if(buffer.role==="SAFETY PILOT"){
    const connected=picConnections.find(option=>String(option.id)===buffer.connectedPicUserId)?.name;
    return `SAFETY PILOT · ${buffer.actualPicMode==="connected"?(connected||"Accepted Connection required"):(buffer.commander||"Actual PIC required")}`;
  }
  return"PIC";
}

function inspect(source:string,name:string):Analysis{
  const inspection=inspectTrackFile(source,name),points=inspection.points;
  const registration=name.toUpperCase().replaceAll("_","-").match(/\bOK-?[A-Z]{3}\d{0,2}\b/)?.[0]?.replace(/^OK(?!-)/,"OK-")||"";
  return{name,points,suggested:suggestedSplits(points),details:suggestedSplitDetails(points),registration,timeBasis:trackTimeBasis(points),format:inspection.format,source:inspection.source,quality:inspection.quality};
}

function reviewFor(part:KmlPoint[]):Review{
  const envelope=flightEnvelope(part),stats=trackStats(part),fallbackStart=utcParts(stats.startUtc),off=utcParts(envelope.offBlockUtc),takeoff=utcParts(envelope.takeoffUtc),landing=utcParts(envelope.landingUtc),on=utcParts(envelope.onBlockUtc),movements=String(landingCount(part));
  return{date:off?.date||takeoff?.date||fallbackStart?.date||"",offBlock:off?.time||"",takeoff:takeoff?.time||"",landing:landing?.time||"",onBlock:on?.time||"",departure:"",arrival:"",starts:movements,takeoffs:movements,landingsDay:"",landingsNight:"",landingSplitSource:"UNSET",pfMovement:"",takeoffsDay:"",takeoffsNight:"",approachesDay:"",approachesNight:"",launchMethod:"",launches:"",nightTime:"",nightTimeSource:"UNSET",ifrTime:"",note:"",reviewed:false};
}
const durationText=(minutes:number)=>`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,"0")}`;

function mapTrack(part:KmlPoint[],index:number,registration:string,review?:Review,maxPoints=900):MapTrack{
  return{id:index,flightId:index,date:review?.date||"",registration,departure:review?.departure||"",arrival:review?.arrival||"",evidence:"",distanceKm:trackStats(part).distanceKm,points:overview(part,maxPoints).map(point=>({...point,alt:point.alt??undefined,time:point.time??undefined})) as TrackPoint[]};
}

function explicitCount(value:string){return /^\d{1,2}$/.test(value)&&Number(value)>=0&&Number(value)<=99}
function gpsSourceReviewReady(review:Review,requirements:GpsImportSourceRequirements){
  const starts=Number(review.starts);
  if(!Number.isInteger(starts)||starts<0||starts>99)return false;
  if(requirements.landingMode==="DAY_NIGHT"){
    if(!explicitCount(review.landingsDay)||!explicitCount(review.landingsNight)||Number(review.landingsDay)+Number(review.landingsNight)!==starts)return false;
  }else if(!explicitCount(review.landingsDay)||Number(review.landingsDay)!==starts)return false;
  if(requirements.movementMode==="SAILPLANE_LAUNCH"&&(!LAUNCH_METHODS.includes(review.launchMethod as (typeof LAUNCH_METHODS)[number])||!explicitCount(review.launches)||Number(review.launches)<1))return false;
  if(requirements.movementMode==="EXPLICIT_TAKEOFFS"){
    const takeoffs=Number(review.takeoffs);
    if(!Number.isInteger(takeoffs)||takeoffs<0||takeoffs>99||!explicitCount(review.takeoffsDay)||!explicitCount(review.takeoffsNight)||Number(review.takeoffsDay)+Number(review.takeoffsNight)!==takeoffs)return false;
  }
  if(requirements.movementMode==="FCL060_PF"&&review.pfMovement==="yes"&&![review.takeoffsDay,review.takeoffsNight,review.approachesDay,review.approachesNight].every(explicitCount))return false;
  return true;
}

function eventTime(point:KmlPoint|undefined){const stamp=utcParts(point?.time||null);return stamp?`${stamp.time} UTC`:"Detected on profile"}
function importReviewEvents(analysis:Analysis,cuts:number[]):ImportReviewEvent[]{
  const denominator=Math.max(1,analysis.points.length-1),boundaries=[0,...cuts.map(value=>value+1),analysis.points.length],events:ImportReviewEvent[]=[];
  cuts.forEach((cut,index)=>{const detail=analysis.details.find(item=>item.index===cut);events.push({position:Math.max(0,Math.min(1,(cut+.5)/denominator)),label:cuts.length>1?`Split ${index+1}`:"Split",kind:"split",detail:detail?.reason||eventTime(analysis.points[cut])})});
  for(let partIndex=0;partIndex<boundaries.length-1;partIndex++){
    const start=boundaries[partIndex],end=boundaries[partIndex+1],part=analysis.points.slice(start,end);if(part.length<2)continue;
    const envelope=flightEnvelope(part),prefix=boundaries.length>2?`F${partIndex+1} `:"",touches=touchAndGoEvents(part);
    events.push({position:(start+envelope.takeoffIndex)/denominator,label:`${prefix}Takeoff`,kind:"takeoff",detail:eventTime(part[envelope.takeoffIndex])});
    touches.forEach((touch,index)=>events.push({position:(start+touch.index)/denominator,label:`${prefix}T&G${touches.length>1?` ${index+1}`:""}`,kind:"touch-and-go",detail:`${eventTime(part[touch.index])} · ${touch.signal}`}));
    events.push({position:(start+envelope.landingIndex)/denominator,label:`${prefix}Landing`,kind:"landing",detail:eventTime(part[envelope.landingIndex])});
  }
  return events.sort((a,b)=>a.position-b.position);
}

function Submit({ready,hasTrack,onReview}:{ready:boolean;hasTrack:boolean;onReview:()=>void}){
  return ready?<PendingActionButton className="primary-button" pendingLabel="Saving reviewed flights…">Save reviewed flights</PendingActionButton>:<button type="button" className="primary-button" disabled={!hasTrack} onClick={onReview}>{hasTrack?"Review imported flights":"Upload track first"}</button>;
}

function AirportReviewField({label,name,value,candidates,onChange}:{label:string;name:string;value:string;candidates:AirportCandidate[];onChange:(value:string)=>void}){
  return <div className="airport-review-field">
    <label>{label}<input name={name} value={value} placeholder="LKPR" onChange={event=>onChange(event.target.value.toUpperCase())}/></label>
    {candidates.length?<div className="airport-candidate-list" aria-label={`${label} airport candidates`}>{candidates.map(candidate=><button type="button" key={`${name}-${candidate.ident}`} className={value===candidate.ident?"selected":""} onClick={()=>onChange(candidate.ident)} title={`${candidate.name||candidate.ident} · ${candidate.source}`}><b>{candidate.ident}</b><span>{candidate.distanceKm.toFixed(1)} km</span><small>{candidate.confidence}</small></button>)}</div>:null}
  </div>;
}

function SafetyPilotFields({namePrefix="",mode,commander,connectedPicUserId,picConnections,commanderRequired,onMode,onCommander,onConnected}:{namePrefix?:string;mode:SafetyPilotMode;commander:string;connectedPicUserId:string;picConnections:ConnectedPicOption[];commanderRequired:boolean;onMode:(mode:SafetyPilotMode)=>void;onCommander:(value:string)=>void;onConnected:(value:string)=>void}){
  return <>
    <label><span>Actual PIC source <span className="field-hint" aria-hidden="true">Required</span></span><select name={`${namePrefix}actualPicMode`} value={mode} onChange={event=>onMode(event.target.value as SafetyPilotMode)} required><option value="manual">Manual</option><option value="connected" disabled={!picConnections.length}>Accepted Connection</option></select><small>Choose explicit text or a currently accepted FlyTally Connection.</small></label>
    {mode==="manual"?<label><span>Actual PIC {commanderRequired?<span className="field-hint" aria-hidden="true">Required</span>:null}</span><input name={`${namePrefix}commander`} value={commander} onChange={event=>onCommander(event.target.value)} required={commanderRequired}/><small>No invitation is sent when this import is saved.</small></label>:<label><span>Connected Actual PIC <span className="field-hint" aria-hidden="true">Required</span></span><select name={`${namePrefix}connectedPicUserId`} value={connectedPicUserId} onChange={event=>onConnected(event.target.value)} required><option value="">Select accepted Connection</option>{picConnections.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select><small>The server rechecks the account ID and current Connection before saving.</small></label>}
  </>;
}

export function KmlImportForm({action,airportAction,aircraft,picConnections,nightDefinition}:{action:Action;airportAction:AirportAction;aircraft:AircraftOption[];picConnections:ConnectedPicOption[];nightDefinition:NightDefinition}){
  const [state,formAction]=useActionState(action,{}),[analysis,setAnalysis]=useState<Analysis|null>(null),[cuts,setCuts]=useState<number[]>([]),[reviews,setReviews]=useState<Review[]>([]),[roleCrewOverrides,setRoleCrewOverrides]=useState<PartRoleCrewOverride[]>([]),[overrideResetNotice,setOverrideResetNotice]=useState(""),[registration,setRegistration]=useState(""),[regulatoryCategory,setRegulatoryCategory]=useState(""),[role,setRole]=useState<(typeof GPS_IMPORT_ROLES)[number]>("PIC"),[commonInstructor,setCommonInstructor]=useState(""),[commonCommander,setCommonCommander]=useState(""),[commonActualPicMode,setCommonActualPicMode]=useState<SafetyPilotMode>("manual"),[commonConnectedPicUserId,setCommonConnectedPicUserId]=useState(""),[billing,setBilling]=useState<ImportBillingChoice>(""),[billingShare,setBillingShare]=useState(1),[balloonOperation,setBalloonOperation]=useState(""),[operationType,setOperationType]=useState(""),[engineType,setEngineType]=useState(""),[airportCount,setAirportCount]=useState<number|null>(null),[airportOptions,setAirportOptions]=useState<AirportOptions[]>([]),[detecting,setDetecting]=useState(false);
  const{dirty,markDirty,beginSubmit}=useUnsavedFormGuard(),errorRef=useRef<HTMLParagraphElement>(null);
  const parts=useMemo(()=>analysis?splitPoints(analysis.points,cuts):[],[analysis,cuts]);
  const visualTrack=useMemo(()=>analysis?mapTrack(analysis.points,-1,registration,undefined,1800):null,[analysis,registration]);
  const visualEvents=useMemo(()=>analysis?importReviewEvents(analysis,cuts):[],[analysis,cuts]);

  const resetParts=(next:number[],source=analysis)=>{
    if(!source)return;
    markDirty();
    const clean=[...new Set(next)].filter(value=>Number.isSafeInteger(value)&&value>0&&value<source.points.length-1).sort((a,b)=>a-b).slice(0,19),sameSource=source===analysis,splitChanged=!sameSource||clean.join(",")!==cuts.join(",");
    if(splitChanged){
      if(sameSource&&roleCrewOverrides.some(item=>item.mode==="OVERRIDE"))setOverrideResetNotice("Role/Crew overrides were reset because the flight split changed. Review the affected flights again.");
      else if(!sameSource)setOverrideResetNotice("");
      setRoleCrewOverrides(splitPoints(source.points,clean).map(()=>({mode:"INHERIT"})));
    }
    setCuts(clean);setReviews(splitPoints(source.points,clean).map(reviewFor));setAirportOptions([]);setAirportCount(null);
  };
  const updateReview=(index:number,patch:Partial<Review>)=>{markDirty();setReviews(current=>current.map((review,i)=>i===index?{...review,...patch}:review))};
  const updateLandingTotal=(index:number,value:string)=>{markDirty();setReviews(current=>current.map((review,i)=>i!==index?review:review.landingSplitSource==="SUGGESTED"?{...review,starts:value,landingsDay:"",landingsNight:"",landingSplitSource:"UNSET",pfMovement:"",takeoffsDay:"",takeoffsNight:"",approachesDay:"",approachesNight:"",reviewed:false}:{...review,starts:value,pfMovement:"",takeoffsDay:"",takeoffsNight:"",approachesDay:"",approachesNight:"",reviewed:false}))};
  const updateLandingSplit=(index:number,field:"landingsDay"|"landingsNight",value:string)=>{markDirty();setReviews(current=>current.map((review,i)=>i===index?{...review,[field]:value,landingSplitSource:"MANUAL",reviewed:false}:review))};
  const updateRoleCrewOverride=(index:number,next:PartRoleCrewOverride)=>{markDirty();setOverrideResetNotice("");setRoleCrewOverrides(current=>current.map((item,i)=>i===index?next:item))};

  useEffect(()=>{
    if(!analysis||!parts.length)return;
    let cancelled=false;
    const timer=setTimeout(async()=>{
      setDetecting(true);
      try{
        const requests=parts.map(part=>{const envelope=flightEnvelope(part);return{departureCandidates:envelope.departureCandidates.map(({lat,lon})=>({lat,lon})),arrivalCandidates:envelope.arrivalCandidates.map(({lat,lon})=>({lat,lon}))}});
        const result=await airportAction(requests);
        if(cancelled)return;
        setAirportCount(result.airportCount);
        setAirportOptions(result.parts.map(item=>({departureCandidates:item.departureCandidates,arrivalCandidates:item.arrivalCandidates})));
        setReviews(current=>current.map((review,index)=>({...review,departure:review.departure||result.parts[index]?.departure?.ident||"",arrival:review.arrival||result.parts[index]?.arrival?.ident||""})));
      }catch{
        if(!cancelled){setAirportCount(-1);setAirportOptions([])}
      }finally{
        if(!cancelled)setDetecting(false);
      }
    },450);
    return()=>{cancelled=true;clearTimeout(timer)};
  },[analysis,cuts,airportAction]);

  const selectedAircraft=aircraft.find(item=>item.registration===registration),profileResolution=selectedAircraft?resolveGpsImportAircraftContext({aircraft_type:selectedAircraft.aircraft_type,aircraft_make:selectedAircraft.aircraft_make,aircraft_model:selectedAircraft.aircraft_model,evidence:selectedAircraft.evidence,aircraft_class:selectedAircraft.aircraft_class,regulatory_category:selectedAircraft.regulatory_category,balloon_class:selectedAircraft.balloon_class,balloon_group:selectedAircraft.balloon_group,part_fcl_credit_class:selectedAircraft.part_fcl_credit_class,part_fcl_credit_basis:selectedAircraft.part_fcl_credit_basis,part_fcl_credit_from:selectedAircraft.part_fcl_credit_from}):null,allowedContexts=profileResolution?.contexts??[],selectedContext=allowedContexts.find(context=>context.regulatoryCategory===(regulatoryCategory||profileResolution?.profile?.regulatoryCategory))??allowedContexts[0],selectedProfile=profileResolution?.profile&&selectedContext?{...profileResolution.profile,regulatoryCategory:selectedContext.regulatoryCategory}:undefined,profileError=selectedAircraft&&!selectedProfile?(profileResolution?.error||"Aircraft profile needs configuration before GPS import."):"",balloonContextDetail=selectedContext?.aircraftClass==="BALLOON"?[selectedContext.balloonClass?balloonClassLabel(selectedContext.balloonClass):"",selectedContext.balloonGroup?`Group ${selectedContext.balloonGroup}`:""].filter(Boolean).join(" · "):"",aircraftContextSummary=selectedProfile&&selectedContext?compactContextSummary([selectedProfile.evidence,regulatoryContextLabel(selectedContext.regulatoryCategory),selectedProfile.aircraftClass,balloonContextDetail,selectedContext.aircraftType]):profileError?"Needs configuration":"Select aircraft",selectedBalloon=selectedProfile?.regulatoryCategory==="BALLOON",requiresOperationEngine=selectedProfile?gpsImportRequiresOperationEngine(selectedProfile):false,sourceRequirements=selectedProfile?gpsImportSourceRequirements(selectedProfile):null;
  const commonCrewSpec=selectedProfile?roleCrewSpec(role,selectedProfile.evidence):null,commonInstructorRequired=commonCrewSpec?.instructor==="required_save",commonRoleCrewBuffer:RoleCrewBuffer={role,instructor:commonInstructor,commander:commonCommander,actualPicMode:commonActualPicMode,connectedPicUserId:commonConnectedPicUserId},commonRoleCrewReady=Boolean(selectedProfile)&&roleCrewBufferReady(commonRoleCrewBuffer,selectedProfile!.evidence,picConnections),overridesReady=Boolean(selectedProfile)&&roleCrewOverrides.length===parts.length&&roleCrewOverrides.every(item=>item.mode==="INHERIT"||roleCrewBufferReady(item,selectedProfile!.evidence,picConnections));
  useEffect(()=>{const parsed=parseOptionalBilling(selectedAircraft?.billing_basis),rawOperation=String(selectedAircraft?.default_operation_type??"").trim().toUpperCase(),defaultOperation=OPERATION_TYPES.includes(rawOperation as (typeof OPERATION_TYPES)[number])?rawOperation:"",rawEngine=String(selectedAircraft?.default_engine_type??"").trim().toUpperCase(),defaultEngine=ENGINE_TYPES.includes(rawEngine as (typeof ENGINE_TYPES)[number])?rawEngine:"";setBilling(parsed.error?"INVALID":parsed.settings?.basis||"");setBillingShare(parsed.settings?.share||1);setRegulatoryCategory(selectedAircraft?.regulatory_category||"");setOperationType(defaultOperation);setEngineType(defaultEngine);setReviews(current=>current.map(review=>({...review,landingsDay:"",landingsNight:"",landingSplitSource:"UNSET",pfMovement:"",takeoffsDay:"",takeoffsNight:"",approachesDay:"",approachesNight:"",launchMethod:"",launches:"",nightTime:"",nightTimeSource:"UNSET",ifrTime:"",reviewed:false})))},[registration,selectedAircraft?.billing_basis,selectedAircraft?.regulatory_category,selectedAircraft?.default_operation_type,selectedAircraft?.default_engine_type]);
  const seraLandingSuggestionEnabled=nightDefinition==="SERA"&&sourceRequirements?.landingMode==="DAY_NIGHT",seraNightTimeSuggestionEnabled=nightDefinition==="SERA"&&sourceRequirements?.reviewNightIfr===true;
  useEffect(()=>{
    setReviews(current=>current.map((review,index)=>{
      if(review.landingSplitSource==="MANUAL")return review;
      if(!seraLandingSuggestionEnabled){
        return review.landingSplitSource==="SUGGESTED"?{...review,landingsDay:"",landingsNight:"",landingSplitSource:"UNSET",reviewed:false}:review;
      }
      if(review.landingSplitSource!=="UNSET"||review.landingsDay||review.landingsNight)return review;
      const suggestion=gpsLandingDayNightSuggestion(parts[index]??[]);
      if(suggestion.status!=="AVAILABLE"||Number(review.starts)!==suggestion.total)return review;
      return{...review,landingsDay:String(suggestion.day),landingsNight:String(suggestion.night),landingSplitSource:"SUGGESTED",reviewed:false};
    }));
  },[analysis,cuts,registration,nightDefinition,selectedProfile?.evidence,sourceRequirements?.landingMode,seraLandingSuggestionEnabled,parts]);
  useEffect(()=>{
    setReviews(current=>current.map((review,index)=>{
      if(review.nightTimeSource==="MANUAL")return review;
      if(!seraNightTimeSuggestionEnabled){
        return review.nightTimeSource==="SUGGESTED"?{...review,nightTime:"",nightTimeSource:"UNSET",reviewed:false}:review;
      }
      if(review.nightTimeSource!=="UNSET"||review.nightTime)return review;
      const suggestion=gpsNightMinutesSuggestion(parts[index]??[]);
      return suggestion.status==="AVAILABLE"?{...review,nightTime:durationText(suggestion.minutes),nightTimeSource:"SUGGESTED",reviewed:false}:review;
    }));
  },[analysis,cuts,registration,nightDefinition,sourceRequirements?.reviewNightIfr,seraNightTimeSuggestionEnabled,parts]);
  const ready=Boolean(selectedProfile&&sourceRequirements)&&parts.length>0&&billing!=="INVALID"&&commonRoleCrewReady&&overridesReady&&(!requiresOperationEngine||(operationType!==""&&engineType!==""))&&parts.every(hasAirborneMovement)&&reviews.length===parts.length&&reviews.every(review=>review.reviewed&&review.date&&gpsSourceReviewReady(review,sourceRequirements!))&&(!selectedBalloon||["FREE","TETHERED"].includes(balloonOperation));
  const reviewedCount=reviews.filter(review=>review.reviewed).length,gpsReviewNeedsAttention=Boolean(analysis&&(analysis.quality.status!=="good"||analysis.timeBasis==="ambiguous"||parts.length>1)),flightContextNeedsAttention=Boolean(!selectedProfile||profileError||billing==="INVALID"||(requiresOperationEngine&&(!operationType||!engineType))||!commonRoleCrewReady||(selectedBalloon&&!balloonOperation)),flightContextSummary=selectedProfile?compactContextSummary([registration,aircraftContextSummary,role,requiresOperationEngine?operationType:"",requiresOperationEngine?engineType:"",billing&&billing!=="INVALID"?`Billing ${billing}`:""]):"Select aircraft and flight context";
  const addCut=()=>{if(!analysis||parts.length>=20)return;const boundaries=[0,...cuts.map(value=>value+1),analysis.points.length],segments=boundaries.slice(0,-1).map((start,index)=>({start,end:boundaries[index+1]-1})),largest=segments.sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];if(largest.end-largest.start<6)return;resetParts([...cuts,Math.floor((largest.start+largest.end)/2)])};

  const reviewImported=()=>{const target=document.querySelector<HTMLElement>(".flight-review-card:not(.confirmed)")||document.querySelector<HTMLElement>(".flight-review-card");target?.scrollIntoView({behavior:"smooth",block:"start"});target?.focus({preventScroll:true})};
  useEffect(()=>{if(state.error){markDirty();errorRef.current?.focus()}},[state.error,markDirty]);
  return <form action={formAction} className="flight-form kml-wizard" onChangeCapture={markDirty} onSubmitCapture={beginSubmit}>
    <div className="section-heading"><div><p className="eyebrow">GPS SOURCE</p><h2>Upload track</h2><p className="muted">Upload one KML, GPX or CSV track. FlyTally will suggest the flight structure and evidence for review.</p></div></div>
    <div className="upload-zone">
      <label><span>KML, GPX or CSV <span className="field-hint" aria-hidden="true">Required</span></span><input name="kml" type="file" accept=".kml,.gpx,.csv,application/vnd.google-earth.kml+xml,application/xml,text/xml,text/csv" required onChange={async event=>{const file=event.target.files?.[0];if(!file){setAnalysis(null);setReviews([]);setRoleCrewOverrides([]);setOverrideResetNotice("");return}const next=inspect(await file.text(),file.name);setAnalysis(next);const suggestedRegistration=next.registration&&aircraft.some(item=>item.registration===next.registration)?next.registration:"";setRegistration(suggestedRegistration);setRegulatoryCategory("");setBalloonOperation("");setOperationType("");setEngineType("");resetParts(next.suggested,next)}}/></label>
      {analysis?<p>{analysis.points.length>=2?"✓":"⚠"} {analysis.name} · {analysis.points.length} GPS points · {analysis.format.toUpperCase()} · {sourceLabel(analysis.source)} · {analysis.suggested.length+1} suggested {analysis.suggested.length?"flights":"flight"} · {analysis.timeBasis==="utc"?"UTC timestamps":analysis.timeBasis==="offset"?"offset timestamps → UTC":"timezone not explicit"}</p>:null}
    </div>
    {analysis&&analysis.quality.status!=="good"?<p className="track-time-warning"><b>GPS track needs review.</b> {analysis.quality.warnings.join(" ")}</p>:analysis?<p className="field-hint">GPS track quality: good · {Math.round(analysis.quality.timestampCoverage*100)}% timestamp coverage.</p>:null}
    {analysis&&analysis.timeBasis==="ambiguous"?<p className="track-time-warning"><b>Time zone is missing in this track.</b> FlyTally will not guess from the iPad or computer clock. Review and enter UTC times manually before saving.</p>:null}

    {analysis&&analysis.points.length>=2?<>
      <details className="entry-section gps-track-review" open={gpsReviewNeedsAttention}>
        <summary><span>Review GPS track</span><small>{gpsReviewNeedsAttention?parts.length>1?`${parts.length} flights detected`:"Needs review":"Optional visual review"}</small></summary>
        <div className="entry-section-body">
          {parts.length===1&&!cuts.length?<div className="field-actions"><button type="button" className="secondary-button" onClick={addCut}>Split into multiple flights</button></div>:<section className="split-editor">
            <div className="split-toolbar"><button type="button" className="secondary-button" onClick={()=>resetParts(analysis.suggested)}>Reset suggestion</button><button type="button" className="secondary-button" onClick={()=>resetParts([])}>Single flight</button><button type="button" className="secondary-button" onClick={addCut} disabled={parts.length>=20}>＋ Add split</button></div>
            {cuts.length?cuts.map((cut,index)=>{const stamp=utcParts(analysis.points[cut]?.time||null),detail=analysis.details.find(item=>item.index===cut);return <div className="split-row" key={`${index}-${cut}`}><label>Split {index+1}<input type="range" min="2" max={Math.max(2,analysis.points.length-3)} value={cut} onChange={event=>resetParts(cuts.map((value,i)=>i===index?Number(event.target.value):value))}/></label><div className="split-explanation"><strong>{stamp?`${stamp.date} ${stamp.time} UTC`:"Position on track"}</strong><small>{detail?.reason||"Manual split point — verify both resulting flights."}</small></div><button type="button" className="icon-danger" onClick={()=>resetParts(cuts.filter((_,i)=>i!==index))}>Delete</button></div>}):null}
          </section>}
          {overrideResetNotice?<p className="track-time-warning" role="status">{overrideResetNotice}</p>:null}
          {visualTrack?<section className="import-player-review"><div className="section-heading"><div><p className="eyebrow">GPS REVIEW</p><h2>Detected flight</h2><p className="muted">Takeoff, landing, touch-and-go and split detections are marked on the altitude/speed profile.</p></div></div><GpsImportReviewPlayer track={visualTrack} events={visualEvents}/><p className="import-player-note">Use this view when the automatic interpretation needs checking. Edit the final flight fields below whenever the track evidence is not sufficient.</p></section>:null}
        </div>
      </details>
      <input type="hidden" name="splitIndices" value={cuts.join(",")}/><input type="hidden" name="partCount" value={parts.length}/>

      <details className="entry-section gps-flight-context" open={flightContextNeedsAttention}>
        <summary><span>Flight context</span><small className={flightContextNeedsAttention?"field-message-error":"profile-summary"}>{flightContextNeedsAttention?"Needs attention":flightContextSummary}</small></summary>
        <div className="entry-section-body">
      <div className="form-grid secondary-entry-grid">
        <label><span>Registration <span className="field-hint" aria-hidden="true">Required</span></span><select name="registration" required value={registration} onChange={event=>{setRegistration(event.target.value);setRegulatoryCategory("");setBalloonOperation("");setOperationType("");setEngineType("")}}><option value="">Select</option>{aircraft.map(item=><option key={item.registration}>{item.registration}</option>)}</select>{analysis.registration?<small>Suggested: {analysis.registration}</small>:null}</label>
        <input type="hidden" name="aircraftType" value={selectedContext?.aircraftType||selectedAircraft?.aircraft_type||""}/>
        <input type="hidden" name="aircraftClass" value={selectedProfile?.aircraftClass||""}/>
        <input type="hidden" name="evidence" value={selectedProfile?.evidence||""}/>
        {allowedContexts.length>1?<label><span>Regulatory context <span className="field-hint" aria-hidden="true">Required</span></span><select name="regulatoryCategory" value={selectedContext?.regulatoryCategory||""} onChange={event=>{setRegulatoryCategory(event.target.value);setBalloonOperation("");setOperationType("");setEngineType("");setReviews(current=>current.map(review=>({...review,reviewed:false})))}} required>{allowedContexts.map(context=><option key={context.regulatoryCategory} value={context.regulatoryCategory}>{regulatoryContextLabel(context.regulatoryCategory)}</option>)}</select><small>This is the only aircraft-context choice and applies to every flight in this import session.</small></label>:<input type="hidden" name="regulatoryCategory" value={selectedContext?.regulatoryCategory||""}/>}
        <input type="hidden" name="balloonClass" value={selectedContext?.balloonClass||""}/><input type="hidden" name="balloonGroup" value={selectedContext?.balloonGroup||""}/>
        <div className={`aircraft-context-card wide ${profileError?"needs-configuration":""}`} data-aircraft-context-card tabIndex={-1}><div><strong>{profileError?"Needs configuration":"Profile context"}</strong><span>{aircraftContextSummary}</span></div>{profileError?<small>{profileError} <Link href="/database" target="_blank" rel="noreferrer" data-aircraft-config-link>Open Aircraft without losing this import</Link>.</small>:<small>Logbook, class and aircraft type come from the selected profile and are validated again by the server.</small>}</div>
        <label><span>Role <span className="field-hint" aria-hidden="true">Required</span></span><select name="role" value={role} onChange={event=>{setRole(event.target.value as (typeof GPS_IMPORT_ROLES)[number]);setReviews(current=>current.map((review,index)=>roleCrewOverrides[index]?.mode==="OVERRIDE"?review:{...review,reviewed:false}))}} required>{GPS_IMPORT_ROLES.map(value=><option key={value} value={value}>{value}</option>)}</select><small>This common role applies to every flight unless that flight uses a complete Role/Crew override.</small></label>
        {role==="DUAL"?<label><span>Instructor / PIC {commonInstructorRequired?<span className="field-hint" aria-hidden="true">Required</span>:null}</span><input name="instructor" value={commonInstructor} onChange={event=>setCommonInstructor(event.target.value)} required={commonInstructorRequired}/><small>{commonInstructorRequired?"Required for EASA DUAL save.":"Instructor / PIC for this common DUAL context."}</small></label>:<input type="hidden" name="instructor" value=""/>}
        {role==="SAFETY PILOT"?<SafetyPilotFields mode={commonActualPicMode} commander={commonCommander} connectedPicUserId={commonConnectedPicUserId} picConnections={picConnections} commanderRequired={commonCrewSpec?.commander==="external_resolver"} onMode={mode=>setCommonActualPicMode(mode)} onCommander={setCommonCommander} onConnected={setCommonConnectedPicUserId}/>:<input type="hidden" name="commander" value=""/>}
        <input type="hidden" name="verificationName" value=""/><input type="hidden" name="verificationReference" value=""/>
        {requiresOperationEngine?<>
          <label><span>Operation <span className="field-hint" aria-hidden="true">Required</span></span><select name="operationType" value={operationType} onChange={event=>setOperationType(event.target.value)} required><option value="">Select SP / MP</option><option value="SP">SP · single-pilot</option><option value="MP">MP · multi-pilot</option></select><small>{selectedAircraft?.default_operation_type&&operationType===selectedAircraft.default_operation_type?"Aircraft default · confirm or change for this flight.":"GPS cannot determine crew operation."}</small></label>
          <label><span>Engine <span className="field-hint" aria-hidden="true">Required</span></span><select name="engineType" value={engineType} onChange={event=>setEngineType(event.target.value)} required><option value="">Select SE / ME</option><option value="SE">SE · single-engine</option><option value="ME">ME · multi-engine</option></select><small>Choose the configuration actually used for this flight.</small></label>
        </>:<><input type="hidden" name="operationType" value=""/><input type="hidden" name="engineType" value=""/></>}
        <label>Billing time<select name="billingBasis" value={billing} onChange={event=>setBilling(event.target.value as ImportBillingChoice)}>{billing==="INVALID"?<option value="INVALID" disabled>Needs configuration</option>:null}<option value="">Not tracked</option><option>BLOCK</option><option>AIR</option></select><small className={billing==="INVALID"?"field-message-error":undefined}>{billing==="INVALID"?"Stored aircraft billing is invalid. Choose Not tracked, BLOCK or AIR.":"Optional aircraft-cost tracking."}</small></label>
        <label>Cost share<select name="billingShare" value={billingShare} onChange={event=>setBillingShare(Number(event.target.value))} disabled={billing===""||billing==="INVALID"}>{BILLING_SHARES.map(value=><option key={value} value={value}>{value===1?"1/1 · full price":`1/${value}`}</option>)}</select></label>
        {selectedBalloon?<label><span>Balloon operation <span className="field-hint" aria-hidden="true">Required</span></span><select name="balloonOperation" value={balloonOperation} onChange={event=>setBalloonOperation(event.target.value)} required><option value="">Select free / tethered</option><option value="FREE">Free flight</option><option value="TETHERED">Tethered flight</option></select><small>Required BFCL evidence. GPS cannot determine whether the operation was free or tethered.</small></label>:<input type="hidden" name="balloonOperation" value=""/>}
        <input type="hidden" name="task" value=""/>
      </div>

          <p className="value-origin-note"><span>Source</span> GPS supplies advisory times and movement suggestions. Aircraft context comes from the selected profile and remains server-validated.</p>
        </div>
      </details>
      <div className="section-heading"><div><p className="eyebrow">FLIGHT DETAILS</p><h2>{parts.length===1?"Review flight":`Review ${parts.length} flights`}</h2><p className="muted">{detecting?"Detecting airports…":airportCount===0?"Airport catalogue is empty.":airportCount===-1?"Airport detection unavailable.":"Check the final logbook values below."}</p></div></div>
      <div className="flight-review-list">{parts.map((part,index)=>{
        const review=reviews[index]||reviewFor(part),roleCrewOverride=roleCrewOverrides[index]??({mode:"INHERIT"} as PartRoleCrewOverride),resolvedBuffer:RoleCrewBuffer=roleCrewOverride.mode==="OVERRIDE"?roleCrewOverride:commonRoleCrewBuffer,resolvedRole=resolvedBuffer.role,overrideSpec=selectedProfile?roleCrewSpec(resolvedRole,selectedProfile.evidence):null,overrideInstructorRequired=overrideSpec?.instructor==="required_save",stats=trackStats(part),detected=flightEnvelope(part),touches=touchAndGoEvents(part),detectedLandings=1+touches.length,credible=hasAirborneMovement(part),quality=trackQuality(part),options=airportOptions[index]||{departureCandidates:[],arrivalCandidates:[]},sourceReady=sourceRequirements?gpsSourceReviewReady(review,sourceRequirements):false,landingSuggestion=seraLandingSuggestionEnabled?gpsLandingDayNightSuggestion(part):null,pfSuggestion=nightDefinition==="SERA"?gpsPfMovementDayNightSuggestion(part):null,landingHelpId=`part-${index}-landing-suggestion`,landingTotalMatchesSuggestion=landingSuggestion?.status==="AVAILABLE"&&Number(review.starts)===landingSuggestion.total;
        return <article className={`flight-review-card ${review.reviewed?"confirmed":""}${credible?"":" invalid-flight"}`} key={`${cuts.join("-")}-${index}`} tabIndex={-1}>
          <header><div><span>FLIGHT {index+1} OF {parts.length}</span><h2>{review.departure||"?"} → {review.arrival||"?"}</h2><p>{stats.pointCount} points · {stats.distanceKm.toFixed(1)} km · {detectedLandings} {detectedLandings===1?"landing":"landings"} · GPS {quality.status.toUpperCase()}</p></div><div className="review-status">{review.reviewed?"✓ reviewed":"review required"}</div></header>
          {!credible?<p className="ground-flight-warning">This section contains no credible flight movement. Adjust or remove the split.</p>:quality.status!=="good"?<p className="track-time-warning"><b>Check this GPS section.</b> {quality.warnings.join(" ")}</p>:null}
          <input type="hidden" name={`part_${index}_roleCrew_mode`} value={roleCrewOverride.mode}/>
          <p className="value-origin-note"><span>{roleCrewOverride.mode==="OVERRIDE"?"Flight Role/Crew override":"Common Role/Crew"}</span> {roleCrewSummary(resolvedBuffer,picConnections)}</p>
          {roleCrewOverride.mode==="INHERIT"?<div className="field-actions"><button type="button" className="secondary-button" onClick={()=>updateRoleCrewOverride(index,{mode:"OVERRIDE",...commonRoleCrewBuffer})}>Override Role/Crew</button></div>:<div className="form-grid review-grid"><label><span>Role override <span className="field-hint" aria-hidden="true">Required</span></span><select name={`part_${index}_roleCrew_role`} value={roleCrewOverride.role} onChange={event=>{const nextRole=event.target.value as (typeof GPS_IMPORT_ROLES)[number];updateRoleCrewOverride(index,{...roleCrewOverride,role:nextRole});updateReview(index,{reviewed:false})}} required>{GPS_IMPORT_ROLES.map(value=><option key={value} value={value}>{value}</option>)}</select><small>This complete override applies only to flight {index+1}.</small></label>{roleCrewOverride.role==="DUAL"?<label><span>Instructor / PIC {overrideInstructorRequired?<span className="field-hint" aria-hidden="true">Required</span>:null}</span><input name={`part_${index}_roleCrew_instructor`} value={roleCrewOverride.instructor} onChange={event=>updateRoleCrewOverride(index,{...roleCrewOverride,instructor:event.target.value})} required={overrideInstructorRequired}/><small>{overrideInstructorRequired?"Required for this EASA DUAL override.":"Instructor / PIC for this DUAL override."}</small></label>:roleCrewOverride.role==="SAFETY PILOT"?<SafetyPilotFields namePrefix={`part_${index}_roleCrew_`} mode={roleCrewOverride.actualPicMode} commander={roleCrewOverride.commander} connectedPicUserId={roleCrewOverride.connectedPicUserId} picConnections={picConnections} commanderRequired={overrideSpec?.commander==="external_resolver"} onMode={mode=>updateRoleCrewOverride(index,{...roleCrewOverride,actualPicMode:mode})} onCommander={value=>updateRoleCrewOverride(index,{...roleCrewOverride,commander:value})} onConnected={value=>updateRoleCrewOverride(index,{...roleCrewOverride,connectedPicUserId:value})}/>:null}<div className="field-actions wide"><button type="button" className="secondary-button" onClick={()=>{updateRoleCrewOverride(index,{mode:"INHERIT"});updateReview(index,{reviewed:false})}}>Reset to common</button></div></div>}
          <div className="kml-time-row"><span className="utc-chip">UTC</span><small className="field-hint">FCL.050 logbook times are reviewed and stored in UTC.</small></div>
          <div className={`touch-review ${touches.length?"detected":"clear"}`}>
            <div><strong>{touches.length?`${touches.length} touch-and-go ${touches.length===1?"event":"events"} detected`:"No touch-and-go detected"}</strong><small>Landings were prefilled to {detectedLandings}. Confirm or edit the value below before reviewing this flight.</small></div>
            {touches.length?<div className="touch-event-list">{touches.map((event,eventIndex)=>{const stamp=utcParts(event.time);return <span key={`${event.index}-${eventIndex}`} title={`${event.confidence} confidence · ${event.signal} profile`}><b>T&amp;G {eventIndex+1}</b>{stamp?`${stamp.time} UTC`:"Detected on profile"}<small>{event.signal}</small></span>})}</div>:null}
          </div>
          <div className="form-grid review-grid">
            <label><span>Date <span className="field-hint" aria-hidden="true">Required</span></span><input name={`part_${index}_date`} type="date" required value={review.date} onChange={event=>updateReview(index,{date:event.target.value,reviewed:false})}/></label>
            <AirportReviewField label="Departure" name={`part_${index}_departure`} value={review.departure} candidates={options.departureCandidates} onChange={value=>updateReview(index,{departure:value,reviewed:false})}/>
            <AirportReviewField label="Arrival" name={`part_${index}_arrival`} value={review.arrival} candidates={options.arrivalCandidates} onChange={value=>updateReview(index,{arrival:value,reviewed:false})}/>
            <label>{selectedBalloon?"Landings total":"Landings / starts total"}<input name={`part_${index}_starts`} type="number" min="0" max="99" value={review.starts} onChange={event=>updateLandingTotal(index,event.target.value)}/><small>GPS suggestion: {detectedLandings}. Classify the reviewed total below.</small></label>
            {sourceRequirements?.landingMode==="DAY_NIGHT"?<><label><span>Day landings <span className="field-hint" aria-hidden="true">Required</span></span><input name={`part_${index}_landingsDay`} type="number" min="0" max="99" required value={review.landingsDay} aria-describedby={seraLandingSuggestionEnabled?landingHelpId:undefined} onChange={event=>updateLandingSplit(index,"landingsDay",event.target.value)}/></label><label><span>Night landings <span className="field-hint" aria-hidden="true">Required</span></span><input name={`part_${index}_landingsNight`} type="number" min="0" max="99" required value={review.landingsNight} aria-describedby={seraLandingSuggestionEnabled?landingHelpId:undefined} onChange={event=>updateLandingSplit(index,"landingsNight",event.target.value)}/><small>Day + night must equal the reviewed total.</small></label>{seraLandingSuggestionEnabled?<p id={landingHelpId} className="value-origin-note wide"><span>{review.landingSplitSource==="SUGGESTED"?"Suggested":review.landingSplitSource==="MANUAL"?"Manual":"Manual required"}</span>{landingSuggestion?.status==="AVAILABLE"?(review.landingSplitSource==="SUGGESTED"?"SERA civil-twilight suggestion · GPS event time/location.":review.landingSplitSource==="MANUAL"?`Pilot-edited Day/Night split · GPS event suggestion was ${landingSuggestion.day} day / ${landingSuggestion.night} night.`:landingTotalMatchesSuggestion?"Enter Day and Night counts manually.":`Automatic split cleared because the reviewed total no longer matches ${landingSuggestion.total} GPS-detected landing ${landingSuggestion.total===1?"event":"events"}.`):"Day/Night split unavailable from the GPS event evidence. Enter Day and Night counts manually."}</p>:null}</>:sourceRequirements?.landingMode==="TOTAL"?<label><span>Landings <span className="field-hint" aria-hidden="true">Required</span></span><input name={`part_${index}_landingsDay`} type="number" min="0" max="99" required value={review.landingsDay} onChange={event=>updateReview(index,{landingsDay:event.target.value,reviewed:false})}/><input type="hidden" name={`part_${index}_landingsNight`} value="0"/><small>Must equal the reviewed landing total.</small></label>:null}
            {sourceRequirements?.movementMode==="SAILPLANE_LAUNCH"?<><label><span>Launch method <span className="field-hint" aria-hidden="true">Required</span></span><select name={`part_${index}_launchMethod`} required value={review.launchMethod} onChange={event=>updateReview(index,{launchMethod:event.target.value,reviewed:false})}><option value="">Select</option>{LAUNCH_METHODS.map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label><label><span>Launches <span className="field-hint" aria-hidden="true">Required</span></span><input name={`part_${index}_launches`} type="number" min="1" max="99" required value={review.launches} onChange={event=>updateReview(index,{launches:event.target.value,reviewed:false})}/></label></>:null}
            {sourceRequirements?.movementMode==="EXPLICIT_TAKEOFFS"?<><label>Take-offs total<input name={`part_${index}_takeoffs`} type="number" min="0" max="99" value={review.takeoffs} onChange={event=>updateReview(index,{takeoffs:event.target.value,reviewed:false})}/><small>GPS suggestion only; classify it explicitly.</small></label><label><span>Day take-offs <span className="field-hint" aria-hidden="true">Required</span></span><input name={`part_${index}_takeoffsDay`} type="number" min="0" max="99" required value={review.takeoffsDay} onChange={event=>updateReview(index,{takeoffsDay:event.target.value,reviewed:false})}/></label><label><span>Night take-offs <span className="field-hint" aria-hidden="true">Required</span></span><input name={`part_${index}_takeoffsNight`} type="number" min="0" max="99" required value={review.takeoffsNight} onChange={event=>updateReview(index,{takeoffsNight:event.target.value,reviewed:false})}/><small>Day + night must equal the reviewed total.</small></label></>:null}
            {sourceRequirements?.movementMode==="FCL060_PF"?<div className="regulatory-movement-card wide"><label><input name={`part_${index}_movementEvidenceRecorded`} type="checkbox" value="yes" checked={review.pfMovement==="yes"} onChange={event=>{const checked=event.target.checked,suggestion=checked&&nightDefinition==="SERA"?gpsPfMovementDayNightSuggestion(part):null;updateReview(index,{pfMovement:checked?"yes":"",takeoffsDay:checked&&suggestion?.status==="AVAILABLE"?String(suggestion.takeoffsDay):"",takeoffsNight:checked&&suggestion?.status==="AVAILABLE"?String(suggestion.takeoffsNight):"",approachesDay:checked&&suggestion?.status==="AVAILABLE"?String(suggestion.approachesDay):"",approachesNight:checked&&suggestion?.status==="AVAILABLE"?String(suggestion.approachesNight):"",reviewed:false})}}/> Count the detected movements as PF evidence</label><small>Optional. Leave unchecked unless you were pilot flying; unchecked flights receive no PF movement/recency credit.</small>{review.pfMovement==="yes"?(pfSuggestion?.status==="AVAILABLE"?<><input type="hidden" name={`part_${index}_takeoffsDay`} value={review.takeoffsDay}/><input type="hidden" name={`part_${index}_takeoffsNight`} value={review.takeoffsNight}/><input type="hidden" name={`part_${index}_approachesDay`} value={review.approachesDay}/><input type="hidden" name={`part_${index}_approachesNight`} value={review.approachesNight}/><p className="value-origin-note"><span>Suggested</span>{review.takeoffsDay} day / {review.takeoffsNight} night take-offs · {review.approachesDay} day / {review.approachesNight} night approaches.</p></>:<div className="movement-adjust-grid"><label>Day take-offs<input name={`part_${index}_takeoffsDay`} type="number" min="0" max="99" required value={review.takeoffsDay} onChange={event=>updateReview(index,{takeoffsDay:event.target.value,reviewed:false})}/></label><label>Day approaches<input name={`part_${index}_approachesDay`} type="number" min="0" max="99" required value={review.approachesDay} onChange={event=>updateReview(index,{approachesDay:event.target.value,reviewed:false})}/></label><label>Night take-offs<input name={`part_${index}_takeoffsNight`} type="number" min="0" max="99" required value={review.takeoffsNight} onChange={event=>updateReview(index,{takeoffsNight:event.target.value,reviewed:false})}/></label><label>Night approaches<input name={`part_${index}_approachesNight`} type="number" min="0" max="99" required value={review.approachesNight} onChange={event=>updateReview(index,{approachesNight:event.target.value,reviewed:false})}/><small>Automatic Day/Night PF classification is unavailable; enter only if you want PF credit.</small></label></div>):<><input type="hidden" name={`part_${index}_takeoffsDay`} value="0"/><input type="hidden" name={`part_${index}_takeoffsNight`} value="0"/><input type="hidden" name={`part_${index}_approachesDay`} value="0"/><input type="hidden" name={`part_${index}_approachesNight`} value="0"/></>}</div>:null}
            {sourceRequirements?.reviewNightIfr?<><label>Night time<input name={`part_${index}_nightTime`} inputMode="numeric" placeholder="0:00 if none" value={review.nightTime} onChange={event=>updateReview(index,{nightTime:event.target.value,nightTimeSource:"MANUAL",reviewed:false})}/><small>{review.nightTimeSource==="SUGGESTED"?"GPS + SERA suggestion · editable.":"H:MM · manual when GPS/SERA evidence is unavailable."}</small></label><label>IFR time<input name={`part_${index}_ifrTime`} inputMode="numeric" placeholder="0:00 if none" value={review.ifrTime} onChange={event=>updateReview(index,{ifrTime:event.target.value,reviewed:false})}/><small>H:MM · always pilot-entered; GPS does not prove IFR.</small></label></>:<><input type="hidden" name={`part_${index}_nightTime`} value=""/><input type="hidden" name={`part_${index}_ifrTime`} value=""/></>}
            <label>Off-block <span className="field-hint">UTC</span><input name={`part_${index}_offBlock`} type="time" value={review.offBlock} onChange={event=>updateReview(index,{offBlock:event.target.value,reviewed:false})}/></label>
            <label>Takeoff <span className="field-hint">UTC</span><input name={`part_${index}_takeoff`} type="time" value={review.takeoff} onChange={event=>updateReview(index,{takeoff:event.target.value,reviewed:false})}/><small>See takeoff marker above</small></label>
            <label>Landing <span className="field-hint">UTC</span><input name={`part_${index}_landing`} type="time" value={review.landing} onChange={event=>updateReview(index,{landing:event.target.value,reviewed:false})}/><small>See landing marker above</small></label>
            <label>On-block <span className="field-hint">UTC</span><input name={`part_${index}_onBlock`} type="time" value={review.onBlock} onChange={event=>updateReview(index,{onBlock:event.target.value,reviewed:false})}/></label>
            <label className="wide">Notes<textarea name={`part_${index}_note`} rows={2} value={review.note} onChange={event=>updateReview(index,{note:event.target.value,reviewed:false})}/></label>
          </div>
          <label className="review-confirm"><input name={`part_${index}_reviewed`} type="checkbox" value="yes" checked={review.reviewed} disabled={!sourceReady} onChange={event=>updateReview(index,{reviewed:event.target.checked})}/> I reviewed this flight.</label>{!sourceReady?<small className="field-message-error">Complete the explicit logbook evidence above before confirming this flight.</small>:null}
        </article>;
      })}</div>
    </>:null}
    {analysis?<section className="import-save-summary" aria-live="polite"><div><strong>{reviewedCount} of {parts.length} flights reviewed</strong><small>{profileError?"Selected aircraft needs configuration before GPS import can be saved.":requiresOperationEngine&&(!operationType||!engineType)?"Select Operation and Engine before saving.":ready?"All flights are ready to save.":selectedBalloon&&!balloonOperation?"Select free / tethered operation and review each flight.":"Open each flight, check the suggested values and confirm it."}</small></div><span className={ready?"ready":"needs-attention"}>{ready?"Ready to save":profileError?"Needs configuration":`${Math.max(0,parts.length-reviewedCount)} remaining`}</span>{dirty?<small className="unsaved-indicator">Unsaved import</small>:null}</section>:null}
    {state.error?<p ref={errorRef} className="form-error" role="alert" tabIndex={-1}>{state.error}</p>:null}
    <div className="form-actions field-actions"><Submit ready={ready} hasTrack={Boolean(analysis&&parts.length)} onReview={reviewImported}/></div>
  </form>;
}
