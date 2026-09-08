import { normalizeProfessionalOperationContext,professionalOperationLabel,supportsProfessionalContext } from "./professional-context.ts";

const text=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>text(value).toUpperCase();
const minutes=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));
const dateText=(value:unknown)=>text(value).slice(0,10);
const latest=(a:string,b:string)=>a>=b?a:b;

export type ProfessionalExperienceRow=Record<string,unknown>;
export type ProfessionalExperienceSummary={
  flights:number;
  totalMinutes:number;
  picMinutes:number;
  spicMinutes:number;
  picusMinutes:number;
  copilotMinutes:number;
  cruiseReliefMinutes:number;
  instructorMinutes:number;
  examinerMinutes:number;
  multiPilotMinutes:number;
  ifrMinutes:number;
  nightMinutes:number;
  catMinutes:number;
};

export type ProfessionalExperienceBreakdownRow={
  key:string;
  label:string;
  flights:number;
  minutes:number;
  picMinutes:number;
  spicMinutes:number;
  picusMinutes:number;
  copilotMinutes:number;
  cruiseReliefMinutes:number;
  instructorMinutes:number;
  examinerMinutes:number;
  multiPilotMinutes:number;
  ifrMinutes:number;
  nightMinutes:number;
  lastDate:string;
};

export type ProfessionalRoleBreakdownRow={role:string;flights:number;minutes:number;lastDate:string};
export type ProfessionalContextBreakdownRow={context:string;label:string;recorded:boolean;flights:number;minutes:number;lastDate:string};
export type ProfessionalOperatorCoverage={recordedFlights:number;unrecordedFlights:number;recordedMinutes:number;unrecordedMinutes:number};
export type ProfessionalExperienceReport={
  summary:ProfessionalExperienceSummary;
  operators:ProfessionalExperienceBreakdownRow[];
  aircraftTypes:ProfessionalExperienceBreakdownRow[];
  roles:ProfessionalRoleBreakdownRow[];
  operationContexts:ProfessionalContextBreakdownRow[];
  operatorCoverage:ProfessionalOperatorCoverage;
};

export function professionalCreditableMinutes(row:ProfessionalExperienceRow){
  if(!row.certified_at||!supportsProfessionalContext({evidence:row.evidence,regulatoryCategory:row.regulatory_category}))return 0;
  const role=upper(row.role),pic=minutes(row.pic_minutes),copilot=minutes(row.copilot_minutes),dual=minutes(row.dual_minutes),instructor=minutes(row.instructor_minutes);
  if(["PIC","SOLO","SPIC","PICUS"].includes(role))return pic;
  if(role==="CO-PILOT"||role==="CRUISE-RELIEF CO-PILOT")return copilot;
  if(role==="DUAL")return dual;
  if(["FI","INSTRUCTOR","EXAMINER"].includes(role))return Math.max(pic,instructor);
  return 0;
}

function emptySummary():ProfessionalExperienceSummary{
  return{flights:0,totalMinutes:0,picMinutes:0,spicMinutes:0,picusMinutes:0,copilotMinutes:0,cruiseReliefMinutes:0,instructorMinutes:0,examinerMinutes:0,multiPilotMinutes:0,ifrMinutes:0,nightMinutes:0,catMinutes:0};
}

function addSummary(summary:ProfessionalExperienceSummary,row:ProfessionalExperienceRow,credited:number){
  const role=upper(row.role);summary.flights++;summary.totalMinutes+=credited;
  if(["PIC","SOLO","FI","INSTRUCTOR","EXAMINER"].includes(role))summary.picMinutes+=Math.min(credited,minutes(row.pic_minutes)||credited);
  if(role==="SPIC")summary.spicMinutes+=credited;
  if(role==="PICUS")summary.picusMinutes+=credited;
  if(role==="CO-PILOT")summary.copilotMinutes+=credited;
  if(role==="CRUISE-RELIEF CO-PILOT")summary.cruiseReliefMinutes+=credited;
  if(role==="FI"||role==="INSTRUCTOR")summary.instructorMinutes+=Math.min(credited,minutes(row.instructor_minutes)||credited);
  if(role==="EXAMINER")summary.examinerMinutes+=Math.min(credited,minutes(row.instructor_minutes)||credited);
  if(upper(row.operation_type)==="MP")summary.multiPilotMinutes+=credited;
  summary.ifrMinutes+=Math.min(credited,minutes(row.ifr_minutes));
  summary.nightMinutes+=Math.min(credited,minutes(row.night_minutes));
  if(normalizeProfessionalOperationContext(row.operation_context)==="CAT")summary.catMinutes+=credited;
}

