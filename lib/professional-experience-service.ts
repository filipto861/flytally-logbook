import "server-only";
import { sql } from "@/lib/db";
import { ensureV166Schema } from "@/lib/v166-schema";
import { professionalExperienceSummary } from "@/lib/professional-experience";

export async function getProfessionalExperienceForUser(userId:number){
  await ensureV166Schema();
  const [rows,licences]=await Promise.all([
    sql`SELECT certified_at,evidence,regulatory_category,role,operation_type,operation_context,pic_minutes,copilot_minutes,dual_minutes,instructor_minutes,ifr_minutes,night_minutes FROM flights WHERE user_id=${userId} AND certified_at IS NOT NULL AND UPPER(COALESCE(evidence,''))='EASA' AND UPPER(COALESCE(regulatory_category,'')) IN ('AEROPLANE','HELICOPTER') ORDER BY date,id` as Promise<Array<Record<string,unknown>>>,
    sql`SELECT licence_type FROM pilot_licences WHERE user_id=${userId} AND active=TRUE` as Promise<Array<{licence_type:string}>>,
  ]);
  const summary=professionalExperienceSummary(rows),professionalLicence=licences.some(row=>/^(CPL|ATPL)\((A|H)\)$/i.test(String(row.licence_type||"").trim()));
  return{summary,visible:professionalLicence||summary.flights>0,professionalLicence};
}
