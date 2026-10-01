import { EASA_ROLES } from "./easa-logbook.ts";

export const ROLE_CREW_ROLES=[...EASA_ROLES,"PAX","OBSERVER"] as const;
export type RoleCrewRole=(typeof ROLE_CREW_ROLES)[number];
export type CrewFieldPolicy="required_save"|"optional"|"not_applicable"|"external_resolver";
export type PicNameSource="SELF"|"COMMANDER"|"INSTRUCTOR"|"VERIFIER"|"NONE";

export type RoleCrewSpec={
  role:RoleCrewRole;
  evidence:string;
  commander:CrewFieldPolicy;
  instructor:CrewFieldPolicy;
  verificationName:CrewFieldPolicy;
  verificationReference:CrewFieldPolicy;
  connectedActualPic:"allowed"|"not_applicable";
  selfIsPic:boolean;
  picNameSource:PicNameSource;
};

const SELF_PIC_ROLES=new Set<RoleCrewRole>(["PIC","SOLO","FI","INSTRUCTOR","EXAMINER"]);
const SUPERVISED_ROLES=new Set<RoleCrewRole>(["SPIC","PICUS"]);

function normalizedRole(value:string):RoleCrewRole|null{
  const role=value.trim().toUpperCase();
  return ROLE_CREW_ROLES.includes(role as RoleCrewRole)?role as RoleCrewRole:null;
}

export function roleCrewSpec(roleValue:string,evidenceValue:string):RoleCrewSpec|null{
  const role=normalizedRole(roleValue);if(!role)return null;
  const evidence=evidenceValue.trim().toUpperCase(),easa=evidence==="EASA",selfIsPic=SELF_PIC_ROLES.has(role);

  let commander:CrewFieldPolicy="optional";
  let instructor:CrewFieldPolicy="optional";
  let verificationName:CrewFieldPolicy="optional";
  let verificationReference:CrewFieldPolicy="optional";
  let connectedActualPic:"allowed"|"not_applicable"="not_applicable";
  let picNameSource:PicNameSource="COMMANDER";

  if(selfIsPic){
    commander="not_applicable";
    picNameSource="SELF";
  }else if(role==="DUAL"){
    instructor=easa?"required_save":"optional";
    picNameSource="INSTRUCTOR";
  }else if(SUPERVISED_ROLES.has(role)){
    verificationName=easa?"required_save":"optional";
    verificationReference=easa?"required_save":"optional";
    picNameSource="VERIFIER";
  }else if(role==="SAFETY PILOT"){
    commander=easa?"external_resolver":"optional";
    connectedActualPic="allowed";
  }

  return{role,evidence,commander,instructor,verificationName,verificationReference,connectedActualPic,selfIsPic,picNameSource};
}

type RoleCrewValues={
  instructor:unknown;
  verificationName:unknown;
  verificationReference:unknown;
};

const present=(value:unknown)=>String(value??"").trim().length>0;

export function roleCrewSaveError(spec:RoleCrewSpec,values:RoleCrewValues):string|null{
  if(spec.instructor==="required_save"&&!present(values.instructor))return"DUAL entries require the instructor/PIC name.";
  if(
    (spec.verificationName==="required_save"&&!present(values.verificationName))||
    (spec.verificationReference==="required_save"&&!present(values.verificationReference))
  )return"SPIC and PICUS entries require the supervising pilot's name and countersignature reference.";
  return null;
}
