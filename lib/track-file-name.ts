export function splitTrackFileName(fileName:string,index:number,total:number,maxLength=240){
  const source=(fileName||"track").trim()||"track";
  if(total<=1)return source.slice(0,maxLength);
  const slash=Math.max(source.lastIndexOf("/"),source.lastIndexOf("\\")),base=source.slice(slash+1)||"track",dot=base.lastIndexOf("."),hasExtension=dot>0&&base.length-dot<=8,extension=hasExtension?base.slice(dot):"",stem=hasExtension?base.slice(0,dot):base;
  const marker=`__part${Math.max(1,index+1)}-of-${Math.max(1,total)}`,room=Math.max(1,maxLength-marker.length-extension.length);
  return`${stem.slice(0,room)}${marker}${extension}`.slice(0,maxLength);
}
