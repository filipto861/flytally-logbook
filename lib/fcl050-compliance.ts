import { allocatedFunctionTimes } from "./easa-logbook.ts";
import { isAuxiliaryLogbookRole,pilotInCommandName } from "./logbook-print.ts";

export type ComplianceSeverity="error"|"warning";
export type ComplianceIssue={code:string;field:string;message:string;severity:ComplianceSeverity};

const text=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>text(value).toUpperCase();
const number=(value:unknown)=>Math.max(0,Math.round(Number(value)||0));
const validDate=(value:unknown)=>/^\d{4}-\d{2}-\d{2}$/.test(text(value));
const validTime=(value:unknown)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(text(value));
const duration=(start:unknown,end:unknown)=>{if(!validTime(start)||!validTime(end))return 0;const a=Number(text(start).slice(0,2))*60+Number(text(start).slice(3)),b=Number(text(end).slice(0,2))*60+Number(text(end).slice(3));return(b-a+1440)%1440};
const issue=(code:string,field:string,message:string,severity:ComplianceSeverity="error"):ComplianceIssue=>({code,field,message,severity});

const EASA_FUNCTIONS=["PIC","SOLO","SPIC","PICUS","CO-PILOT","CRUISE-RELIEF CO-PILOT","DUAL","INSTRUCTOR","EXAMINER"];
const TEST_PATTERN=/\b(skill test|proficiency check|assessment of competence)\b/i;
const REVALIDATION_PATTERN=/\b(revalidation|lapl recency|recency flight|recency training)\b/i;
const INSTRUMENT_TRAINING_PATTERN=/\b(instrument training|ir training|instrument rating training)\b/i;

