"use client";

import { PendingActionButton } from "@/components/pending-action-button";
import { PointerEvent as ReactPointerEvent,useActionState,useEffect,useRef,useState } from "react";

type PhotoState={ok:boolean;message:string};
type SavePhotoAction=(state:PhotoState,form:FormData)=>Promise<PhotoState>;
type RemovePhotoAction=(form:FormData)=>Promise<void>;
type SourcePhoto={url:string;width:number;height:number};

const OUTPUT_WIDTH=1200,OUTPUT_HEIGHT=675,OUTPUT_ASPECT=OUTPUT_WIDTH/OUTPUT_HEIGHT;

function loadPhoto(file:File):Promise<SourcePhoto>{
  if(file.size>12*1024*1024)return Promise.reject(new Error("Choose an image smaller than 12 MB."));
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))return Promise.reject(new Error("Use a JPG, PNG or WebP image."));
  const url=URL.createObjectURL(file);
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve({url,width:image.naturalWidth,height:image.naturalHeight});
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("The image could not be read."))};
    image.src=url;
  });
}

async function renderCover(source:SourcePhoto,zoom:number,offsetX:number,offsetY:number){
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("The image could not be read."));img.src=source.url});
  const sourceAspect=source.width/source.height;
  const baseWidth=sourceAspect>OUTPUT_ASPECT?source.height*OUTPUT_ASPECT:source.width;
  const baseHeight=baseWidth/OUTPUT_ASPECT;
  const sw=baseWidth/zoom,sh=baseHeight/zoom;
  const maxX=(source.width-sw)/2,maxY=(source.height-sh)/2;
  const sx=Math.max(0,Math.min(source.width-sw,(source.width-sw)/2-offsetX*maxX));
  const sy=Math.max(0,Math.min(source.height-sh,(source.height-sh)/2-offsetY*maxY));
  const canvas=document.createElement("canvas");canvas.width=OUTPUT_WIDTH;canvas.height=OUTPUT_HEIGHT;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Photo processing is unavailable in this browser.");
  ctx.drawImage(image,sx,sy,sw,sh,0,0,OUTPUT_WIDTH,OUTPUT_HEIGHT);
  let dataUrl=canvas.toDataURL("image/jpeg",.78);
  if(dataUrl.length>620000)dataUrl=canvas.toDataURL("image/jpeg",.58);
  if(dataUrl.length>620000)throw new Error("This image remains too large after processing. Try another photo.");
  return dataUrl;
}

export function AircraftPhotoEditor({aircraftId,hasPhoto,photoUpdatedAt,saveAction,removeAction}:{aircraftId:number;hasPhoto:boolean;photoUpdatedAt:string;saveAction:SavePhotoAction;removeAction:RemovePhotoAction}){
  const[state,action,pending]=useActionState(saveAction,{ok:false,message:""});
  const[payload,setPayload]=useState(""),[preview,setPreview]=useState(""),[error,setError]=useState("");
  const[source,setSource]=useState<SourcePhoto|null>(null),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0});
  const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
  const existingUrl=hasPhoto?`/api/aircraft-photo/${aircraftId}?v=${encodeURIComponent(photoUpdatedAt)}`:"";

  useEffect(()=>()=>{if(source)URL.revokeObjectURL(source.url)},[source]);

  const choose=async(file?:File)=>{
    setError("");setPayload("");setPreview("");
    if(source)URL.revokeObjectURL(source.url);
    setSource(null);setZoom(1);setOffset({x:0,y:0});
    if(!file)return;
    try{setSource(await loadPhoto(file))}catch(reason){setError(reason instanceof Error?reason.message:"Photo could not be processed.")}
  };
  const cancelCrop=()=>{if(source)URL.revokeObjectURL(source.url);setSource(null);setPayload("");setPreview("");setZoom(1);setOffset({x:0,y:0})};
  const applyCrop=async()=>{if(!source)return;try{const dataUrl=await renderCover(source,zoom,offset.x,offset.y);setPreview(dataUrl);setPayload(dataUrl.split(",",2)[1]||"");setSource(null)}catch(reason){setError(reason instanceof Error?reason.message:"Photo could not be processed.")}};
  const onPointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{if(!source)return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={x:event.clientX,y:event.clientY,ox:offset.x,oy:offset.y}};
  const onPointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{if(!drag.current)return;const rect=event.currentTarget.getBoundingClientRect();setOffset({x:Math.max(-1,Math.min(1,drag.current.ox+(event.clientX-drag.current.x)/(rect.width*.35))),y:Math.max(-1,Math.min(1,drag.current.oy+(event.clientY-drag.current.y)/(rect.height*.35)))})};
  const stopDrag=()=>{drag.current=null};
  const position=source?{x:50-offset.x*25,y:50-offset.y*25}:{x:50,y:50};

  return <section className="aircraft-photo-section">
    <div className="modal-section-heading"><div><p className="eyebrow">PHOTO</p><h3>Aircraft cover</h3><p className="muted">Optional. Choose how your photo should appear in the 16:9 aircraft cover.</p></div></div>
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
    {source?<div className="aircraft-crop-backdrop" role="dialog" aria-modal="true" aria-labelledby="aircraft-crop-title">
      <div className="aircraft-crop-dialog">
        <header><div><p className="eyebrow">SET COVER PHOTO</p><h3 id="aircraft-crop-title">Crop your aircraft cover</h3><p className="muted">Move the photo to choose the 16:9 cover. Zoom only when you need a tighter crop.</p></div><button type="button" className="aircraft-crop-close" aria-label="Close crop editor" onClick={cancelCrop}>×</button></header>
        <div className="aircraft-crop-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag} style={{backgroundImage:`url("${source.url}")`,backgroundSize:`${zoom*100}% auto`,backgroundPosition:`${position.x}% ${position.y}%`}}><div className="aircraft-crop-grid" aria-hidden="true"/></div>
        <div className="aircraft-crop-tools"><span aria-hidden="true">−</span><input aria-label="Photo zoom" type="range" min="1" max="2.5" step=".01" value={zoom} onChange={event=>setZoom(Number(event.target.value))}/><span aria-hidden="true">+</span><button type="button" className="secondary-button" onClick={()=>{setZoom(1);setOffset({x:0,y:0})}}>Fit to image</button></div>
        <footer><button type="button" className="secondary-button" onClick={cancelCrop}>Cancel</button><button type="button" className="primary-button" onClick={()=>void applyCrop()}>Use this crop</button></footer>
      </div>
    </div>:null}
  </section>;
}
