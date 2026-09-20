"use client";

import { PendingActionButton } from "@/components/pending-action-button";
import { PointerEvent as ReactPointerEvent,useActionState,useEffect,useRef,useState } from "react";

type PhotoState={ok:boolean;message:string};
type SavePhotoAction=(state:PhotoState,form:FormData)=>Promise<PhotoState>;
type RemovePhotoAction=(form:FormData)=>Promise<void>;
type SourcePhoto={url:string;width:number;height:number;image:HTMLImageElement};
type CropOffset={x:number;y:number};
type CoverMode="fit"|"crop";

const OUTPUT_WIDTH=1200,OUTPUT_HEIGHT=675,OUTPUT_ASPECT=OUTPUT_WIDTH/OUTPUT_HEIGHT;
const PREVIEW_WIDTH=960,PREVIEW_HEIGHT=540;

const clamp=(value:number,min=-1,max=1)=>Math.max(min,Math.min(max,value));

function loadPhoto(file:File):Promise<SourcePhoto>{
  if(file.size>12*1024*1024)return Promise.reject(new Error("Choose an image smaller than 12 MB."));
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))return Promise.reject(new Error("Use a JPG, PNG or WebP image."));
  const url=URL.createObjectURL(file);
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve({url,width:image.naturalWidth,height:image.naturalHeight,image});
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("The image could not be read."))};
    image.src=url;
  });
}

function getCropRect(source:SourcePhoto,zoom:number,offsetX:number,offsetY:number){
  const sourceAspect=source.width/source.height;
  let baseWidth:number,baseHeight:number;
  if(sourceAspect>OUTPUT_ASPECT){baseHeight=source.height;baseWidth=baseHeight*OUTPUT_ASPECT}
  else{baseWidth=source.width;baseHeight=baseWidth/OUTPUT_ASPECT}
  const sw=baseWidth/zoom,sh=baseHeight/zoom;
  const travelX=Math.max(0,source.width-sw),travelY=Math.max(0,source.height-sh);
  const sx=travelX/2-clamp(offsetX)*travelX/2;
  const sy=travelY/2-clamp(offsetY)*travelY/2;
  return{sx,sy,sw,sh};
}

function drawContainedCover(ctx:CanvasRenderingContext2D,source:SourcePhoto,width:number,height:number){
  const coverScale=Math.max(width/source.width,height/source.height)*1.08;
  const coverWidth=source.width*coverScale,coverHeight=source.height*coverScale;
  ctx.save();
  ctx.filter="blur(22px) brightness(.55)";
  ctx.drawImage(source.image,(width-coverWidth)/2,(height-coverHeight)/2,coverWidth,coverHeight);
  ctx.restore();
  ctx.fillStyle="rgba(4,12,22,.18)";
  ctx.fillRect(0,0,width,height);

  const fitScale=Math.min(width/source.width,height/source.height);
  const fitWidth=source.width*fitScale,fitHeight=source.height*fitScale;
  ctx.drawImage(source.image,(width-fitWidth)/2,(height-fitHeight)/2,fitWidth,fitHeight);
}

function drawCover(canvas:HTMLCanvasElement,source:SourcePhoto,mode:CoverMode,zoom:number,offset:CropOffset,width:number,height:number){
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Photo processing is unavailable in this browser.");
  ctx.clearRect(0,0,width,height);
  if(mode==="fit"){drawContainedCover(ctx,source,width,height);return}
  const{sx,sy,sw,sh}=getCropRect(source,zoom,offset.x,offset.y);
  ctx.drawImage(source.image,sx,sy,sw,sh,0,0,width,height);
}

function renderCover(source:SourcePhoto,mode:CoverMode,zoom:number,offset:CropOffset){
  const canvas=document.createElement("canvas");
  drawCover(canvas,source,mode,zoom,offset,OUTPUT_WIDTH,OUTPUT_HEIGHT);
  let dataUrl=canvas.toDataURL("image/jpeg",.78);
  if(dataUrl.length>620000)dataUrl=canvas.toDataURL("image/jpeg",.58);
  if(dataUrl.length>620000)throw new Error("This image remains too large after processing. Try another photo.");
  return dataUrl;
}