export function fcl050FlightCompliance(row:Record<string,unknown>,pilotName=""):ComplianceIssue[]{
  if(upper(row.evidence)!=="EASA")return[];
  const issues:ComplianceIssue[]=[],role=upper(row.role),auxiliary=isAuxiliaryLogbookRole(role),block=number(row.block_minutes)||duration(row.off_block,row.on_block),task=text(row.task),note=text(row.note),remarks=[task,note].filter(Boolean).join(" · ");
  if(!validDate(row.date))issues.push(issue("date","date","A valid flight date is required."));
  if(!text(row.departure))issues.push(issue("departure","departure","Departure place is required."));
  if(!text(row.arrival))issues.push(issue("arrival","arrival","Arrival place is required."));
  if(!validTime(row.off_block))issues.push(issue("off_block","off_block","Departure time must be recorded in UTC."));
  if(!validTime(row.on_block))issues.push(issue("on_block","on_block","Arrival time must be recorded in UTC."));
  if(block<=0)issues.push(issue("flight_time","on_block","Total flight time must be greater than zero."));
  if(!text(row.registration))issues.push(issue("registration","registration","Aircraft registration is required."));
  if(!text(row.aircraft_make))issues.push(issue("aircraft_make","aircraft","Aircraft make is required for the FCL.050 aircraft identity."));
  if(!text(row.aircraft_model)&&!text(row.aircraft_type))issues.push(issue("aircraft_model","aircraft","Aircraft model is required for the FCL.050 aircraft identity."));
  if(!["SE","ME"].includes(upper(row.engine_type)))issues.push(issue("engine_type","engine_type","Select SE or ME."));
  if(!["SP","MP"].includes(upper(row.operation_type)))issues.push(issue("operation_type","operation_type","Select single-pilot or multi-pilot operation."));
  if(auxiliary)issues.push(issue("non_creditable_role","role",`${role} is retained as a certified reference record but is excluded from creditable FCL.050 flight-time totals.`,"warning"));
  else if(!EASA_FUNCTIONS.includes(role))issues.push(issue("pilot_function","role","Select a creditable AMC1 FCL.050 pilot function before certification."));
  if(!pilotInCommandName(row,pilotName))issues.push(issue("pic_name","commander","Name of PIC is required."));
  if(role==="DUAL"&&!text(row.instructor))issues.push(issue("dual_instructor","instructor","A DUAL flight requires the instructor/PIC name."));
  if(["SPIC","PICUS"].includes(role)){
    if(!text(row.verification_name))issues.push(issue("supervising_pilot","verification_name",`${role} time requires the supervising PIC/FI name.`));
    if(!text(row.verification_reference))issues.push(issue("supervising_signature","verification_reference",`${role} time must be countersigned; add the countersignature reference.`));
  }
  const functionTotal=number(row.pic_minutes)+number(row.copilot_minutes)+number(row.dual_minutes)+number(row.instructor_minutes);
  if(auxiliary&&functionTotal>0)issues.push(issue("auxiliary_function_time","role",`${role} must not contain PIC, co-pilot, DUAL or instructor time because it is a non-creditable reference record.`));
  if(!auxiliary&&block>0&&functionTotal<=0)issues.push(issue("function_time","role","Pilot-function time is missing."));
  if(!auxiliary&&block>0&&functionTotal>block*2)issues.push(issue("function_time_excess","role","Pilot-function allocation is inconsistent with total flight time."));
  if(!auxiliary&&block>0&&EASA_FUNCTIONS.includes(role)){
    const expected=allocatedFunctionTimes(role,block),actual={picMinutes:number(row.pic_minutes),copilotMinutes:number(row.copilot_minutes),dualMinutes:number(row.dual_minutes),instructorMinutes:number(row.instructor_minutes)};
    if(actual.picMinutes!==expected.picMinutes||actual.copilotMinutes!==expected.copilotMinutes||actual.dualMinutes!==expected.dualMinutes||actual.instructorMinutes!==expected.instructorMinutes){
      issues.push(issue("function_time_allocation","role",`${role} time is allocated to the wrong FCL.050 pilot-function column. Re-save the role or correct the flight-time allocation.`));
    }
  }
  if(number(row.night_minutes)>block)issues.push(issue("night_time","night_minutes","Night time cannot exceed total flight time."));
  if(number(row.ifr_minutes)>block)issues.push(issue("ifr_time","ifr_minutes","IFR time cannot exceed total flight time."));
  if(number(row.landings_day)+number(row.landings_night)!==number(row.starts))issues.push(issue("landing_total","landings_day","Day and night landings must add up to the recorded landing total."));

  const testOrCheck=TEST_PATTERN.test(remarks),revalidation=REVALIDATION_PATTERN.test(remarks),instrumentTraining=INSTRUMENT_TRAINING_PATTERN.test(remarks)||(role==="DUAL"&&number(row.ifr_minutes)>0),verificationMissing=!text(row.verification_name)||!text(row.verification_reference);
  if(testOrCheck)issues.push(issue("test_endorsement","note",verificationMissing?"Skill/proficiency check detected. Record the applicable examiner/instructor name and signed endorsement reference with the record.":"Skill/proficiency check detected. Keep the applicable examiner/instructor endorsement and signed evidence with the record.","warning"));
  if(revalidation)issues.push(issue("revalidation_endorsement","note",verificationMissing?"Revalidation/recency activity detected. Record the applicable instructor name and signed endorsement reference with the record.":"Revalidation/recency activity detected. Keep the applicable instructor endorsement and signed evidence with the record.","warning"));
  if(instrumentTraining&&!remarks)issues.push(issue("instrument_training_remarks","note","Instrument flight time used for licence/rating training must be described in Remarks."));
  if(!task&&!note)issues.push(issue("remarks_recommended","note","Add a concise task or remark so the purpose of the flight is traceable.","warning"));
  return issues;
}

export function fstdCompliance(row:Record<string,unknown>):ComplianceIssue[]{
  const issues:ComplianceIssue[]=[];
  if(!validDate(row.session_date))issues.push(issue("fstd_date","session_date","FSTD session date is required."));
  if(!text(row.device_type))issues.push(issue("fstd_type","device_type","FSTD type is required."));
  if(!text(row.qualification_number))issues.push(issue("fstd_qualification","qualification_number","FSTD qualification number is required."));
  if(!text(row.instruction))issues.push(issue("fstd_instruction","instruction","FSTD instruction/exercise is required."));
  if(number(row.total_minutes)<=0)issues.push(issue("fstd_time","total_minutes","FSTD total session time must be greater than zero."));
  return issues;
}

export function blockingComplianceIssues(issues:ComplianceIssue[]){return issues.filter(item=>item.severity==="error")}
export function complianceReady(issues:ComplianceIssue[]){return blockingComplianceIssues(issues).length===0}
