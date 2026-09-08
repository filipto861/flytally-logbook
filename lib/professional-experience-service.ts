import "server-only";
import { sql } from "@/lib/db";
import { ensureV166Schema } from "@/lib/v166-schema";
import { professionalExperienceReport,type ProfessionalExperienceReport } from "@/lib/professional-experience";

const text=(value:unknown)=>String(value??"").trim();
const professionalScope=(value:unknown):""|"AEROPLANE"|"HELICOPTER"=>{const normalized=text(value).toUpperCase();return normalized==="AEROPLANE"||normalized==="HELICOPTER"?normalized:""};
const scopeSupported=(value:unknown)=>{const normalized=text(value).toUpperCase();return !normalized||normalized==="AEROPLANE"||normalized==="HELICOPTER"};

export type ProfessionalExperienceData=ProfessionalExperienceReport&{
  visible:boolean;
  professionalLicence:boolean;
  scope:"ALL"|"AEROPLANE"|"HELICOPTER";
  scopeSupported:boolean;
};

export async function getProfessionalExperienceForUser(userId:number,requestedCategory?:string):Promise<ProfessionalExperienceData>{
  await ensureV166Schema();
  const supported=scopeSupported(requestedCategory),scope=professionalScope(requestedCategory);
  const [rows,licences]=await Promise.all([
    supported?sql`SELECT certified_at,evidence,regulatory_category,date,role,operation_type,operation_context,operator_name,aircraft_type,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,ifr_minutes,night_minutes FROM flights WHERE user_id=${userId} AND certified_at IS NOT NULL AND UPPER(COALESCE(evidence,''))='EASA' AND UPPER(COALESCE(regulatory_category,'')) IN ('AEROPLANE','HELICOPTER') AND (${scope}='' OR UPPER(COALESCE(regulatory_category,''))=${scope}) ORDER BY date,id` as unknown as Promise<Array<Record<string,unknown>>>:Promise.resolve([] as Array<Record<string,unknown>>),
    sql`SELECT licence_type FROM pilot_licences WHERE user_id=${userId} AND active=TRUE` as unknown as Promise<Array<{licence_type:string}>>,
  ]);
  const report=professionalExperienceReport(rows);
  const professionalLicence=licences.some(row=>{const licence=text(row.licence_type).toUpperCase();if(scope==="AEROPLANE")return /^(CPL|ATPL)\(A\)$/.test(licence);if(scope==="HELICOPTER")return /^(CPL|ATPL)\(H\)$/.test(licence);return /^(CPL|ATPL)\((A|H)\)$/.test(licence)});
  return{...report,visible:supported&&(professionalLicence||report.summary.flights>0),professionalLicence,scope:scope||"ALL",scopeSupported:supported};
}