export function AircraftPhotoEditor({aircraftId,hasPhoto,photoUpdatedAt,saveAction,removeAction}:{aircraftId:number;hasPhoto:boolean;photoUpdatedAt:string;saveAction:SavePhotoAction;removeAction:RemovePhotoAction}){
  const[state,action,pending]=useActionState(saveAction,{ok:false,message:""});
  const[payload,setPayload]=useState(""),[preview,setPreview]=useState(""),[error,setError]=useState("");
  const[source,setSource]=useState<SourcePhoto|null>(null),[mode,setMode]=useState<CoverMode>("fit"),[zoom,setZoom]=useState(1),[offset,setOffset]=useState<CropOffset>({x:0,y:0});
  const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
  const cropCanvas=useRef<HTMLCanvasElement|null>(null),cropDialog=useRef<HTMLDivElement|null>(null),cropClose=useRef<HTMLButtonElement|null>(null),cropOpener=useRef<HTMLElement|null>(null);
  const existingUrl=hasPhoto?`/api/aircraft-photo/${aircraftId}?v=${encodeURIComponent(photoUpdatedAt)}`:"";
  const restoreCropFocus=()=>requestAnimationFrame(()=>cropOpener.current?.focus());
  const cancelCover=()=>{setSource(null);setPayload("");setPreview("");setMode("fit");setZoom(1);setOffset({x:0,y:0});restoreCropFocus()};

  useEffect(()=>()=>{if(source)URL.revokeObjectURL(source.url)},[source]);
  useEffect(()=>{
    if(!source)return;
    requestAnimationFrame(()=>cropClose.current?.focus());
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();cancelCover();return}
      if(event.key!=="Tab"||!cropDialog.current)return;
      const controls=[...cropDialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(node=>!node.hasAttribute("hidden")&&node.getAttribute("aria-hidden")!=="true");
      if(!controls.length){event.preventDefault();cropClose.current?.focus();return}
      const first=controls[0],last=controls.at(-1)!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    document.addEventListener("keydown",keydown);
    return()=>document.removeEventListener("keydown",keydown);
  },[source]);
  useEffect(()=>{
    if(!source||!cropCanvas.current)return;
    try{drawCover(cropCanvas.current,source,mode,zoom,offset,PREVIEW_WIDTH,PREVIEW_HEIGHT)}
    catch(reason){setError(reason instanceof Error?reason.message:"Photo could not be previewed.")}
  },[source,mode,zoom,offset]);

  const choose=async(file?:File)=>{
    setError("");setPayload("");setPreview("");setSource(null);setMode("fit");setZoom(1);setOffset({x:0,y:0});
    if(!file)return;
    try{setSource(await loadPhoto(file))}catch(reason){setError(reason instanceof Error?reason.message:"Photo could not be processed.")}
  };
  const applyCover=()=>{if(!source)return;try{const dataUrl=renderCover(source,mode,zoom,offset);setPreview(dataUrl);setPayload(dataUrl.split(",",2)[1]||"");setSource(null);restoreCropFocus()}catch(reason){setError(reason instanceof Error?reason.message:"Photo could not be processed.")}};
  const onPointerDown=(event:ReactPointerEvent<HTMLCanvasElement>)=>{if(!source||mode!=="crop")return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={x:event.clientX,y:event.clientY,ox:offset.x,oy:offset.y}};
  const onPointerMove=(event:ReactPointerEvent<HTMLCanvasElement>)=>{
    if(!drag.current||mode!=="crop")return;
    const rect=event.currentTarget.getBoundingClientRect();
    setOffset({x:clamp(drag.current.ox+(event.clientX-drag.current.x)/(rect.width*.5)),y:clamp(drag.current.oy+(event.clientY-drag.current.y)/(rect.height*.5))});
  };
  const stopDrag=()=>{drag.current=null};
  const previewStyle=preview||existingUrl?{
    backgroundImage:`linear-gradient(180deg,transparent 35%,rgba(2,9,20,.66)),url("${preview||existingUrl}")`,
    backgroundSize:"100% 100%, contain",
    backgroundPosition:"center, center",
    backgroundRepeat:"no-repeat"
  }:undefined;

  return <section className="aircraft-photo-section">
    <div className="modal-section-heading"><div><p className="eyebrow">PHOTO</p><h3>Aircraft cover</h3><p className="muted">Optional. By default FlyTally fits the whole photo into the cover without cutting anything off.</p></div></div>
    <div className="aircraft-photo-editor">
      <div className={`aircraft-photo-preview${preview||existingUrl?" has-image":""}`} style={previewStyle}><span>{preview?"New cover":hasPhoto?"Current cover":"No photo"}</span></div>
      <div className="aircraft-photo-controls">
        <form action={action} className="stack-form">
          <input type="hidden" name="aircraft_id" value={aircraftId}/>
          <input type="hidden" name="photo_mime_type" value="image/jpeg"/>
          <input type="hidden" name="photo_base64" value={payload}/>
          <label>Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{cropOpener.current=event.currentTarget;void choose(event.target.files?.[0])}}/><small>JPG, PNG or WebP. The original file is not stored; only the processed cover is saved.</small></label>
          <button className="primary-button" disabled={pending||!payload}>{pending?"Saving…":"Save cover photo"}</button>
          {error?<p className="form-error" role="alert">{error}</p>:null}{state.message?<p className={state.ok?"form-success":"form-error"} role="status">{state.message}</p>:null}
        </form>
        {hasPhoto?<form action={removeAction}><input type="hidden" name="aircraft_id" value={aircraftId}/><PendingActionButton className="secondary-button" pendingLabel="Removing…">Remove photo</PendingActionButton></form>:null}
      </div>
    </div>
    {source?<div className="aircraft-crop-backdrop" role="dialog" aria-modal="true" aria-labelledby="aircraft-crop-title">
      <div ref={cropDialog} className="aircraft-crop-dialog">
        <header><div><p className="eyebrow">SET COVER PHOTO</p><h3 id="aircraft-crop-title">Adjust aircraft cover</h3><p className="muted">{mode==="fit"?"The complete photo is kept visible. Nothing is cropped.":"Crop to fill is optional. What you see is exactly what will be saved."}</p></div><button ref={cropClose} type="button" className="aircraft-crop-close" aria-label="Close photo editor" onClick={cancelCover}>×</button></header>
        <div className="aircraft-cover-mode" role="group" aria-label="Cover photo mode">
          <button type="button" className={mode==="fit"?"active":""} aria-pressed={mode==="fit"} onClick={()=>{setMode("fit");setZoom(1);setOffset({x:0,y:0})}}>Fit whole photo</button>
          <button type="button" className={mode==="crop"?"active":""} aria-pressed={mode==="crop"} onClick={()=>setMode("crop")}>Crop to fill</button>
        </div>
        <div className={`aircraft-crop-stage ${mode==="fit"?"fit-mode":"crop-mode"}`}>
          <canvas ref={cropCanvas} width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} aria-label="Aircraft cover preview"/>
          {mode==="crop"?<div className="aircraft-crop-grid" aria-hidden="true"/>:null}
        </div>
        {mode==="crop"?<div className="aircraft-crop-tools"><span aria-hidden="true">−</span><input aria-label="Photo zoom" type="range" min="1" max="2.5" step=".01" value={zoom} onChange={event=>setZoom(Number(event.target.value))}/><span aria-hidden="true">+</span><button type="button" className="secondary-button" onClick={()=>{setZoom(1);setOffset({x:0,y:0})}}>Reset crop</button></div>:<p className="aircraft-fit-note">The blurred side/background fill is only used where the source photo is not 16:9, so the aircraft stays fully visible.</p>}
        <footer><button type="button" className="secondary-button" onClick={cancelCover}>Cancel</button><button type="button" className="primary-button" onClick={applyCover}>Use this photo</button></footer>
      </div>
    </div>:null}
  </section>;
}
