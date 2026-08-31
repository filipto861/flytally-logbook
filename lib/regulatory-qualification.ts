const compact=(value:unknown)=>String(value??"").trim().toUpperCase().replace(/\s+/g,"");

/** Aeroplane IR only. Instructor certificates such as IRI(A) must never satisfy an IR privilege test. */
export function isAeroplaneIrQualification(value:unknown){
  const q=compact(value);
  if(q==="IR"||q==="IR(A)")return true;
  if(/^(?:SE|ME)[-\/]?IR\(A\)$/.test(q))return true;
  if(/^IR\(A\)[-\/]?(?:SE|ME)$/.test(q))return true;
  return false;
}
