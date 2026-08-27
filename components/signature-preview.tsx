type Point=[number,number];
type Signature={version:1;width:number;height:number;strokes:Point[][]};

export function parseStoredSignature(value:unknown):Signature|null{
  const candidate=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;if(!candidate||candidate.version!==1)return null;
  const width=Number(candidate.width),height=Number(candidate.height),raw=candidate.strokes;if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Array.isArray(raw))return null;
  const strokes:Point[][]=[];for(const rawStroke of raw){if(!Array.isArray(rawStroke))continue;const stroke:Point[]=[];for(const rawPoint of rawStroke){if(!Array.isArray(rawPoint)||rawPoint.length!==2)continue;const x=Number(rawPoint[0]),y=Number(rawPoint[1]);if(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=width&&y>=0&&y<=height)stroke.push([x,y])}if(stroke.length)strokes.push(stroke)}
  return strokes.length?{version:1,width,height,strokes}:null;
}

export function SignaturePreview({signature}:{signature:unknown}){
  const parsed=parseStoredSignature(signature);if(!parsed)return null;
  return <div style={{maxWidth:"620px",padding:"10px",background:"#fff",borderRadius:"8px",border:"1px solid #46616f"}}><svg viewBox={`0 0 ${parsed.width} ${parsed.height}`} role="img" aria-label="Handwritten instructor signature" style={{display:"block",width:"100%",height:"auto"}}>{parsed.strokes.map((stroke,index)=>stroke.length===1?<circle key={index} cx={stroke[0][0]} cy={stroke[0][1]} r="2" fill="#0b1720"/>:<polyline key={index} points={stroke.map(point=>point.join(",")).join(" ")} fill="none" stroke="#0b1720" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}</svg></div>;
}
