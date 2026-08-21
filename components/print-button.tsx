"use client";
export function PrintButton(){return <button className="primary-button print-trigger" type="button" onClick={()=>window.print()}>Vytisknout / uložit PDF</button>}
