/**
 * GPS review presentation only. Missing source altitude must never be
 * presented or interpolated as a measured zero.
 */
export function finiteGpsAltitude(value:number|null|undefined):number|null{
  return typeof value==="number"&&Number.isFinite(value)?value:null;
}

export function interpolatedGpsAltitude(
  start:number|null|undefined,
  end:number|null|undefined,
  fraction:number
):number|null{
  if(!Number.isFinite(fraction)||fraction<0||fraction>1)return null;
  const a=finiteGpsAltitude(start),b=finiteGpsAltitude(end);
  if(fraction===0)return a;
  if(fraction===1)return b;
  return a!==null&&b!==null?a+(b-a)*fraction:null;
}

export function gpsAltitudeProfileGeometry(
  values:readonly (number|null|undefined)[],
  width:number,
  height:number,
  breakBefore:readonly boolean[]=[]
):{segments:string[];isolated:Array<{cx:number;cy:number}>}{
  const result:{segments:string[];isolated:Array<{cx:number;cy:number}>}={segments:[],isolated:[]};
  if(!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)return result;
  const alts=values.map(finiteGpsAltitude);
  const known=alts.filter((value):value is number=>value!==null);
  if(!known.length)return result;
  const lo=Math.min(...known,0),hi=Math.max(...known,1),range=hi-lo||1;
  const positions:Array<{cx:number;cy:number}>=[];
  const flush=()=>{
    if(positions.length>=2)result.segments.push(positions.map(({cx,cy})=>cx+","+cy).join(" "));
    else if(positions.length===1){const first=positions[0];if(first)result.isolated.push(first);}
    positions.length=0;
  };
  for(let index=0;index<alts.length;index++){
    if(breakBefore[index])flush();
    const altitude=alts[index];
    if(altitude===null){flush();continue}
    positions.push({
      cx:index/Math.max(1,alts.length-1)*width,
      cy:height-(altitude-lo)/range*height
    });
  }
  flush();
  return result;
}
