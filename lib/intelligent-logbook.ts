export type IntelligentFlightHistory={
  id:number;
  date:string;
  registration:string;
  aircraftType?:string;
  aircraftClass?:string;
  regulatoryCategory?:string;
  evidence?:string;
  role?:string;
  operationType?:string;
  engineType?:string;
  operatorName?:string;
  flightNumber?:string;
  operationContext?:string;
  departure:string;
  arrival:string;
  offBlock:string;
  onBlock:string;
  takeoff?:string;
  landing?:string;
  blockMinutes:number;
  starts?:number;
  landingsDay?:number;
  landingsNight?:number;
  movementEvidenceRecorded?:boolean;
  takeoffsDay?:number;
  takeoffsNight?:number;
  approachesDay?:number;
  approachesNight?:number;
  certified?:boolean;
};

export type IntelligentFlightDraft={
  date?:unknown;
  registration?:unknown;
  aircraftType?:unknown;
  aircraftClass?:unknown;
  regulatoryCategory?:unknown;
  evidence?:unknown;
  role?:unknown;
  operationType?:unknown;
  engineType?:unknown;
  operatorName?:unknown;
  flightNumber?:unknown;
  operationContext?:unknown;
  departure?:unknown;
  arrival?:unknown;
  offBlock?:unknown;
  onBlock?:unknown;
  takeoff?:unknown;
  landing?:unknown;
  starts?:unknown;
  landingsDay?:unknown;
  landingsNight?:unknown;
  movementEvidenceRecorded?:unknown;
  takeoffsDay?:unknown;
  takeoffsNight?:unknown;
  approachesDay?:unknown;
  approachesNight?:unknown;
};

export type IntelligentInsightTone="attention"|"warning"|"info";
export type IntelligentEvidence={label:string;value:string};
export type IntelligentInsight={code:string;tone:IntelligentInsightTone;title:string;message:string;evidence?:IntelligentEvidence[]};
export type ContinuationSuggestion={airport:string;date:string;registration:string;flightId:number};
export type IntelligentAttentionFlight={flightId:number;date:string;registration:string;route:string;insights:IntelligentInsight[]};

const text=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>text(value).toUpperCase();
const validTime=(value:unknown)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(text(value));
const clock=(value:unknown)=>Number(text(value).slice(0,2))*60+Number(text(value).slice(3));
const count=(value:unknown)=>Math.max(0,Number.parseInt(text(value)||"0",10)||0);
const yes=(value:unknown)=>value===true||["1","true","yes","on"].includes(text(value).toLowerCase());

export const intelligentMinutes=(start:unknown,end:unknown)=>validTime(start)&&validTime(end)?(clock(end)-clock(start)+1440)%1440:0;

const median=(values:number[])=>{
  const sorted=values.filter(value=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);
  if(!sorted.length)return 0;
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};
const hm=(minutes:number)=>`${Math.floor(minutes/60)}:${String(Math.round(minutes)%60).padStart(2,"0")}`;
const identity=(row:IntelligentFlightDraft)=>[text(row.date).slice(0,10),upper(row.registration),text(row.offBlock),upper(row.departure),upper(row.arrival)].join("|");
const identityComplete=(row:IntelligentFlightDraft)=>Boolean(text(row.date)&&upper(row.registration)&&text(row.offBlock)&&upper(row.departure)&&upper(row.arrival));
const completeRoute=(row:IntelligentFlightDraft)=>Boolean(text(row.date)&&upper(row.registration)&&upper(row.departure)&&upper(row.arrival));
const evidence=(...items:Array<[string,unknown]>)=>items.filter(([,value])=>text(value)!=="").map(([label,value])=>({label,value:text(value)}));

function dominant(values:string[]){
  const normalized=values.map(upper).filter(Boolean);
  if(!normalized.length)return null;
  const counts=new Map<string,number>();
  for(const value of normalized)counts.set(value,(counts.get(value)||0)+1);
  const [value,total]=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
  return{value,total,samples:normalized.length};
}

