"use client";

import { useEffect,useRef,useState } from "react";

type Entry={icao:string;make:string;model:string;label:string;category:string;engine:string;classHint:""|"SEP"|"MEP"|"SET"};

export function AircraftTypePicker({initialMake="",initialModel="",initialIcao="",requireMake=false,requireModel=false}:{initialMake?:string;initialModel?:string;initialIcao?:string;requireMake?:boolean;requireModel?:boolean}){
  const[make,setMake]=useState(initialMake),[model,setModel]=useState(initialModel),[icao,setIcao]=useState(initialIcao),[query,setQuery]=useState(""),[results,setResults]=useState<Entry[]>([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[hint,setHint]=useState<Entry["classHint"]>("");
  const requestId=useRef(0),confirmedQuery=useRef("");
  useEffect(()=>{const value=query.trim();if(value===confirmedQuery.current){setResults([]);setLoading(false);setOpen(false);return}if(value.length<2){setResults([]);setLoading(false);return}const id=++requestId.current,set=setTimeout(async()=>{setLoading(true);try{const response=await fetch(`/api/aircraft-types?q=${encodeURIComponent(value)}`);const body=await response.json() as {results?:Entry[]};if(id===requestId.current){setResults(body.results??[]);setOpen(true)}}catch{if(id===requestId.current)setResults([])}finally{if(id===requestId.current)setLoading(false)}},180);return()=>clearTimeout(set)},[query]);
  const choose=(entry:Entry)=>{confirmedQuery.current=entry.label;requestId.current+=1;setMake(entry.make);setModel(entry.model);setIcao(entry.icao);setQuery(entry.label);setHint(entry.classHint);setResults([]);setLoading(false);setOpen(false)};
  return <div className="aircraft-type-picker">
    <label className="aircraft-catalog-search">Find aircraft type<input value={query} onChange={event=>{confirmedQuery.current="";setQuery(event.target.value);setOpen(true)}} onFocus={()=>{if(results.length&&query.trim()!==confirmedQuery.current)setOpen(true)}} placeholder="Try Bristell B23, C172, P-2008 or BR23" autoComplete="off"/><small>{loading?"Searching aircraft catalogue…":"Search by manufacturer, model or ICAO designator."}</small></label>
    {open&&query.trim().length>=2?<div className="aircraft-catalog-results" role="listbox">{results.map((entry,index)=><button type="button" role="option" key={`${entry.icao}-${entry.make}-${entry.model}-${index}`} onClick={()=>choose(entry)}><span><strong>{entry.make} {entry.model}</strong><small>{entry.category}{entry.engine?` · ${entry.engine}`:""}</small></span><b>{entry.icao}</b></button>)}{!loading&&!results.length?<div className="aircraft-catalog-empty"><strong>Type not found</strong><small>Enter Make, Model and ICAO manually below.</small></div>:null}</div>:null}
    <div className="aircraft-identity-fields">
      <label><span>Make {requireMake?<span className="field-hint" aria-hidden="true">Required</span>:null}</span><input name="aircraft_make" value={make} onChange={event=>{setMake(event.target.value);setHint("")}} placeholder="BRM Aero" required={requireMake}/><small>{requireMake?"Required for the EASA aircraft identity.":"Manufacturer, when known."}</small></label>
      <label><span>Aircraft type / model {requireModel?<span className="field-hint" aria-hidden="true">Required</span>:null}</span><input name="aircraft_model" value={model} onChange={event=>{setModel(event.target.value);setHint("")}} placeholder="Bristell B23" required={requireModel}/><small>{requireModel?"Required for this aircraft profile.":"Model or aircraft type."}</small></label>
      <label>ICAO type<input name="icao_type" value={icao} onChange={event=>{setIcao(event.target.value.toUpperCase());setHint("")}} placeholder="BR23" autoCapitalize="characters"/><small>Filled automatically when the catalogue has a designator.</small></label>
    </div>
    <div className="aircraft-catalog-help"><span>Can’t find the aircraft? Just enter it manually — the catalogue is optional.</span>{hint?<span className="aircraft-class-hint">Catalogue hint: {hint}. Confirm the Part-FCL class separately below.</span>:null}</div>
  </div>;
}
