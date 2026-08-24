"use client";
export function PrintButton({disabled=false,title}:{disabled?:boolean;title?:string}){return <button className="primary-button print-trigger" type="button" disabled={disabled} title={title} onClick={()=>{if(!disabled)window.print()}}>{disabled?"Resolve compliance issues":"Print / save PDF"}</button>}