function profileReview(draft:IntelligentFlightDraft,history:IntelligentFlightHistory[]):IntelligentInsight[]{
  const registration=upper(draft.registration);
  if(!registration)return[];
  const same=history.filter(row=>upper(row.registration)===registration).slice(0,30);
  if(same.length<3)return[];
  const checks:Array<{code:string;label:string;candidate:unknown;values:string[]}>= [
    {code:"aircraft_class",label:"aircraft class",candidate:draft.aircraftClass,values:same.map(row=>row.aircraftClass||"")},
    {code:"regulatory_category",label:"regulatory category",candidate:draft.regulatoryCategory,values:same.map(row=>row.regulatoryCategory||"")},
    {code:"evidence",label:"logbook",candidate:draft.evidence,values:same.map(row=>row.evidence||"")},
    {code:"engine_type",label:"engine type",candidate:draft.engineType,values:same.map(row=>row.engineType||"")},
  ];
  const insights:IntelligentInsight[]=[];
  for(const check of checks){
    const candidate=upper(check.candidate),usual=dominant(check.values);
    if(!candidate||!usual||usual.samples<3||usual.total<3||usual.total/usual.samples<0.8||candidate===usual.value)continue;
    insights.push({
      code:`registration_profile_${check.code}`,
      tone:"warning",
      title:`${registration} differs from its usual profile`,
      message:`This entry uses ${check.label} ${candidate}, while ${usual.total} of ${usual.samples} recent ${registration} records use ${usual.value}. Keep the current value if the aircraft profile really changed.`,
      evidence:[{label:"Current entry",value:candidate},{label:`Recent ${registration}`,value:`${usual.value} · ${usual.total}/${usual.samples}`}],
    });
  }
  return insights;
}

function movementReview(draft:IntelligentFlightDraft,history:IntelligentFlightHistory[],block:number):IntelligentInsight[]{
  const takeoffs=count(draft.takeoffsDay)+count(draft.takeoffsNight),landings=count(draft.landingsDay)+count(draft.landingsNight),approaches=count(draft.approachesDay)+count(draft.approachesNight),legacyStarts=count(draft.starts),movement=Math.max(takeoffs,landings,legacyStarts);
  const insights:IntelligentInsight[]=[];
  const explicitMovements=yes(draft.movementEvidenceRecorded)||["SAILPLANE","BALLOON"].includes(upper(draft.regulatoryCategory))||upper(draft.aircraftClass)==="TMG";
  if(explicitMovements&&takeoffs>0&&landings>0&&Math.abs(takeoffs-landings)>2){
    insights.push({code:"movement_count_gap",tone:"warning",title:"Take-off and landing counts differ substantially",message:`The entry contains ${takeoffs} take-off(s) and ${landings} landing(s). That can be valid, but the difference is large enough to review before saving.`,evidence:evidence(["Take-offs",takeoffs],["Landings",landings],["Approaches",approaches])});
  }
  if(movement>40){
    insights.push({code:"movement_count_high",tone:"warning",title:"Very high movement count",message:`This single flight contains ${movement} recorded movement(s). Check that a cumulative or day total was not entered by mistake.`,evidence:evidence(["Take-offs",takeoffs],["Landings",landings],["Starts / legacy landings",legacyStarts])});
  }
  if(block>0&&movement>=8&&block<movement*2){
    insights.push({code:"movement_density_high",tone:"warning",title:"Movement count is high for the recorded time",message:`${movement} movement(s) are recorded in BLOCK ${hm(block)} — less than two BLOCK minutes per movement. Check the counters and timeline.`,evidence:evidence(["BLOCK",hm(block)],["Movements",movement])});
  }
  const registration=upper(draft.registration);
  if(registration&&movement>0){
    const samples=history.filter(row=>upper(row.registration)===registration).slice(0,30).map(row=>Math.max(Number(row.starts)||0,(Number(row.landingsDay)||0)+(Number(row.landingsNight)||0))).filter(value=>value>0);
    const typical=median(samples);
    if(samples.length>=5&&typical>0&&movement>=Math.max(typical*4,typical+8)){
      insights.push({code:"movement_history_outlier",tone:"warning",title:"Movement count is far above this aircraft's recent pattern",message:`This entry records ${movement} movement(s); the recent ${registration} median is ${typical} per flight. This is a history check only.`,evidence:[{label:"Current entry",value:String(movement)},{label:`Recent ${registration} median`,value:String(typical)}]});
    }
  }
  return insights;
}