export function professionalExperienceSummary(rows:ProfessionalExperienceRow[]):ProfessionalExperienceSummary{
  const summary=emptySummary();
  for(const row of rows){const credited=professionalCreditableMinutes(row);if(credited)addSummary(summary,row,credited)}
  return summary;
}

function emptyBreakdown(key:string,label:string):ProfessionalExperienceBreakdownRow{
  return{key,label,flights:0,minutes:0,picMinutes:0,spicMinutes:0,picusMinutes:0,copilotMinutes:0,cruiseReliefMinutes:0,instructorMinutes:0,examinerMinutes:0,multiPilotMinutes:0,ifrMinutes:0,nightMinutes:0,lastDate:""};
}

function addBreakdown(target:ProfessionalExperienceBreakdownRow,row:ProfessionalExperienceRow,credited:number){
  const contribution=emptySummary();addSummary(contribution,row,credited);
  target.flights+=1;target.minutes+=credited;target.picMinutes+=contribution.picMinutes;target.spicMinutes+=contribution.spicMinutes;target.picusMinutes+=contribution.picusMinutes;target.copilotMinutes+=contribution.copilotMinutes;target.cruiseReliefMinutes+=contribution.cruiseReliefMinutes;target.instructorMinutes+=contribution.instructorMinutes;target.examinerMinutes+=contribution.examinerMinutes;target.multiPilotMinutes+=contribution.multiPilotMinutes;target.ifrMinutes+=contribution.ifrMinutes;target.nightMinutes+=contribution.nightMinutes;target.lastDate=latest(target.lastDate,dateText(row.date));
}

function sortedBreakdowns(map:Map<string,ProfessionalExperienceBreakdownRow>){
  return[...map.values()].sort((a,b)=>b.minutes-a.minutes||b.flights-a.flights||a.label.localeCompare(b.label));
}

export function professionalExperienceReport(rows:ProfessionalExperienceRow[]):ProfessionalExperienceReport{
  const summary=emptySummary(),operators=new Map<string,ProfessionalExperienceBreakdownRow>(),aircraftTypes=new Map<string,ProfessionalExperienceBreakdownRow>(),roles=new Map<string,ProfessionalRoleBreakdownRow>(),contexts=new Map<string,ProfessionalContextBreakdownRow>();
  const operatorCoverage:ProfessionalOperatorCoverage={recordedFlights:0,unrecordedFlights:0,recordedMinutes:0,unrecordedMinutes:0};

  for(const row of rows){
    const credited=professionalCreditableMinutes(row);if(!credited)continue;
    addSummary(summary,row,credited);

    const operator=text(row.operator_name),operatorKey=upper(operator);
    if(operatorKey){
      const item=operators.get(operatorKey)??emptyBreakdown(operatorKey,operator);addBreakdown(item,row,credited);operators.set(operatorKey,item);
      operatorCoverage.recordedFlights++;operatorCoverage.recordedMinutes+=credited;
    }else{operatorCoverage.unrecordedFlights++;operatorCoverage.unrecordedMinutes+=credited}

    const aircraft=text(row.aircraft_type),aircraftKey=upper(aircraft)||"__UNRECORDED__";
    const aircraftItem=aircraftTypes.get(aircraftKey)??emptyBreakdown(aircraftKey,aircraft||"Type not recorded");addBreakdown(aircraftItem,row,credited);aircraftTypes.set(aircraftKey,aircraftItem);

    const role=upper(row.role)||"UNSPECIFIED",roleItem=roles.get(role)??{role,flights:0,minutes:0,lastDate:""};
    roleItem.flights++;roleItem.minutes+=credited;roleItem.lastDate=latest(roleItem.lastDate,dateText(row.date));roles.set(role,roleItem);

    const context=normalizeProfessionalOperationContext(row.operation_context),contextKey=context||"__UNRECORDED__",contextItem=contexts.get(contextKey)??{context,label:context?professionalOperationLabel(context):"Not recorded",recorded:Boolean(context),flights:0,minutes:0,lastDate:""};
    contextItem.flights++;contextItem.minutes+=credited;contextItem.lastDate=latest(contextItem.lastDate,dateText(row.date));contexts.set(contextKey,contextItem);
  }

  return{
    summary,
    operators:sortedBreakdowns(operators),
    aircraftTypes:sortedBreakdowns(aircraftTypes),
    roles:[...roles.values()].sort((a,b)=>b.minutes-a.minutes||b.flights-a.flights||a.role.localeCompare(b.role)),
    operationContexts:[...contexts.values()].sort((a,b)=>Number(b.recorded)-Number(a.recorded)||b.minutes-a.minutes||a.label.localeCompare(b.label)),
    operatorCoverage,
  };
}
