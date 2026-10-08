function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==="object"){
    return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,stableValue(value[key])]));
  }
  return value;
}

export function stableJson(value){
  return JSON.stringify(stableValue(value));
}

export function reusableLedgerEntry(entry,{candidate,gate,evidenceClass,configuration,allowNA=false}={}){
  if(!entry)return {reusable:false,reason:"missing"};
  if(entry.schemaVersion!==2)return {reusable:false,reason:"ledger-schema"};
  if(entry?.candidate?.candidateId!==candidate?.candidateId)return {reusable:false,reason:"candidate"};
  if(entry.gate!==gate)return {reusable:false,reason:"gate"};
  if(evidenceClass!==undefined&&(entry.evidenceClass??null)!==(evidenceClass??null)){
    return {reusable:false,reason:"evidence-class"};
  }
  if(entry.exitCode!==0)return {reusable:false,reason:"exit-code"};
  const status=entry?.evaluation?.status;
  if(status!=="PASS"&&!(allowNA&&status==="N/A"))return {reusable:false,reason:"evaluation"};
  if(stableJson(entry.effectiveConfiguration??null)!==stableJson(configuration??null)){
    return {reusable:false,reason:"configuration"};
  }
  return {reusable:true,reason:"exact-match"};
}
