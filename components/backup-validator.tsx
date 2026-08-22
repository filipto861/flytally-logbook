"use client";

import { useState } from "react";

type Result={ok:boolean;title:string;detail:string;counts?:Record<string,number>};

async function digest(value:string){const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,"0")).join("")}

export function BackupValidator(){
  const[result,setResult]=useState<Result|null>(null),[checking,setChecking]=useState(false);
  const inspect=async(file?:File)=>{if(!file){setResult(null);return}setChecking(true);try{if(file.size>150*1024*1024)throw new Error("File exceeds the 150 MB safety limit.");const parsed=JSON.parse(await file.text()) as Record<string,unknown>,integrity=parsed.integrity as Record<string,unknown>|undefined;const{integrity:_removed,...payload}=parsed;if(payload.format!=="pilot-logbook-portable")throw new Error("This is not a FlyTally portable backup.");if(!Array.isArray(payload.flights)||!Array.isArray(payload.aircraft)||!Array.isArray(payload.rates))throw new Error("Required backup sections are missing.");const expected=String(integrity?.payload_sha256??""),actual=await digest(JSON.stringify(payload));if(!expected)throw new Error("The backup has no SHA-256 integrity value.");if(expected!==actual)throw new Error("Integrity check failed. The file is damaged or was modified.");const counts=Object.fromEntries(Object.entries(payload.counts as Record<string,unknown>||{}).map(([key,value])=>[key,Number(value)||0]));setResult({ok:true,title:"Backup is complete and valid",detail:`Version ${String(payload.version??"?")} · ${String(payload.exported_at??"date unavailable")}`,counts})}catch(error){setResult({ok:false,title:"Backup validation failed",detail:error instanceof Error?error.message:"Unknown file error."})}finally{setChecking(false)}};
  return <section className="panel backup-validator"><div><p className="eyebrow">BACKUP CHECK</p><h2>Validate JSON backup</h2></div><label className="backup-file">Backup file<input type="file" accept="application/json,.json" onChange={event=>inspect(event.target.files?.[0])}/></label>{checking?<p className="muted">Checking…</p>:null}{result?<div className={`backup-result ${result.ok?"valid":"invalid"}`}><strong>{result.ok?"✓":"⚠"} {result.title}</strong><p>{result.detail}</p>{result.counts?<div>{Object.entries(result.counts).map(([key,value])=><span key={key}><small>{key.replaceAll("_"," ")}</small><b>{value.toLocaleString("en-GB")}</b></span>)}</div>:null}</div>:null}</section>;
}