function roleAndProfessionalReview(draft:IntelligentFlightDraft):IntelligentInsight[]{
  const insights:IntelligentInsight[]=[],role=upper(draft.role),operationType=upper(draft.operationType),category=upper(draft.regulatoryCategory),logbook=upper(draft.evidence),operationContext=upper(draft.operationContext),operatorName=text(draft.operatorName),flightNumber=upper(draft.flightNumber);
  if(["CO-PILOT","CRUISE-RELIEF CO-PILOT"].includes(role)&&operationType&&operationType!=="MP"){
    insights.push({code:"copilot_single_pilot",tone:"attention",title:"Co-pilot role conflicts with single-pilot operation",message:`Role ${role} is recorded while Operation is ${operationType}. Review the explicit role or SP/MP selection; FlyTally will not change either value.`,evidence:evidence(["Role",role],["Operation",operationType],["Category",category])});
  }
  if(role==="SOLO"&&operationType==="MP"){
    insights.push({code:"solo_multi_pilot",tone:"attention",title:"SOLO conflicts with multi-pilot operation",message:"The flight is explicitly marked SOLO and MP at the same time. Review those two pilot-entered fields before saving.",evidence:evidence(["Role",role],["Operation",operationType],["Category",category])});
  }
  const professionalFields=Boolean(operationContext||operatorName||flightNumber),professionalSupported=logbook==="EASA"&&["AEROPLANE","HELICOPTER"].includes(category);
  if(professionalFields&&!professionalSupported){
    insights.push({code:"professional_context_scope",tone:"attention",title:"Professional context is outside its supported logbook scope",message:"Professional context is stored only for EASA aeroplane/helicopter entries. Review the explicit logbook/category or remove the professional fields; FlyTally will not infer a regulatory context.",evidence:evidence(["Logbook",logbook],["Category",category],["Operation context",operationContext],["Operator",operatorName])});
  }else if(professionalSupported){
    if(operationContext&&!operatorName){
      insights.push({code:"professional_operator_missing",tone:"info",title:"Professional context has no operator",message:`Operation context ${operationContext} is explicit, but Operator / employer is blank. Add it if you want the professional record to be easier to audit later.`,evidence:evidence(["Operation context",operationContext],["Flight number",flightNumber])});
    }else if(operatorName&&!operationContext){
      insights.push({code:"professional_operation_missing",tone:"info",title:"Operator is recorded without operation context",message:"An operator is present but the optional operation context is not specified. Leave it blank if unknown rather than guessing CAT, NCC or SPO.",evidence:evidence(["Operator",operatorName],["Flight number",flightNumber])});
    }
  }
  return insights;
}

export function latestContinuationSuggestion(history:IntelligentFlightHistory[]):ContinuationSuggestion|null{
  const latest=history.find(row=>upper(row.arrival));
  return latest?{airport:upper(latest.arrival),date:text(latest.date).slice(0,10),registration:upper(latest.registration),flightId:Number(latest.id)||0}:null;
}

