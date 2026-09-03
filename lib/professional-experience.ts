import { supportsProfessionalContext } from "./professional-context.ts";

const text=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>text(value).toUpperCase();
const minutes=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));

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

export function professionalCreditableMinutes(row:ProfessionalExperienceRow){
  if(!row.certified_at||!supportsProfessionalContext({evidence:row.evidence,regulatoryCategory:row.regulatory_category}))return 0;
  const role=upper(row.role),pic=minutes(row.pic_minutes),copilot=minutes(row.copilot_minutes),dual=minutes(row.dual_minutes),instructor=minutes(row.instructor_minutes);
  if(["PIC","SOLO","SPIC","PICUS"].includes(role))return pic;
  if(role==="CO-PILOT"||role==="CRUISE-RELIEF CO-PILOT")return copilot;
  if(role==="DUAL")return dual;
  if(["FI","INSTRUCTOR","EXAMINER"].includes(role))return Math.max(pic,instructor);
  return 0;
}

export function professionalExperienceSummary(rows:ProfessionalExperienceRow[]):ProfessionalExperienceSummary{
  const summary:ProfessionalExperienceSummary={flights:0,totalMinutes:0,picMinutes:0,spicMinutes:0,picusMinutes:0,copilotMinutes:0,cruiseReliefMinutes:0,instructorMinutes:0,examinerMinutes:0,multiPilotMinutes:0,ifrMinutes:0,nightMinutes:0,catMinutes:0};
  for(const row of rows){
    const credited=professionalCreditableMinutes(row);if(!credited)continue;
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
    if(upper(row.operation_context)==="CAT")summary.catMinutes+=credited;
  }
  return summary;
}
