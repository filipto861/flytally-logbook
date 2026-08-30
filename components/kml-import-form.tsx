"use client";

import { useActionState,useEffect,useMemo,useRef,useState } from "react";
import { useFormStatus } from "react-dom";
import dynamic from "next/dynamic";
import type { AircraftOption } from "@/lib/data/aircraft";
import type { AirportCandidate,AirportDetectionResult,AirportDetectionRequest,FlightActionState } from "@/app/(protected)/flights/actions";
import type { MapTrack,TrackPoint } from "@/lib/data/tracks";
import type { ImportReviewEvent } from "@/components/gps-import-review-player";
import { flightEnvelope,hasAirborneMovement,inspectTrackFile,landingCount,overview,splitPoints,suggestedSplitDetails,suggestedSplits,touchAndGoEvents,trackQuality,trackStats,type KmlPoint,type SplitSuggestion,type TrackFileFormat,type TrackQuality,type TrackSource } from "@/lib/track-processing";
import { trackTimeBasis,utcParts,type TrackTimeBasis } from "@/lib/track-time";
import { BILLING_SHARES,parseBilling } from "@/lib/billing";
import { useUnsavedFormGuard } from "@/components/use-unsaved-form-guard";

const TracksMap=dynamic(()=>import("@/components/tracks-map").then(module=>module.TracksMap),{ssr:false,loading:()=> <div className="track-map-loading">Loading GPS preview…</div>});
const GpsImportReviewPlayer=dynamic(()=>import("@/components/gps-import-review-player").then(module=>module.GpsImportReviewPlayer),{ssr:false,loading:()=> <div className="track-map-loading">Loading visual GPS review…</div>});

type Action=(state:FlightActionState,data:FormData)=>Promise<FlightActionState>;
type AirportAction=(requests:AirportDetectionRequest[])=>Promise<AirportDetectionResult>;
type Analysis={name:string;points:KmlPoint[];suggested:number[];details:SplitSuggestion[];registration:string;timeBasis:TrackTimeBasis;format:TrackFileFormat;source:TrackSource;quality:TrackQuality};
type Review={date:string;offBlock:string;takeoff:string;landing:string;onBlock:string;departure:string;arrival:string;starts:string;note:string;reviewed:boolean};
type AirportOptions={departureCandidates:AirportCandidate[];arrivalCandidates:AirportCandidate[]};

const sourceLabel=(source:TrackSource)=>source==="adsbexchange"?"ADSBExchange":source==="flightradar24"?"Flightradar24":source==="skydemon"?"SkyDemon":"Generic GPS";

function inspect(source:string,name:string):Analysis{
  const inspection=inspectTrackFile(source,name),points=inspection.points;
  const registration=name.toUpperCase().replaceAll("_","-").match(/\bOK-?[A-Z]{3}\d{0,2}\b/)?.[0]?.replace(/^OK(?!-)/,"OK-")||"";
  return{name,points,suggested:suggestedSplits(points),details:suggestedSplitDetails(points),registration,timeBasis:trackTimeBasis(points),format:inspection.format,source:inspection.source,quality:inspection.quality};
}

function reviewFor(part:KmlPoint[]):Review{
  const envelope=flightEnvelope(part),stats=trackStats(part),fallbackStart=utcParts(stats.startUtc),off=utcParts(envelope.offBlockUtc),takeoff=utcParts(envelope.takeoffUtc),landing=utcParts(envelope.landingUtc),on=utcParts(envelope.onBlockUtc);
  return{date:off?.date||takeoff?.date||fallbackStart?.date||"",offBlock:off?.time||"",takeoff:takeoff?.time||"",landing:landing?.time||"",onBlock:on?.time||"",departure:"",arrival:"",starts:String(landingCount(part)),note:"",reviewed:false};
}

