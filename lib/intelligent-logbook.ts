export type IntelligentFlightHistory={
  id:number;date:string;registration:string;departure:string;arrival:string;offBlock:string;onBlock:string;takeoff?:string;landing?:string;blockMinutes:number;certified?:boolean;
};
export type IntelligentFlightDraft={date?:unknown;registration?:unknown;departure?:unknown;arrival?:unknown;offBlock?:unknown;onBlock?:unknown;takeoff?:unknown;landing?:unknown};
export type IntelligentInsightTone="attention"|"warning"|"info";
export type IntelligentInsight={code:string;tone:IntelligentInsightTone;title:string;message:string};
export type ContinuationSuggestion={airport:string;date:string;registration:string;flightId:number};

const text=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>text(value).toUpperCase();
const validTime=(value:unknown)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(text(value));
const clock=(value:unknown)=>Number(text(value).slice(0,2))*60+Number(text(value).slice(3));
export const intelligentMinutes=(start:unknown,end:unknown)=>validTime(start)&&validTime(end)?(clock(end)-clock(start)+1440)%1440:0;
const median=(values:number[])=>{const sorted=values.filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);if(!sorted.length)return 0;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2};
const hm=(minutes:number)=>`${Math.floor(minutes/60)}:${String(Math.round(minutes)%60).padStart(2,"0")}`;
const identity=(row:IntelligentFlightDraft)=>[text(row.date).slice(0,10),upper(row.registration),text(row.offBlock),upper(row.departure),upper(row.arrival)].join("|");
const identityComplete=(row:IntelligentFlightDraft)=>Boolean(text(row.date)&&upper(row.registration)&&text(row.offBlock)&&upper(row.departure)&&upper(row.arrival));

export function latestContinuationSuggestion(history:IntelligentFlightHistory[]):ContinuationSuggestion|null{
  const latest=history.find(row=>upper(row.arrival));
  return latest?{airport:upper(latest.arrival),date:text(latest.date).slice(0,10),registration:upper(latest.registration),flightId:Number(latest.id)||0}:null;
}

export function intelligentFlightReview(draft:IntelligentFlightDraft,history:IntelligentFlightHistory[]):IntelligentInsight[]{
  const insights:IntelligentInsight[]=[];
  if(identityComplete(draft)){
    const fingerprint=identity(draft),duplicate=history.find(row=>identity({date:row.date,registration:row.registration,offBlock:row.offBlock,departure:row.departure,arrival:row.arrival})===fingerprint);
    if(duplicate)insights.push({code:"exact_duplicate",tone:"attention",title:"Possible duplicate",message:`Flight ${duplicate.date} · ${upper(duplicate.registration)} · ${upper(duplicate.departure)} → ${upper(duplicate.arrival)} already exists in your logbook.`});
  }

  const block=intelligentMinutes(draft.offBlock,draft.onBlock),air=intelligentMinutes(draft.takeoff,draft.landing);
  if(block>0&&air>block)insights.push({code:"air_exceeds_block",tone:"attention",title:"Timeline needs review",message:`AIR time ${hm(air)} is longer than BLOCK time ${hm(block)}. Check off-block, take-off, landing and on-block times.`});
  if(block>0&&validTime(draft.takeoff)){
    const takeoffOffset=intelligentMinutes(draft.offBlock,draft.takeoff);
    if(takeoffOffset>block)insights.push({code:"takeoff_outside_block",tone:"attention",title:"Take-off is outside BLOCK",message:"The recorded take-off time falls outside the off-block to on-block interval."});
  }
  if(block>0&&validTime(draft.landing)){
    const landingOffset=intelligentMinutes(draft.offBlock,draft.landing);
    if(landingOffset>block)insights.push({code:"landing_outside_block",tone:"attention",title:"Landing is outside BLOCK",message:"The recorded landing time falls outside the off-block to on-block interval."});
  }

  const registration=upper(draft.registration);
  if(registration&&block>=30){
    const samples=history.filter(row=>upper(row.registration)===registration&&row.blockMinutes>=20).slice(0,20).map(row=>row.blockMinutes);
    const typical=median(samples);
    if(samples.length>=5&&typical>=30&&block>=Math.max(typical*2.5,typical+120))insights.push({code:"duration_outlier",tone:"warning",title:"Much longer than your usual flight",message:`BLOCK ${hm(block)} is well above your recent ${registration} median of ${hm(typical)}. This is only a history-based check; keep the value if it is correct.`});
  }
  return insights;
}
