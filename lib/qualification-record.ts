import { classifyQualificationLabel,type QualificationCategory,type QualificationFamily,type QualificationRole } from "./qualification-structure.ts";

const t=(value:unknown)=>String(value??"").trim();
const upper=(value:unknown)=>t(value).toUpperCase();

export function hasConfirmedQualificationStructure(row:Record<string,unknown>){return upper(row.classification_source)==="USER_CONFIRMED"}

export function qualificationLogicScope(row:Record<string,unknown>){
  if(hasConfirmedQualificationStructure(row)&&t(row.qualification_scope))return t(row.qualification_scope);
  return t(row.qualification_type);
}

export function qualificationStructureForLogic(row:Record<string,unknown>,parentLicence?:unknown){
  if(hasConfirmedQualificationStructure(row))return{
    family:upper(row.qualification_family) as QualificationFamily,
    category:upper(row.regulatory_category) as QualificationCategory,
    role:upper(row.privilege_role) as QualificationRole,
    scope:qualificationLogicScope(row),
    confirmed:true,
  };
  const hint=classifyQualificationLabel(row.qualification_type,parentLicence);
  return{...hint,confirmed:false};
}

export function confirmedQualificationMatches(row:Record<string,unknown>,family:QualificationFamily,category:QualificationCategory,role?:QualificationRole){
  if(!hasConfirmedQualificationStructure(row))return false;
  const structure=qualificationStructureForLogic(row);
  return structure.family===family&&structure.category===category&&(!role||structure.role===role);
}
