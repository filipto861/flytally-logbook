import {aircraftCategoryCapabilities} from "./aircraft-category.ts";

export const PROFESSIONAL_OPERATION_CONTEXTS=["","PRIVATE","TRAINING","COMMERCIAL","CAT","NCC","SPO","OTHER"] as const;
export type ProfessionalOperationContext=(typeof PROFESSIONAL_OPERATION_CONTEXTS)[number];

export const professionalOperationLabel=(value:unknown)=>{
  const normalized=normalizeProfessionalOperationContext(value);
  return ({PRIVATE:"Private / non-commercial",TRAINING:"Training",COMMERCIAL:"Commercial — other",CAT:"Commercial air transport (CAT)",NCC:"Non-commercial complex (NCC)",SPO:"Specialised operation (SPO)",OTHER:"Other"} as Record<string,string>)[normalized]||"Not specified";
};

export function normalizeProfessionalOperationContext(value:unknown):ProfessionalOperationContext{
  const normalized=String(value??"").trim().toUpperCase();
  return PROFESSIONAL_OPERATION_CONTEXTS.includes(normalized as ProfessionalOperationContext)?normalized as ProfessionalOperationContext:"";
}

export function supportsProfessionalContext(input:{evidence?:unknown;regulatoryCategory?:unknown}){
  return aircraftCategoryCapabilities(input).supportsProfessionalContext;
}

export function roleRequiresMultiPilotOperation(role:unknown){
  const normalized=String(role??"").trim().toUpperCase();
  return normalized==="CO-PILOT"||normalized==="CRUISE-RELIEF CO-PILOT";
}
