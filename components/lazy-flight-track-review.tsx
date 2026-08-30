"use client";

import { useEffect,useState } from "react";
import { FlightTrackPlayer } from "@/components/flight-track-player";
import type { FlightTrackReview } from "@/lib/data/flight-track-review";

type CurrentValues={offBlock:string;takeoff:string;landing:string;onBlock:string;landings:number};
const cache=new Map<number,FlightTrackReview>();
const pair=(from:string,to:string)=>from&&to?`${from}–${to}`:"—";

export function LazyFlightTrackReview({flightId,current}:{flightId:number;current:CurrentValues}){
  const[state,setState]=useState<{loading:boolean;error:string;data:FlightTrackReview|null}>(()=>({loading:!cache.has(flightId),error:"",data:cache.get(flightId)??null}));
  const[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const saved=cache.get(flightId);if(saved){setState({loading:false,error:"",data:saved});return}
    const controller=new AbortController();setState(value=>({...value,loading:true,error:""}));
    fetch(`/api/flights/${flightId}/tracks`,{cache:"no-store",signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error("Detailed GPS data could not be loaded.");
      return await response.json() as FlightTrackReview;
    }).then(data=>{cache.set(flightId,data);setState({loading:false,error:"",data})}).catch(error=>{if(error?.name!=="AbortError")setState({loading:false,error:String(error?.message||"Detailed GPS data could not be loaded."),data:null})});
    return()=>controller.abort();
  },[flightId,attempt]);

  if(state.loading)return <section className="panel gps-lazy-state"><p className="eyebrow">GPS REVIEW</p><h2>Loading detailed track…</h2><p className="muted">High-resolution GPS points are loaded only when you open this tab, so the normal flight detail stays lightweight.</p></section>;
  if(state.error)return <section className="panel gps-lazy-state"><p className="eyebrow">GPS REVIEW</p><h2>Track could not be loaded</h2><p className="form-error">{state.error}</p><button type="button" className="secondary-button" onClick={()=>setAttempt(value=>value+1)}>Try again</button></section>;
  const data=state.data;if(!data||!data.tracks.length)return <section className="panel gps-lazy-state"><p className="eyebrow">GPS REVIEW</p><h2>No usable GPS points</h2><p className="muted">The track record exists, but there are not enough valid points for the player.</p></section>;
  const suggestion=data.inference;
  return <>
    <section className="panel gps-review-panel">
      <div className="section-heading"><div><p className="eyebrow">GPS REVIEW</p><h2>Saved values vs GPS suggestion</h2></div><span className="gps-demand-badge">Loaded on demand</span></div>
      {suggestion?<div className="gps-review-grid">
        <article><span>BLOCK</span><strong>{pair(current.offBlock,current.onBlock)}</strong><small>Saved logbook value</small><b>{pair(suggestion.offBlock,suggestion.onBlock)}</b><small>GPS-derived suggestion</small></article>
        <article><span>AIR</span><strong>{pair(current.takeoff,current.landing)}</strong><small>Saved logbook value</small><b>{pair(suggestion.takeoff,suggestion.landing)}</b><small>GPS-derived suggestion</small></article>
        <article><span>Landings</span><strong>{current.landings}</strong><small>Saved logbook value</small><b>{suggestion.landings}</b><small>GPS detection · advisory only</small></article>
      </div>:<p className="muted">The track can be displayed, but FlyTally could not produce a complete time suggestion from it.</p>}
      <p className="gps-provenance-note">GPS suggestions are derived from the uploaded track. They never become logbook values automatically: review them first, then use <strong>Apply GPS time suggestions</strong> below if you want to replace BLOCK and AIR times. Detected landings remain advisory and are not applied by that action.</p>
    </section>
    <FlightTrackPlayer tracks={data.tracks}/>
  </>;
}
