"use client";

import { PendingActionButton } from "@/components/pending-action-button";
import { useRef,useState } from "react";

type Point=[number,number];
type Signature={version:1;width:900;height:260;strokes:Point[][]};
type Props={action:(formData:FormData)=>void|Promise<void>;defaultInstructor?:string;recordLabel?:string;allowExaminer?:boolean;defaultQualification?:string};

export function InPersonSignaturePad({action,defaultInstructor="",recordLabel="this exact certified revision",allowExaminer=false,defaultQualification="FI(A)"}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),strokesRef=useRef<Point[][]>([]),activeRef=useRef<Point[]|null>(null);
  const[hasSignature,setHasSignature]=useState(false);
  const point=(event:React.PointerEvent<HTMLCanvasElement>):Point=>{const canvas=canvasRef.current!,rect=canvas.getBoundingClientRect();return[Math.max(0,Math.min(900,(event.clientX-rect.left)*900/rect.width)),Math.max(0,Math.min(260,(event.clientY-rect.top)*260/rect.height))]};
  const drawSegment=(a:Point,b:Point)=>{const ctx=canvasRef.current?.getContext("2d");if(!ctx)return;ctx.strokeStyle="#0b1720";ctx.lineWidth=3;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke()};
  const start=(event:React.PointerEvent<HTMLCanvasElement>)=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);const p=point(event),stroke:[Point,...Point[]]=[p];activeRef.current=stroke;strokesRef.current.push(stroke);setHasSignature(true)};
  const move=(event:React.PointerEvent<HTMLCanvasElement>)=>{const stroke=activeRef.current;if(!stroke)return;event.preventDefault();const p=point(event),last=stroke[stroke.length-1];if(Math.hypot(p[0]-last[0],p[1]-last[1])<1.5)return;if(stroke.length>=4000)return;stroke.push(p);drawSegment(last,p)};
  const end=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(activeRef.current){event.preventDefault();activeRef.current=null}}
  const clear=()=>{strokesRef.current=[];activeRef.current=null;const canvas=canvasRef.current,ctx=canvas?.getContext("2d");if(canvas&&ctx)ctx.clearRect(0,0,canvas.width,canvas.height);setHasSignature(false)};
  const prepare=(event:React.FormEvent<HTMLFormElement>)=>{if(!hasSignature){event.preventDefault();return}const data:Signature={version:1,width:900,height:260,strokes:strokesRef.current.filter(stroke=>stroke.length)};const input=event.currentTarget.elements.namedItem("signature_json") as HTMLInputElement|null;if(input)input.value=JSON.stringify(data)};
  const signerNoun=allowExaminer?"instructor or examiner":"instructor";
  return <form action={action} onSubmit={prepare} className="stack-form">
    <div className="form-grid settings-grid">
      <label>{allowExaminer?"Instructor / examiner name":"Instructor name"} <span className="field-hint" aria-hidden="true">Required</span><input name="instructor_name" defaultValue={defaultInstructor} maxLength={120} required autoComplete="name"/></label>
      <label>Licence number <span className="field-hint" aria-hidden="true">Required</span><input name="licence_number" maxLength={80} required placeholder="e.g. CZ.FCL.PPA…"/></label>
      <label>Qualification <span className="field-hint" aria-hidden="true">Required</span><input name="qualification" maxLength={80} required defaultValue={defaultQualification}/></label>
      <label>FI / FE / certificate reference<input name="qualification_reference" maxLength={80} placeholder="Optional reference"/></label>
      {allowExaminer?<label>Sign as<select name="verification_role" defaultValue="INSTRUCTOR"><option value="INSTRUCTOR">Instructor</option><option value="EXAMINER">Examiner</option></select></label>:<input type="hidden" name="verification_role" value="INSTRUCTOR"/>}
    </div>
    <label><strong>Handwritten signature</strong><small>Use a mouse, finger or Apple Pencil. The signature is bound to {recordLabel}.</small></label>
    <canvas ref={canvasRef} width={900} height={260} aria-label={allowExaminer?"Instructor or examiner signature pad":"Instructor signature pad"} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{width:"100%",height:"180px",display:"block",background:"#fff",border:"1px solid #46616f",borderRadius:"8px",touchAction:"none",cursor:"crosshair"}}/>
    <input type="hidden" name="signature_json"/>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={clear}>Clear signature</button></div>
    <label className="checkbox-row"><input type="checkbox" name="confirm_in_person" value="yes" required/><span>The {signerNoun} confirms that they reviewed {recordLabel} and signs it in person on this device.</span></label>
    <p className="muted">FlyTally preserves the drawn signature and cryptographically binds it to {recordLabel}. The signer identity is entered in person and is not independently authenticated by a FlyTally account. FlyTally does not represent this capture as a qualified electronic signature (QES) or as an advanced electronic signature.</p>
    <PendingActionButton className="primary-button" disabled={!hasSignature} pendingLabel="Signing…">Confirm &amp; sign</PendingActionButton>
  </form>;
}
