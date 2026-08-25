"use client";

import { useActionState,useEffect,useMemo,useState } from "react";
import { useFormStatus } from "react-dom";
import type { AircraftOption } from "@/lib/data/aircraft";
import type { AirportCandidate,AirportDetectionResult,AirportDetectionRequest,FlightActionState } from "@/app/(protected)/flights/actions";
import type { MapTrack,TrackPoint } from "@/lib/data/tracks";
import { TracksMap } from "@/components/tracks-map";
import { flightEnvelope,hasAirborneMovement,inspectTrackFile,landingCount,overview,splitPoints,suggestedSplitDetails,suggestedSplits,trackQuality,trackStats,type KmlPoint,type SplitSuggestion,type TrackFileFormat,type TrackQuality,type TrackSource } from "@/lib/track-processing";
import { trackTimeBasis,utcParts,type TrackTimeBasis } from "@/lib/track-time";
import { BILLING_SHARES,parseBilling } from "@/lib/billing";

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

function mapTrack(part:KmlPoint[],index:number,registration:string,review:Review):MapTrack{
  return{id:index,flightId:index,date:review.date,registration,departure:review.departure,arrival:review.arrival,evidence:"ULL",distanceKm:trackStats(part).distanceKm,points:overview(part,900).map(point=>({...point,alt:point.alt??undefined,time:point.time??undefined})) as TrackPoint[]};
}

function Submit({ready}:{ready:boolean}){
  const {pending}=useFormStatus();
  return <button className="primary-button" disabled={pending||!ready}>{pending?"Saving reviewed flights…":ready?"Save reviewed flights":"Review every flight first"}</button>;
}

function AirportReviewField({label,name,value,candidates,onChange}:{label:string;name:string;value:string;candidates:AirportCandidate[];onChange:(value:string)=>void}){
  return <div className="airport-review-field">
    <label>{label}<input name={name} value={value} placeholder="LKPR" onChange={event=>onChange(event.target.value.toUpperCase())}/></label>
    {candidates.length?<div className="airport-candidate-list" aria-label={`${label} airport candidates`}>{candidates.map(candidate=><button type="button" key={`${name}-${candidate.ident}`} className={value===candidate.ident?"selected":""} onClick={()=>onChange(candidate.ident)} title={`${candidate.name||candidate.ident} · ${candidate.source}`}><b>{candidate.ident}</b><span>{candidate.distanceKm.toFixed(1)} km</span><small>{candidate.confidence}</small></button>)}</div>:null}
  </div>;
}