export function intelligentFlightReview(draft:IntelligentFlightDraft,history:IntelligentFlightHistory[]):IntelligentInsight[]{
  const insights:IntelligentInsight[]=[];
  if(identityComplete(draft)){
    const fingerprint=identity(draft),duplicate=history.find(row=>identity({date:row.date,registration:row.registration,offBlock:row.offBlock,departure:row.departure,arrival:row.arrival})===fingerprint);
    if(duplicate)insights.push({code:"exact_duplicate",tone:"attention",title:"Possible duplicate",message:`Flight ${duplicate.date} · ${upper(duplicate.registration)} · ${upper(duplicate.departure)} → ${upper(duplicate.arrival)} already exists in your logbook.`,evidence:[{label:"Existing record",value:`#${duplicate.id}`},{label:"Fingerprint",value:`${duplicate.date} · ${upper(duplicate.registration)} · ${text(duplicate.offBlock)} · ${upper(duplicate.departure)} → ${upper(duplicate.arrival)}`} ]});
  }

  const off=text(draft.offBlock),on=text(draft.onBlock),takeoff=text(draft.takeoff),landing=text(draft.landing);
  if(Boolean(off)!==Boolean(on))insights.push({code:"incomplete_block_pair",tone:"attention",title:"BLOCK timeline is incomplete",message:"Off-block and On-block should be reviewed as a pair. One value is present and the other is missing.",evidence:evidence(["Off-block",off],["On-block",on])});
  else if(completeRoute(draft)&&!off&&!on)insights.push({code:"missing_block_times",tone:"warning",title:"No BLOCK times recorded",message:"The flight identity and route are filled in, but both BLOCK times are blank. Leave them blank only when that is intentional.",evidence:evidence(["Route",`${upper(draft.departure)} → ${upper(draft.arrival)}`],["Registration",upper(draft.registration)])});
  if(Boolean(takeoff)!==Boolean(landing))insights.push({code:"incomplete_air_pair",tone:"attention",title:"AIR timeline is incomplete",message:"Take-off and Landing should be reviewed as a pair. One value is present and the other is missing.",evidence:evidence(["Take-off",takeoff],["Landing",landing])});
  for(const [label,value] of [["Off-block",off],["On-block",on],["Take-off",takeoff],["Landing",landing]] as Array<[string,string]>)if(value&&!validTime(value))insights.push({code:`invalid_time_${label.toLowerCase().replace(/[^a-z]+/g,"_")}`,tone:"attention",title:`${label} time is not valid`,message:`${label} must use a valid 24-hour HH:MM time.`,evidence:[{label,value}]});

  const block=intelligentMinutes(off,on),air=intelligentMinutes(takeoff,landing);
  if(off&&on&&validTime(off)&&validTime(on)&&block===0)insights.push({code:"zero_block",tone:"warning",title:"BLOCK time is zero",message:"Off-block and On-block are identical. Review the timeline if this was an actual flight.",evidence:evidence(["Off-block",off],["On-block",on])});
  if(block>0&&air>block)insights.push({code:"air_exceeds_block",tone:"attention",title:"Timeline needs review",message:`AIR time ${hm(air)} is longer than BLOCK time ${hm(block)}. Check off-block, take-off, landing and on-block times.`,evidence:evidence(["BLOCK",hm(block)],["AIR",hm(air)])});
  if(block>0&&validTime(takeoff)){
    const takeoffOffset=intelligentMinutes(off,takeoff);
    if(takeoffOffset>block)insights.push({code:"takeoff_outside_block",tone:"attention",title:"Take-off is outside BLOCK",message:"The recorded take-off time falls outside the off-block to on-block interval.",evidence:evidence(["Off-block",off],["Take-off",takeoff],["On-block",on])});
    else if(takeoffOffset>180)insights.push({code:"taxi_out_long",tone:"warning",title:"Taxi-out exceeds three hours",message:`The interval from Off-block to Take-off is ${hm(takeoffOffset)}. Review the timeline if that was not intentional.`,evidence:evidence(["Off-block",off],["Take-off",takeoff])});
  }
  if(block>0&&validTime(landing)){
    const landingOffset=intelligentMinutes(off,landing);
    if(landingOffset>block)insights.push({code:"landing_outside_block",tone:"attention",title:"Landing is outside BLOCK",message:"The recorded landing time falls outside the off-block to on-block interval.",evidence:evidence(["Off-block",off],["Landing",landing],["On-block",on])});
    else{
      const taxiIn=intelligentMinutes(landing,on);
      if(taxiIn>180&&taxiIn<=block)insights.push({code:"taxi_in_long",tone:"warning",title:"Taxi-in exceeds three hours",message:`The interval from Landing to On-block is ${hm(taxiIn)}. Review the timeline if that was not intentional.`,evidence:evidence(["Landing",landing],["On-block",on])});
    }
  }

  const registration=upper(draft.registration);
  if(registration&&block>=30){
    const samples=history.filter(row=>upper(row.registration)===registration&&row.blockMinutes>=20).slice(0,20).map(row=>row.blockMinutes),typical=median(samples);
    if(samples.length>=5&&typical>=30&&block>=Math.max(typical*2.5,typical+120))insights.push({code:"duration_outlier",tone:"warning",title:"Much longer than your usual flight",message:`BLOCK ${hm(block)} is well above your recent ${registration} median of ${hm(typical)}. This is only a history-based check; keep the value if it is correct.`,evidence:[{label:"Current BLOCK",value:hm(block)},{label:`Recent ${registration} median`,value:`${hm(typical)} · ${samples.length} samples`} ]});
  }

  insights.push(...movementReview(draft,history,block),...roleAndProfessionalReview(draft),...profileReview(draft,history));
  return insights;
}

function historyDraft(row:IntelligentFlightHistory):IntelligentFlightDraft{
  return{date:row.date,registration:row.registration,aircraftType:row.aircraftType,aircraftClass:row.aircraftClass,regulatoryCategory:row.regulatoryCategory,evidence:row.evidence,role:row.role,operationType:row.operationType,engineType:row.engineType,operatorName:row.operatorName,flightNumber:row.flightNumber,operationContext:row.operationContext,departure:row.departure,arrival:row.arrival,offBlock:row.offBlock,onBlock:row.onBlock,takeoff:row.takeoff,landing:row.landing,starts:row.starts,landingsDay:row.landingsDay,landingsNight:row.landingsNight,movementEvidenceRecorded:row.movementEvidenceRecorded,takeoffsDay:row.takeoffsDay,takeoffsNight:row.takeoffsNight,approachesDay:row.approachesDay,approachesNight:row.approachesNight};
}

export function intelligentLogbookAttention(history:IntelligentFlightHistory[]):IntelligentAttentionFlight[]{
  const severity:Record<IntelligentInsightTone,number>={attention:0,warning:1,info:2};
  return history.map(row=>{
    const insights=intelligentFlightReview(historyDraft(row),history.filter(peer=>peer.id!==row.id));
    return{flightId:row.id,date:text(row.date).slice(0,10),registration:upper(row.registration),route:`${upper(row.departure)||"—"} → ${upper(row.arrival)||"—"}`,insights};
  }).filter(item=>item.insights.length>0).sort((a,b)=>{
    const aSeverity=Math.min(...a.insights.map(item=>severity[item.tone])),bSeverity=Math.min(...b.insights.map(item=>severity[item.tone]));
    return aSeverity-bSeverity||b.date.localeCompare(a.date)||b.flightId-a.flightId;
  });
}