function mapTrack(part:KmlPoint[],index:number,registration:string,review?:Review,maxPoints=900):MapTrack{
  return{id:index,flightId:index,date:review?.date||"",registration,departure:review?.departure||"",arrival:review?.arrival||"",evidence:"ULL",distanceKm:trackStats(part).distanceKm,points:overview(part,maxPoints).map(point=>({...point,alt:point.alt??undefined,time:point.time??undefined})) as TrackPoint[]};
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
  const {pending}=useFormStatus();
  return ready?<button className="primary-button" disabled={pending}>{pending?"Saving reviewed flights…":"Save reviewed flights"}</button>:<button type="button" className="primary-button" disabled={!hasTrack} onClick={onReview}>{hasTrack?"Review imported flights":"Upload track first"}</button>;
}

function AirportReviewField({label,name,value,candidates,onChange}:{label:string;name:string;value:string;candidates:AirportCandidate[];onChange:(value:string)=>void}){
  return <div className="airport-review-field">
    <label>{label}<input name={name} value={value} placeholder="LKPR" onChange={event=>onChange(event.target.value.toUpperCase())}/></label>
    {candidates.length?<div className="airport-candidate-list" aria-label={`${label} airport candidates`}>{candidates.map(candidate=><button type="button" key={`${name}-${candidate.ident}`} className={value===candidate.ident?"selected":""} onClick={()=>onChange(candidate.ident)} title={`${candidate.name||candidate.ident} · ${candidate.source}`}><b>{candidate.ident}</b><span>{candidate.distanceKm.toFixed(1)} km</span><small>{candidate.confidence}</small></button>)}</div>:null}
  </div>;
}