export function KmlImportForm({action,airportAction,aircraft}:{action:Action;airportAction:AirportAction;aircraft:AircraftOption[]}){
  const [state,formAction]=useActionState(action,{}),[analysis,setAnalysis]=useState<Analysis|null>(null),[cuts,setCuts]=useState<number[]>([]),[reviews,setReviews]=useState<Review[]>([]),[registration,setRegistration]=useState(""),[airportCount,setAirportCount]=useState<number|null>(null),[airportOptions,setAirportOptions]=useState<AirportOptions[]>([]),[detecting,setDetecting]=useState(false);
  const parts=useMemo(()=>analysis?splitPoints(analysis.points,cuts):[],[analysis,cuts]);

  const resetParts=(next:number[],source=analysis)=>{
    if(!source)return;
    const clean=[...new Set(next)].filter(value=>Number.isSafeInteger(value)&&value>0&&value<source.points.length-1).sort((a,b)=>a-b).slice(0,19);
    setCuts(clean);setReviews(splitPoints(source.points,clean).map(reviewFor));setAirportOptions([]);setAirportCount(null);
  };
  const updateReview=(index:number,patch:Partial<Review>)=>setReviews(current=>current.map((review,i)=>i===index?{...review,...patch}:review));

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
  const selectedAircraft=aircraft.find(item=>item.registration===registration),selectedBilling=parseBilling(selectedAircraft?.billing_basis);
  const addCut=()=>{if(!analysis||parts.length>=20)return;const boundaries=[0,...cuts.map(value=>value+1),analysis.points.length],segments=boundaries.slice(0,-1).map((start,index)=>({start,end:boundaries[index+1]-1})),largest=segments.sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];if(largest.end-largest.start<6)return;resetParts([...cuts,Math.floor((largest.start+largest.end)/2)])};

  return <form action={formAction} className="flight-form kml-wizard">
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
        {cuts.length?cuts.map((cut,index)=>{const stamp=utcParts(analysis.points[cut]?.time||null),detail=analysis.details.find(item=>item.index===cut);return <div className="split-row" key={`${index}-${cut}`}><label>Split {index+1}<input type="range" min="2" max={Math.max(2,analysis.points.length-3)} value={cut} onChange={event=>resetParts(cuts.map((value,i)=>i===index?Number(event.target.value):value))}/></label><div className="split-explanation"><strong>{stamp?`${stamp.date} ${stamp.time} UTC`:`GPS point ${cut+1}`}</strong><small>{detail?.reason||"Manual split point — verify both resulting flights."}</small></div><button type="button" className="icon-danger" onClick={()=>resetParts(cuts.filter((_,i)=>i!==index))}>Delete</button></div>}):null}
      </section>
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

      <div className="import-step"><span>4</span><div><strong>Review flights</strong><small>{detecting?"Detecting airports…":airportCount===0?"Airport catalogue is empty.":airportCount===-1?"Airport detection unavailable.":""}</small></div></div>
      <div className="flight-review-list">{parts.map((part,index)=>{
        const review=reviews[index]||reviewFor(part),stats=trackStats(part),detected=flightEnvelope(part),credible=hasAirborneMovement(part),quality=trackQuality(part),options=airportOptions[index]||{departureCandidates:[],arrivalCandidates:[]};
        return <article className={`flight-review-card ${review.reviewed?"confirmed":""}${credible?"":" invalid-flight"}`} key={`${cuts.join("-")}-${index}`}>
          <header><div><span>FLIGHT {index+1} OF {parts.length}</span><h2>{review.departure||"?"} → {review.arrival||"?"}</h2><p>{stats.pointCount} points · {stats.distanceKm.toFixed(1)} km · GPS {quality.status.toUpperCase()}</p></div><div className="review-status">{review.reviewed?"✓ reviewed":"review required"}</div></header>
          {!credible?<p className="ground-flight-warning">This section contains no credible flight movement. Adjust or remove the split.</p>:quality.status!=="good"?<p className="track-time-warning"><b>Check this GPS section.</b> {quality.warnings.join(" ")}</p>:null}
          <div className="kml-preview"><TracksMap tracks={[mapTrack(part,index,registration,review)]} height={260} detail/></div>
          <div className="kml-time-row"><span className="utc-chip">UTC</span><small className="field-hint">FCL.050 logbook times are reviewed and stored in UTC.</small></div>
          <div className="form-grid review-grid">
            <label>Date<input name={`part_${index}_date`} type="date" required value={review.date} onChange={event=>updateReview(index,{date:event.target.value,reviewed:false})}/></label>
            <AirportReviewField label="Departure" name={`part_${index}_departure`} value={review.departure} candidates={options.departureCandidates} onChange={value=>updateReview(index,{departure:value,reviewed:false})}/>
            <AirportReviewField label="Arrival" name={`part_${index}_arrival`} value={review.arrival} candidates={options.arrivalCandidates} onChange={value=>updateReview(index,{arrival:value,reviewed:false})}/>
            <label>Landings<input name={`part_${index}_starts`} type="number" min="0" max="99" value={review.starts} onChange={event=>updateReview(index,{starts:event.target.value,reviewed:false})}/></label>
            <label>Off-block <span className="field-hint">UTC</span><input name={`part_${index}_offBlock`} type="time" value={review.offBlock} onChange={event=>updateReview(index,{offBlock:event.target.value,reviewed:false})}/></label>
            <label>Takeoff <span className="field-hint">UTC</span><input name={`part_${index}_takeoff`} type="time" value={review.takeoff} onChange={event=>updateReview(index,{takeoff:event.target.value,reviewed:false})}/><small>GPS point {detected.takeoffIndex+1}</small></label>
            <label>Landing <span className="field-hint">UTC</span><input name={`part_${index}_landing`} type="time" value={review.landing} onChange={event=>updateReview(index,{landing:event.target.value,reviewed:false})}/><small>GPS point {detected.landingIndex+1}</small></label>
            <label>On-block <span className="field-hint">UTC</span><input name={`part_${index}_onBlock`} type="time" value={review.onBlock} onChange={event=>updateReview(index,{onBlock:event.target.value,reviewed:false})}/></label>
            <label className="wide">Notes<textarea name={`part_${index}_note`} rows={2} value={review.note} onChange={event=>updateReview(index,{note:event.target.value,reviewed:false})}/></label>
          </div>
          <label className="review-confirm"><input name={`part_${index}_reviewed`} type="checkbox" value="yes" checked={review.reviewed} onChange={event=>updateReview(index,{reviewed:event.target.checked})}/> I reviewed this flight.</label>
        </article>;
      })}</div>
    </>:null}
    {state.error?<p className="form-error">{state.error}</p>:null}
    <div className="form-actions field-actions"><Submit ready={ready}/></div>
  </form>;
}
