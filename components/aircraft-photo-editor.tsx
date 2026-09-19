"use client";

import { PendingActionButton } from "@/components/pending-action-button";
import { useActionState,useState } from "react";

type PhotoState={ok:boolean;message:string};
type SavePhotoAction=(state:PhotoState,form:FormData)=>Promise<PhotoState>;
type RemovePhotoAction=(form:FormData)=>Promise<void>;

async function renderCover(file:File){
  if(file.size>12*1024*1024)throw new Error("Choose an image smaller than 12 MB.");
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Use a JPG, PNG or WebP image.");
  const url=URL.createObjectURL(file);
  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("The image could not be read."));img.src=url});
    const targetWidth=1200,targetHeight=675,targetAspect=targetWidth/targetHeight,sourceAspect=image.naturalWidth/image.naturalHeight;
    let sx=0,sy=0,sw=image.naturalWidth,sh=image.naturalHeight;
    if(sourceAspect>targetAspect){sw=image.naturalHeight*targetAspect;sx=(image.naturalWidth-sw)/2}else{sh=image.naturalWidth/targetAspect;sy=(image.naturalHeight-sh)/2}
    const canvas=document.createElement("canvas");canvas.width=targetWidth;canvas.height=targetHeight;
    const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Photo processing is unavailable in this browser.");
    ctx.drawImage(image,sx,sy,sw,sh,0,0,targetWidth,targetHeight);
    let dataUrl=canvas.toDataURL("image/jpeg",.78);
    if(dataUrl.length>620000)dataUrl=canvas.toDataURL("image/jpeg",.58);
    if(dataUrl.length>620000)throw new Error("This image remains too large after processing. Try another photo.");
    return dataUrl;
  }finally{URL.revokeObjectURL(url)}
}

export function AircraftPhotoEditor({aircraftId,hasPhoto,photoUpdatedAt,saveAction,removeAction}:{aircraftId:number;hasPhoto:boolean;photoUpdatedAt:string;saveAction:SavePhotoAction;removeAction:RemovePhotoAction}){
  const[state,action,pending]=useActionState(saveAction,{ok:false,message:""});
  const[payload,setPayload]=useState(""),[preview,setPreview]=useState(""),[error,setError]=useState("");
  const existingUrl=hasPhoto?`/api/aircraft-photo/${aircraftId}?v=${encodeURIComponent(photoUpdatedAt)}`:"";
  const choose=async(file?:File)=>{setError("");setPayload("");setPreview("");if(!file)return;try{const dataUrl=await renderCover(file);setPreview(dataUrl);setPayload(dataUrl.split(",",2)[1]||"")}catch(reason){setError(reason instanceof Error?reason.message:"Photo could not be processed.")}};
  return <section className="aircraft-photo-section">
    <div className="modal-section-heading"><div><p className="eyebrow">PHOTO</p><h3>Aircraft cover</h3><p className="muted">Optional. FlyTally crops the image to a lightweight 16:9 cover for your aircraft card.</p></div></div>
    <div className="aircraft-photo-editor">
      <div className={`aircraft-photo-preview${preview||existingUrl?" has-image":""}`} style={preview||existingUrl?{backgroundImage:`linear-gradient(180deg,transparent 35%,rgba(2,9,20,.66)),url("${preview||existingUrl}")`}:undefined}><span>{preview?"New cover":hasPhoto?"Current cover":"No photo"}</span></div>
      <div className="aircraft-photo-controls">
        <form action={action} className="stack-form">
          <input type="hidden" name="aircraft_id" value={aircraftId}/>
          <input type="hidden" name="photo_mime_type" value="image/jpeg"/>
          <input type="hidden" name="photo_base64" value={payload}/>
          <label>Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>void choose(event.target.files?.[0])}/><small>JPG, PNG or WebP. The original file is not stored; only the processed cover is saved.</small></label>
          <button className="primary-button" disabled={pending||!payload}>{pending?"Saving…":"Save cover photo"}</button>
          {error?<p className="form-error" role="alert">{error}</p>:null}{state.message?<p className={state.ok?"form-success":"form-error"} role="status">{state.message}</p>:null}
        </form>
        {hasPhoto?<form action={removeAction}><input type="hidden" name="aircraft_id" value={aircraftId}/><PendingActionButton className="secondary-button" pendingLabel="Removing…">Remove photo</PendingActionButton></form>:null}
      </div>
    </div>
  </section>;
}
