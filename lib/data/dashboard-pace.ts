import "server-only";
import { sql } from "@/lib/db";
import { measureServerTask } from "@/lib/performance";
import type { PaceMonth } from "@/lib/dashboard-pace";

export type DashboardPaceData={months:PaceMonth[]|null;invalidWindowDates:number};

/**
 * Preview-only, user-scoped 25-calendar-month projection. Never call the full
 * getDashboardData() Statistics read here. The source formulas below mirror the
 * canonical getDashboardOverviewData/getDashboardData flight role, evidence,
 * logged_minutes and safety-pilot activity_minutes contracts.
 *
 * Dates that cannot be placed in this lexical window cannot be assigned to it;
 * their separate data-quality review is not proof of chart completeness.
 */
export async function getDashboardPaceData(userId:number,asOf:Date=new Date()):Promise<DashboardPaceData>{
  if(!Number.isSafeInteger(userId)||userId<=0||!Number.isFinite(asOf.getTime()))
    return {months:null,invalidWindowDates:0};
  const year=asOf.getUTCFullYear(),month=asOf.getUTCMonth();
  const startDate=new Date(Date.UTC(year,month-24,1)).toISOString().slice(0,10);
  const endExclusive=new Date(Date.UTC(year,month+1,1)).toISOString().slice(0,10);
  const currentDate=asOf.toISOString().slice(0,10);
  const rows=await measureServerTask("dashboard-pace-25-month",()=>sql`
    WITH dated AS MATERIALIZED (
      SELECT f.date::text date_key,
        UPPER(TRIM(COALESCE(f.evidence,''))) evidence,
        CASE
          WHEN UPPER(TRIM(COALESCE(f.regulatory_category,''))) IN ('AEROPLANE','HELICOPTER','BALLOON','SAILPLANE','ULL','OTHER') THEN UPPER(TRIM(COALESCE(f.regulatory_category,'')))
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='ULL' OR UPPER(TRIM(COALESCE(f.evidence,'')))='ULL' THEN 'ULL'
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='GLIDER' THEN 'SAILPLANE'
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='HELICOPTER' THEN 'HELICOPTER'
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='BALLOON' THEN 'BALLOON'
          WHEN UPPER(TRIM(COALESCE(f.aircraft_class,''))) IN ('SEP','TMG','MEP','SET') THEN 'AEROPLANE'
          ELSE 'OTHER' END resolved_category,
        CASE
          WHEN UPPER(TRIM(COALESCE(f.role,'')))='INSTRUKTOR' THEN 'INSTRUCTOR'
          WHEN UPPER(TRIM(COALESCE(f.role,'')))='STUDENT' OR (TRIM(COALESCE(f.role,''))='' AND TRIM(COALESCE(f.instructor,''))<>'') THEN 'DUAL'
          ELSE UPPER(TRIM(COALESCE(f.role,''))) END role,
        CASE WHEN f.off_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
              AND f.on_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)
                 -(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440)
          ELSE 0 END::int block_minutes,
        CASE WHEN f.takeoff~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
              AND f.landing~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN MOD((split_part(f.landing,':',1)::int*60+split_part(f.landing,':',2)::int)
                 -(split_part(f.takeoff,':',1)::int*60+split_part(f.takeoff,':',2)::int)+1440,1440)
          ELSE 0 END::int air_minutes
      FROM flights f
      WHERE f.user_id=${userId}
        AND f.date::text>=${startDate}::text
        AND f.date::text<${endExclusive}::text
    ),checked AS MATERIALIZED (
      SELECT *,CASE
        WHEN date_key~'^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
          THEN TO_CHAR(TO_DATE(date_key,'YYYY-MM-DD'),'YYYY-MM-DD')=date_key
        ELSE FALSE END valid_date
      FROM dated
    ),calculated AS MATERIALIZED (
      SELECT date_key,valid_date,evidence,role,
        role NOT IN ('PAX','OBSERVER') dashboard_total,
        role IN ('SAFETY PILOT','PAX','OBSERVER') auxiliary,
        CASE WHEN resolved_category IN ('SAILPLANE','BALLOON')
          THEN CASE WHEN air_minutes>0 THEN air_minutes ELSE block_minutes END
          ELSE block_minutes END::int logged_minutes,
        block_minutes
      FROM checked
    ),activity AS MATERIALIZED (
      SELECT date_key,valid_date,evidence,role,dashboard_total,auxiliary,logged_minutes,
        CASE WHEN role='SAFETY PILOT' THEN block_minutes ELSE logged_minutes END::int activity_minutes
      FROM calculated
    ),month_rows AS (
      SELECT LEFT(date_key,7) month_key,
        COALESCE(SUM(activity_minutes),0)::int total,
        COALESCE(SUM(logged_minutes) FILTER(WHERE NOT auxiliary AND evidence='ULL'),0)::int ull,
        COALESCE(SUM(logged_minutes) FILTER(WHERE NOT auxiliary AND evidence='EASA'),0)::int easa
      FROM activity
      WHERE dashboard_total AND valid_date AND date_key<=${currentDate}::text
      GROUP BY LEFT(date_key,7)
    )
    SELECT
      (SELECT COUNT(*)::int FROM activity WHERE dashboard_total AND NOT valid_date) invalid_window_dates,
      COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.month_key) FROM month_rows m),'[]'::jsonb) months
  `,650) as Array<Record<string,unknown>>;
  if(rows.length!==1)return {months:null,invalidWindowDates:0};
  const row=rows[0];
  if(row.invalid_window_dates===null||row.invalid_window_dates===undefined)return {months:null,invalidWindowDates:0};
  const issues=Number(row.invalid_window_dates);
  if(!Number.isSafeInteger(issues)||issues<0)return {months:null,invalidWindowDates:0};
  let value:unknown=row.months;
  if(typeof value==="string"){try{value=JSON.parse(value)}catch{return {months:null,invalidWindowDates:issues}}}
  if(!Array.isArray(value))return {months:null,invalidWindowDates:issues};
  const months:PaceMonth[]=[];
  for(const item of value){
    if(!item||typeof item!=="object"||Array.isArray(item))return {months:null,invalidWindowDates:issues};
    const record=item as Record<string,unknown>;
    const monthValue=record.month_key,total=Number(record.total),ull=Number(record.ull),easa=Number(record.easa);
    if(typeof monthValue!=="string"||["total","ull","easa"].some(key=>record[key]===null||record[key]===undefined)||![total,ull,easa].every(v=>Number.isSafeInteger(v)&&v>=0))
      return {months:null,invalidWindowDates:issues};
    months.push({month:monthValue,total,ull,easa});
  }
  return {months,invalidWindowDates:issues};
}
