export function canonicalEvidenceJson(value:unknown):string{
  if(value===null)return"null";
  if(Array.isArray(value))return`[${value.map(canonicalEvidenceJson).join(",")}]`;
  if(typeof value==="object"){
    return`{${Object.entries(value as Record<string,unknown>)
      .sort(([left],[right])=>left.localeCompare(right))
      .map(([key,item])=>`${JSON.stringify(key)}:${canonicalEvidenceJson(item)}`)
      .join(",")}}`;
  }
  const encoded=JSON.stringify(value);
  return encoded===undefined?"null":encoded;
}