export function KmlImportForm({action,airportAction,aircraft}:{action:Action;airportAction:AirportAction;aircraft:AircraftOption[]}){
  const [state,formAction]=useActionState(action,{}),[analysis,setAnalysis]=useState<Analysis|null>(null),[cuts,setCuts]=useState<number[]>([]),[reviews,setReviews]=useState<Review[]>([]),[registration,setRegistration]=useState(""),[airportCount,setAirportCount]=useState<number|null>(null),[airportOptions,setAirportOptions]=useState<AirportOptions[]>([]),[detecting,setDetecting]=useState(false);
  const{dirty,markDirty,beginSubmit}=useUnsavedFormGuard(),errorRef=useRef<HTMLParagraphElement>(null);
  const parts=useMemo(()=>analysis?splitPoints(analysis.points,cuts):[],[analysis,cuts]);
  const visualTrack=useMemo(()=>analysis?mapTrack(analysis.points,-1,registration,undefined,1800):null,[analysis,registration]);
  const visualEvents=useMemo(()=>analysis?importReviewEvents(analysis,cuts):[],[analysis,cuts]);

  const resetParts=(next:number[],source=analysis)=>{
    if(!source)return;
    markDirty();
    const clean=[...new Set(next)].filter(value=>Number.isSafeInteger(value)&&value>0&&value<source.points.length-1).sort((a,b)=>a-b).slice(0,19);
    setCuts(clean);setReviews(splitPoints(source.points,clean).map(reviewFor));setAirportOptions([]);setAirportCount(null);
  };
  const updateReview=(index:number,patch:Partial<Review>)=>{markDirty();setReviews(current=>current.map((review,i)=>i===index?{...review,...patch}:review))};

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

  const ready=parts.length>0&&parts.every(hasAirborneMovement)&&reviews.length===parts.length&&reviews.every(review=>review.reviewed&&review.date);
  const reviewedCount=reviews.filter(review=>review.reviewed).length;
  const selectedAircraft=aircraft.find(item=>item.registration===registration),selectedBilling=parseBilling(selectedAircraft?.billing_basis);
  const addCut=()=>{if(!analysis||parts.length>=20)return;const boundaries=[0,...cuts.map(value=>value+1),analysis.points.length],segments=boundaries.slice(0,-1).map((start,index)=>({start,end:boundaries[index+1]-1})),largest=segments.sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];if(largest.end-largest.start<6)return;resetParts([...cuts,Math.floor((largest.start+largest.end)/2)])};

  const reviewImported=()=>{const target=document.querySelector<HTMLElement>(".flight-review-card:not(.confirmed)")||document.querySelector<HTMLElement>(".flight-review-card");target?.scrollIntoView({behavior:"smooth",block:"start"});target?.focus({preventScroll:true})};
  useEffect(()=>{if(state.error){markDirty();errorRef.current?.focus()}},[state.error,markDirty]);
  return <form action={formAction} className="flight-form kml-wizard" onChangeCapture={markDirty} onSubmitCapture={beginSubmit}>
    <nav className="entry-progress" aria-label="GPS import progress"><span className={analysis?"complete":"active"}>1 <b>Source</b></span><span className={analysis?"complete":""}>2 <b>Split</b></span><span className={analysis&&reviewedCount<parts.length?"active":analysis?"complete":""}>3 <b>Review</b></span><span className={ready?"active":""}>4 <b>Save</b></span></nav>
    <div className="import-step"><span>1</span><div><strong>Upload track</strong></div></div>
    <div className="upload-zone">
      <label>KML, GPX or CSV<input name="kml" type="file" accept=".kml,.gpx,.csv,application/vnd.google-earth.kml+xml,application/xml,text/xml,text/csv" required onChange={async event=>{const file=event.target.files?.[0];if(!file){setAnalysis(null);setReviews([]);return}const next=inspect(await file.text(),file.name);setAnalysis(next);setRegistration(next.registration&&aircraft.some(item=>item.registration===next.registration)?next.registration:"");resetParts(next.suggested,next)}}/></label>
      {analysis?<p>{analysis.points.length>=2?"✓":"⚠"} {analysis.name} · {analysis.points.length} GPS points · {analysis.format.toUpperCase()} · {sourceLabel(analysis.source)} · {analysis.suggested.length+1} suggested {analysis.suggested.length?"flights":"flight"} · {analysis.timeBasis==="utc"?"UTC timestamps":analysis.timeBasis==="offset"?"offset timestamps → UTC":"timezone not explicit"}</p>:null}
    </div>
    {analysis&&analysis.quality.status!=="good"?<p className="track-time-warning"><b>GPS track needs review.</b> {analysis.quality.warnings.join(" ")}</p>:analysis?<p className="field-hint">GPS track quality: good · {Math.round(analysis.quality.timestampCoverage*100)}% timestamp coverage.</p>:null}
    {analysis&&analysis.timeBasis==="ambiguous"?<p className="track-time-warning"><b>Time zone is missing in this track.</b> FlyTally will not guess from the iPad or computer clock. Review and enter UTC times manually before saving.</p>:null}

    {analysis&&analysis.points.length>=2?<>
      <div className="import-step"><span>2</span><div><strong>Flight split</strong><small>{parts.length} {parts.length===1?"flight":"flights"}</small></div></div>
      <section className="split-editor">
        <div className="split-toolbar"><button type="button" className="secondary-button" onClick={()=>resetParts(analysis.suggested)}>Reset suggestion</button><button type="button" className="secondary-button" onClick={()=>resetParts([])}>Single flight</button><button type="button" className="secondary-button" onClick={addCut} disabled={parts.length>=20}>＋ Add split</button></div>
        {cuts.length?cuts.map((cut,index)=>{const stamp=utcParts(analysis.points[cut]?.time||null),detail=analysis.details.find(item=>item.index===cut);return <div className="split-row" key={`${index}-${cut}`}><label>Split {index+1}<input type="range" min="2" max={Math.max(2,analysis.points.length-3)} value={cut} onChange={event=>resetParts(cuts.map((value,i)=>i===index?Number(event.target.value):value))}/></label><div className="split-explanation"><strong>{stamp?`${stamp.date} ${stamp.time} UTC`:"Position on track"}</strong><small>{detail?.reason||"Manual split point — verify both resulting flights."}</small></div><button type="button" className="icon-danger" onClick={()=>resetParts(cuts.filter((_,i)=>i!==index))}>Delete</button></div>}):null}
      </section>
      {visualTrack?<section className="import-player-review"><div className="section-heading"><div><p className="eyebrow">GPS REVIEW</p><h2>Check the detected flight visually</h2><p className="muted">Takeoff, landing, touch-and-go and split detections are marked directly on the altitude/speed profile.</p></div></div><GpsImportReviewPlayer track={visualTrack} events={visualEvents}/><p className="import-player-note">These markers explain the current automatic suggestion. Move the split sliders or edit the final fields below if the GPS interpretation is not correct.</p></section>:null}
      <input type="hidden" name="splitIndices" value={cuts.join(",")}/><input type="hidden" name="partCount" value={parts.length}/>

      <div className="import-step"><span>3</span><div><strong>Common details</strong></div></div>
      <div className="form-grid secondary-entry-grid">
        <label>Registration<select name="registration" required value={registration} onChange={event=>setRegistration(event.target.value)}><option value="">Select</option>{aircraft.map(item=><option key={item.registration}>{item.registration}</option>)}</select>{analysis.registration?<small>Suggested: {analysis.registration}</small>:null}</label>
        <label>Aircraft type<input key={`type-${registration}`} name="aircraftType" defaultValue={selectedAircraft?.aircraft_type||""}/></label>
        <label>Class<select key={`class-${registration}`} name="aircraftClass" defaultValue={selectedAircraft?.aircraft_class||"ULL"}><option>ULL</option><option>SEP</option><option>TMG</option><option>MEP</option><option>SET</option><option>OTHER</option><option>GLIDER</option></select></label>
        <label>Logbook<select key={`evidence-${registration}`} name="evidence" defaultValue={selectedAircraft?.evidence||"ULL"}><option>ULL</option><option>EASA</option></select></label>
        <label>Role<select key={`role-${registration}`} name="role" defaultValue={selectedAircraft?.default_role||"PIC"}><option>PIC</option><option>DUAL</option><option value="INSTRUKTOR">INSTRUCTOR</option><option>SAFETY PILOT</option><option>CO-PILOT</option><option>PAX</option><option>OBSERVER</option></select></label>
        <label>Billing time<select key={`billing-${registration}`} name="billingBasis" defaultValue={selectedBilling.basis}><option>BLOCK</option><option>AIR</option></select></label>
        <label>Cost share<select key={`share-${registration}`} name="billingShare" defaultValue={selectedBilling.share}>{BILLING_SHARES.map(value=><option key={value} value={value}>{value===1?"1/1 · full price":`1/${value}`}</option>)}</select></label>
        <label className="wide">Task<input name="task" defaultValue="GPS import"/></label>
      </div>
      <p className="value-origin-note"><span>Automatic</span> GPS supplied the times, split and landing suggestions. Aircraft profile supplied logbook and billing defaults. Review fields remain editable.</p>

      <div className="import-step"><span>4</span><div><strong>Review flights</strong><small>{detecting?"Detecting airports…":airportCount===0?"Airport catalogue is empty.":airportCount===-1?"Airport detection unavailable.":""}</small></div></div>
      <div className="flight-review-list">{parts.map((part,index)=>{
        const review=reviews[index]||reviewFor(part),stats=trackStats(part),detected=flightEnvelope(part),touches=touchAndGoEvents(part),detectedLandings=1+touches.length,credible=hasAirborneMovement(part),quality=trackQuality(part),options=airportOptions[index]||{departureCandidates:[],arrivalCandidates:[]};
        return <article className={`flight-review-card ${review.reviewed?"confirmed":""}${credible?"":" invalid-flight"}`} key={`${cuts.join("-")}-${index}`} tabIndex={-1}>
          <header><div><span>FLIGHT {index+1} OF {parts.length}</span><h2>{review.departure||"?"} → {review.arrival||"?"}</h2><p>{stats.pointCount} points · {stats.distanceKm.toFixed(1)} km · {detectedLandings} {detectedLandings===1?"landing":"landings"} · GPS {quality.status.toUpperCase()}</p></div><div className="review-status">{review.reviewed?"✓ reviewed":"review required"}</div></header>
          {!credible?<p className="ground-flight-warning">This section contains no credible flight movement. Adjust or remove the split.</p>:quality.status!=="good"?<p className="track-time-warning"><b>Check this GPS section.</b> {quality.warnings.join(" ")}</p>:null}
          <div className="kml-preview"><TracksMap tracks={[mapTrack(part,index,registration,review)]} height={260} detail/></div>
          <div className="kml-time-row"><span className="utc-chip">UTC</span><small className="field-hint">FCL.050 logbook times are reviewed and stored in UTC.</small></div>
          <div className={`touch-review ${touches.length?"detected":"clear"}`}>
            <div><strong>{touches.length?`${touches.length} touch-and-go ${touches.length===1?"event":"events"} detected`:"No touch-and-go detected"}</strong><small>Landings were prefilled to {detectedLandings}. Confirm or edit the value below before reviewing this flight.</small></div>
            {touches.length?<div className="touch-event-list">{touches.map((event,eventIndex)=>{const stamp=utcParts(event.time);return <span key={`${event.index}-${eventIndex}`} title={`${event.confidence} confidence · ${event.signal} profile`}><b>T&amp;G {eventIndex+1}</b>{stamp?`${stamp.time} UTC`:"Detected on profile"}<small>{event.signal}</small></span>})}</div>:null}
          </div>
          <div className="form-grid review-grid">
            <label>Date<input name={`part_${index}_date`} type="date" required value={review.date} onChange={event=>updateReview(index,{date:event.target.value,reviewed:false})}/></label>
            <AirportReviewField label="Departure" name={`part_${index}_departure`} value={review.departure} candidates={options.departureCandidates} onChange={value=>updateReview(index,{departure:value,reviewed:false})}/>
            <AirportReviewField label="Arrival" name={`part_${index}_arrival`} value={review.arrival} candidates={options.arrivalCandidates} onChange={value=>updateReview(index,{arrival:value,reviewed:false})}/>
            <label>Landings / starts<input name={`part_${index}_starts`} type="number" min="0" max="99" value={review.starts} onChange={event=>updateReview(index,{starts:event.target.value,reviewed:false})}/><small>GPS suggestion: {detectedLandings}</small></label>
            <label>Off-block <span className="field-hint">UTC</span><input name={`part_${index}_offBlock`} type="time" value={review.offBlock} onChange={event=>updateReview(index,{offBlock:event.target.value,reviewed:false})}/></label>
            <label>Takeoff <span className="field-hint">UTC</span><input name={`part_${index}_takeoff`} type="time" value={review.takeoff} onChange={event=>updateReview(index,{takeoff:event.target.value,reviewed:false})}/><small>See takeoff marker above</small></label>
            <label>Landing <span className="field-hint">UTC</span><input name={`part_${index}_landing`} type="time" value={review.landing} onChange={event=>updateReview(index,{landing:event.target.value,reviewed:false})}/><small>See landing marker above</small></label>
            <label>On-block <span className="field-hint">UTC</span><input name={`part_${index}_onBlock`} type="time" value={review.onBlock} onChange={event=>updateReview(index,{onBlock:event.target.value,reviewed:false})}/></label>
            <label className="wide">Notes<textarea name={`part_${index}_note`} rows={2} value={review.note} onChange={event=>updateReview(index,{note:event.target.value,reviewed:false})}/></label>
          </div>
          <label className="review-confirm"><input name={`part_${index}_reviewed`} type="checkbox" value="yes" checked={review.reviewed} onChange={event=>updateReview(index,{reviewed:event.target.checked})}/> I reviewed this flight.</label>
        </article>;
      })}</div>
    </>:null}
    {analysis?<section className="import-save-summary" aria-live="polite"><div><strong>{reviewedCount} of {parts.length} flights reviewed</strong><small>{ready?"All flights are ready to save.":"Open each flight, check the suggested values and confirm it."}</small></div><span className={ready?"ready":"needs-attention"}>{ready?"Ready to save":`${Math.max(0,parts.length-reviewedCount)} remaining`}</span>{dirty?<small className="unsaved-indicator">Unsaved import</small>:null}</section>:null}
    {state.error?<p ref={errorRef} className="form-error" role="alert" tabIndex={-1}>{state.error}</p>:null}
    <div className="form-actions field-actions"><Submit ready={ready} hasTrack={Boolean(analysis&&parts.length)} onReview={reviewImported}/></div>
  </form>;
}
