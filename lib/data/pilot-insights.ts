import "server-only";
import { sql } from "@/lib/db";
import { measureServerTask } from "@/lib/performance";
import { pilotInsightBounds,rollingYearBounds } from "@/lib/pilot-insights";
import { REGULATORY_AIRCRAFT_CATEGORIES,type RegulatoryAircraftCategory } from "@/lib/aircraft-category";

export type PilotInsightMonthlyPoint={month:string;flights:number;minutes:number;picMinutes:number;nightMinutes:number;ifrMinutes:number;landings:number};
export type PilotRoleBreakdown={role:string;flights:number;minutes:number};
export type PilotAircraftTypeBreakdown={aircraftType:string;registrations:number;flights:number;minutes:number;picMinutes:number;lastDate:string};
export type PilotAircraftClassBreakdown={aircraftClass:string;flights:number;minutes:number;picMinutes:number;lastDate:string};
export type PilotCategoryBreakdown={category:RegulatoryAircraftCategory;flights:number;minutes:number;picMinutes:number;lastDate:string};
export type PilotRegistrationBreakdown={registration:string;flights:number;minutes:number;cost:number;lastDate:string};
export type PilotAirportBreakdown={airport:string;visits:number;departures:number;arrivals:number;firstDate:string;lastDate:string};
export type PilotRouteBreakdown={route:string;departure:string;arrival:string;flights:number;minutes:number;firstDate:string;lastDate:string};
export type PilotInsightsSummary={flights:number;minutes:number;picMinutes:number;copilotMinutes:number;dualMinutes:number;instructorMinutes:number;nightMinutes:number;ifrMinutes:number;dayLandings:number;nightLandings:number;safetyMinutes:number;cost:number;uniqueAircraft:number;uniqueAirports:number;uniqueRoutes:number};
export type RollingYearSummary={flights:number;minutes:number;picMinutes:number;landings:number;activeMonths:number};
export type PilotCareerSummary={firstDate:string;lastDate:string;flights:number;minutes:number;activeYears:number;busiestYear:number;busiestYearMinutes:number;busiestYearFlights:number};
export type PilotInsightsData={
  rangeLabel:string;
  scopeCategory:RegulatoryAircraftCategory|null;
  summary:PilotInsightsSummary;
  monthly:PilotInsightMonthlyPoint[];
  roles:PilotRoleBreakdown[];
  aircraftTypes:PilotAircraftTypeBreakdown[];
  aircraftClasses:PilotAircraftClassBreakdown[];
  categories:PilotCategoryBreakdown[];
  registrations:PilotRegistrationBreakdown[];
  airports:PilotAirportBreakdown[];
  routes:PilotRouteBreakdown[];
  current12m:RollingYearSummary;
  previous12m:RollingYearSummary;
  career:PilotCareerSummary;
};

const n=(value:unknown)=>Number(value??0)||0;
const s=(value:unknown)=>String(value??"").trim();
const jsonObjects=(value:unknown):Array<Record<string,unknown>>=>{if(Array.isArray(value))return value as Array<Record<string,unknown>>;if(typeof value==="string")try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{}return[]};
const normalizedCategory=(value:unknown):RegulatoryAircraftCategory|null=>{const normalized=s(value).toUpperCase();return REGULATORY_AIRCRAFT_CATEGORIES.includes(normalized as RegulatoryAircraftCategory)?normalized as RegulatoryAircraftCategory:null};

export async function getPilotInsightsData(userId:number,requested:string,requestedCategory?:string):Promise<PilotInsightsData>{
  const bounds=pilotInsightBounds(requested),rolling=rollingYearBounds(),scopeCategory=normalizedCategory(requestedCategory);
  const rows=await measureServerTask("pilot-insights-data",()=>sql`
      WITH base0 AS MATERIALIZED(
        SELECT f.id,
          CASE WHEN f.date::text~'^\\d{4}-\\d{2}-\\d{2}$' THEN f.date::text ELSE NULL END date_key,
          CASE WHEN UPPER(TRIM(COALESCE(f.role,'')))='INSTRUKTOR' THEN 'INSTRUCTOR'
               WHEN UPPER(TRIM(COALESCE(f.role,'')))='STUDENT' OR (TRIM(COALESCE(f.role,''))='' AND TRIM(COALESCE(f.instructor,''))<>'') THEN 'DUAL'
               ELSE UPPER(TRIM(COALESCE(f.role,''))) END role,
          UPPER(TRIM(COALESCE(f.registration,''))) registration,
          TRIM(COALESCE(f.aircraft_type,'')) aircraft_type,
          UPPER(TRIM(COALESCE(f.aircraft_class,''))) aircraft_class,
          UPPER(TRIM(COALESCE(f.evidence,''))) evidence,
          CASE
            WHEN UPPER(TRIM(COALESCE(f.regulatory_category,''))) IN ('AEROPLANE','HELICOPTER','BALLOON','SAILPLANE','ULL','OTHER') THEN UPPER(TRIM(COALESCE(f.regulatory_category,'')))
            WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='ULL' OR UPPER(TRIM(COALESCE(f.evidence,'')))='ULL' THEN 'ULL'
            WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='GLIDER' THEN 'SAILPLANE'
            WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='HELICOPTER' THEN 'HELICOPTER'
            WHEN UPPER(TRIM(COALESCE(f.aircraft_class,'')))='BALLOON' THEN 'BALLOON'
            WHEN UPPER(TRIM(COALESCE(f.aircraft_class,''))) IN ('SEP','TMG','MEP','SET') THEN 'AEROPLANE'
            ELSE 'OTHER' END resolved_category,
          UPPER(TRIM(COALESCE(f.departure,''))) departure,
          UPPER(TRIM(COALESCE(f.arrival,''))) arrival,
          GREATEST(COALESCE(f.starts,0),0)::int legacy_starts,
          GREATEST(COALESCE(f.landings_day,0),0)::int stored_day_landings,
          GREATEST(COALESCE(f.landings_night,0),0)::int stored_night_landings,
          GREATEST(COALESCE(f.night_minutes,0),0)::int night_minutes,
          GREATEST(COALESCE(f.ifr_minutes,0),0)::int ifr_minutes,
          GREATEST(COALESCE(f.pic_minutes,0),0)::int stored_pic_minutes,
          GREATEST(COALESCE(f.copilot_minutes,0),0)::int copilot_minutes,
          GREATEST(COALESCE(f.dual_minutes,0),0)::int dual_minutes,
          GREATEST(COALESCE(f.instructor_minutes,0),0)::int instructor_minutes,
          GREATEST(COALESCE(f.price_per_hour,0),0)::double precision hourly,
          UPPER(COALESCE(f.billing_basis,'BLOCK')) billing_basis,
          CASE WHEN f.off_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
               THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440)
               ELSE 0 END::int block_minutes,
          CASE WHEN f.takeoff~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.landing~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
               THEN MOD((split_part(f.landing,':',1)::int*60+split_part(f.landing,':',2)::int)-(split_part(f.takeoff,':',1)::int*60+split_part(f.takeoff,':',2)::int)+1440,1440)
               ELSE 0 END::int air_minutes
        FROM flights f WHERE f.user_id=${userId}
      ),base1 AS MATERIALIZED(
        SELECT *,role IN ('SAFETY PILOT','PAX','OBSERVER') auxiliary,
          CASE WHEN resolved_category IN ('SAILPLANE','BALLOON') THEN CASE WHEN air_minutes>0 THEN air_minutes ELSE block_minutes END ELSE block_minutes END::int logged_minutes,
          CASE WHEN stored_day_landings+stored_night_landings>0 THEN stored_day_landings ELSE legacy_starts END::int day_landings,
          stored_night_landings::int night_landings,
          CASE WHEN stored_day_landings+stored_night_landings>0 THEN stored_day_landings+stored_night_landings ELSE legacy_starts END::int landings,
          hourly*(CASE WHEN billing_basis LIKE 'AIR%' THEN air_minutes ELSE block_minutes END)/60.0/(CASE WHEN split_part(billing_basis,'/',2)~'^[1-9][0-9]*$' AND split_part(billing_basis,'/',2)::int<=20 THEN split_part(billing_basis,'/',2)::numeric ELSE 1 END)::double precision cost
        FROM base0
      ),base AS MATERIALIZED(
        SELECT *,CASE WHEN stored_pic_minutes>0 THEN stored_pic_minutes
          WHEN role IN ('PIC','SOLO','SPIC','PICUS','INSTRUCTOR','EXAMINER') THEN logged_minutes ELSE 0 END::int pic_minutes
        FROM base1
      ),period_base AS MATERIALIZED(
        SELECT * FROM base
        WHERE (${bounds.start}::text IS NULL OR date_key>=${bounds.start}::text)
          AND (${bounds.end}::text IS NULL OR date_key<=${bounds.end}::text)
      ),selected AS MATERIALIZED(
        SELECT * FROM period_base WHERE (${scopeCategory}::text IS NULL OR resolved_category=${scopeCategory}::text)
      ),scope_base AS MATERIALIZED(
        SELECT * FROM base WHERE (${scopeCategory}::text IS NULL OR resolved_category=${scopeCategory}::text)
      ),career AS(
        SELECT COALESCE(MIN(date_key) FILTER(WHERE NOT auxiliary),'') first_date,COALESCE(MAX(date_key) FILTER(WHERE NOT auxiliary),'') last_date,
          COUNT(*) FILTER(WHERE NOT auxiliary)::int flights,
          COALESCE(SUM(logged_minutes) FILTER(WHERE NOT auxiliary),0)::int minutes,
          COUNT(DISTINCT LEFT(date_key,4)) FILTER(WHERE NOT auxiliary AND date_key IS NOT NULL)::int active_years
        FROM scope_base
      ),career_years AS(
        SELECT LEFT(date_key,4)::int year_key,COUNT(*)::int flights,COALESCE(SUM(logged_minutes),0)::int minutes
        FROM scope_base WHERE NOT auxiliary AND date_key IS NOT NULL GROUP BY LEFT(date_key,4)
      ),career_best AS(
        SELECT
          COALESCE((SELECT year_key FROM career_years ORDER BY minutes DESC,flights DESC,year_key DESC LIMIT 1),0)::int busiest_year,
          COALESCE((SELECT minutes FROM career_years ORDER BY minutes DESC,flights DESC,year_key DESC LIMIT 1),0)::int busiest_year_minutes,
          COALESCE((SELECT flights FROM career_years ORDER BY minutes DESC,flights DESC,year_key DESC LIMIT 1),0)::int busiest_year_flights
      ),rolling_summary AS(
        SELECT
          COUNT(*) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd})::int current_flights,
          COALESCE(SUM(logged_minutes) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd}),0)::int current_minutes,
          COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd}),0)::int current_pic_minutes,
          COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd}),0)::int current_landings,
          COUNT(DISTINCT LEFT(date_key,7)) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd})::int current_active_months,
          COUNT(*) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd})::int previous_flights,
          COALESCE(SUM(logged_minutes) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd}),0)::int previous_minutes,
          COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd}),0)::int previous_pic_minutes,
          COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd}),0)::int previous_landings,
          COUNT(DISTINCT LEFT(date_key,7)) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd})::int previous_active_months
        FROM scope_base
      ),selected_summary AS(
        SELECT COUNT(*) FILTER(WHERE NOT auxiliary)::int selected_flights,
          COALESCE(SUM(logged_minutes) FILTER(WHERE NOT auxiliary),0)::int selected_minutes,
          COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary),0)::int selected_pic_minutes,
          COALESCE(SUM(copilot_minutes) FILTER(WHERE NOT auxiliary),0)::int selected_copilot_minutes,
          COALESCE(SUM(dual_minutes) FILTER(WHERE NOT auxiliary),0)::int selected_dual_minutes,
          COALESCE(SUM(instructor_minutes) FILTER(WHERE NOT auxiliary),0)::int selected_instructor_minutes,
          COALESCE(SUM(night_minutes) FILTER(WHERE NOT auxiliary),0)::int selected_night_minutes,
          COALESCE(SUM(ifr_minutes) FILTER(WHERE NOT auxiliary),0)::int selected_ifr_minutes,
          COALESCE(SUM(day_landings) FILTER(WHERE NOT auxiliary),0)::int selected_day_landings,
          COALESCE(SUM(night_landings) FILTER(WHERE NOT auxiliary),0)::int selected_night_landings,
          COALESCE(SUM(logged_minutes) FILTER(WHERE role='SAFETY PILOT'),0)::int selected_safety_minutes,
          COALESCE(SUM(cost) FILTER(WHERE NOT auxiliary),0)::double precision selected_cost,
          COUNT(DISTINCT NULLIF(registration,'')) FILTER(WHERE NOT auxiliary)::int selected_unique_aircraft
        FROM selected
      )
      SELECT career.*,career_best.*,rolling_summary.*,selected_summary.*,
        (SELECT COUNT(DISTINCT airport)::int FROM(SELECT NULLIF(departure,'') airport FROM selected WHERE NOT auxiliary UNION SELECT NULLIF(arrival,'') FROM selected WHERE NOT auxiliary)x WHERE airport IS NOT NULL) selected_unique_airports,
        (SELECT COUNT(*)::int FROM(SELECT departure,arrival FROM selected WHERE NOT auxiliary AND departure<>'' AND arrival<>'' GROUP BY departure,arrival)x) selected_unique_routes,
        COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.month_key) FROM(
          SELECT LEFT(date_key,7) month_key,COUNT(*)::int flights,COALESCE(SUM(logged_minutes),0)::int minutes,
            COALESCE(SUM(pic_minutes),0)::int pic_minutes,COALESCE(SUM(night_minutes),0)::int night_minutes,
            COALESCE(SUM(ifr_minutes),0)::int ifr_minutes,COALESCE(SUM(landings),0)::int landings
          FROM selected WHERE date_key IS NOT NULL AND NOT auxiliary GROUP BY LEFT(date_key,7)
        )m),'[]'::jsonb) monthly,
        COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.minutes DESC,r.flights DESC,r.role) FROM(
          SELECT COALESCE(NULLIF(role,''),'UNSPECIFIED') role,COUNT(*)::int flights,COALESCE(SUM(logged_minutes),0)::int minutes
          FROM selected WHERE NOT auxiliary GROUP BY COALESCE(NULLIF(role,''),'UNSPECIFIED')
        )r),'[]'::jsonb) roles,
        COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.minutes DESC,t.flights DESC,t.aircraft_type) FROM(
          SELECT COALESCE(NULLIF(aircraft_type,''),'Unknown') aircraft_type,COUNT(DISTINCT NULLIF(registration,''))::int registrations,
            COUNT(*)::int flights,COALESCE(SUM(logged_minutes),0)::int minutes,COALESCE(SUM(pic_minutes),0)::int pic_minutes,COALESCE(MAX(date_key),'') last_date
          FROM selected WHERE NOT auxiliary GROUP BY COALESCE(NULLIF(aircraft_type,''),'Unknown')
        )t),'[]'::jsonb) aircraft_types,
        COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.minutes DESC,c.flights DESC,c.aircraft_class) FROM(
          SELECT COALESCE(NULLIF(aircraft_class,''),'Unspecified') aircraft_class,COUNT(*)::int flights,
            COALESCE(SUM(logged_minutes),0)::int minutes,COALESCE(SUM(pic_minutes),0)::int pic_minutes,COALESCE(MAX(date_key),'') last_date
          FROM selected WHERE NOT auxiliary GROUP BY COALESCE(NULLIF(aircraft_class,''),'Unspecified')
        )c),'[]'::jsonb) aircraft_classes,
        COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.minutes DESC,c.flights DESC,c.category) FROM(
          SELECT resolved_category category,COUNT(*)::int flights,COALESCE(SUM(logged_minutes),0)::int minutes,
            COALESCE(SUM(pic_minutes),0)::int pic_minutes,COALESCE(MAX(date_key),'') last_date
          FROM selected WHERE NOT auxiliary GROUP BY resolved_category
        )c),'[]'::jsonb) categories,
        COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.minutes DESC,a.flights DESC,a.registration) FROM(
          SELECT registration,COUNT(*)::int flights,COALESCE(SUM(logged_minutes),0)::int minutes,COALESCE(SUM(cost),0)::double precision cost,COALESCE(MAX(date_key),'') last_date
          FROM selected WHERE NOT auxiliary AND registration<>'' GROUP BY registration
        )a),'[]'::jsonb) registrations,
        COALESCE((SELECT jsonb_agg(to_jsonb(ap) ORDER BY ap.visits DESC,ap.last_date DESC,ap.airport) FROM(
          SELECT airport,COUNT(*)::int visits,COALESCE(SUM(dep),0)::int departures,COALESCE(SUM(arr),0)::int arrivals,COALESCE(MIN(date_key),'') first_date,COALESCE(MAX(date_key),'') last_date
          FROM(
            SELECT date_key,departure airport,1 dep,CASE WHEN arrival=departure AND arrival<>'' THEN 1 ELSE 0 END arr FROM selected WHERE NOT auxiliary AND departure<>''
            UNION ALL
            SELECT date_key,arrival airport,0 dep,1 arr FROM selected WHERE NOT auxiliary AND arrival<>'' AND arrival<>departure
          )e GROUP BY airport ORDER BY COUNT(*) DESC,MAX(date_key) DESC NULLS LAST,airport LIMIT 100
        )ap),'[]'::jsonb) airports,
        COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.flights DESC,r.minutes DESC,r.last_date DESC,r.departure,r.arrival) FROM(
          SELECT departure||'→'||arrival route,departure,arrival,COUNT(*)::int flights,COALESCE(SUM(logged_minutes),0)::int minutes,COALESCE(MIN(date_key),'') first_date,COALESCE(MAX(date_key),'') last_date
          FROM selected WHERE NOT auxiliary AND departure<>'' AND arrival<>'' GROUP BY departure,arrival ORDER BY COUNT(*) DESC,SUM(logged_minutes) DESC,MAX(date_key) DESC NULLS LAST LIMIT 50
        )r),'[]'::jsonb) routes
      FROM career CROSS JOIN career_best CROSS JOIN rolling_summary CROSS JOIN selected_summary
    `,650) as Array<Record<string,unknown>>;
  const row=rows[0]??{};
  return{
    rangeLabel:bounds.label,
    scopeCategory,
    summary:{flights:n(row.selected_flights),minutes:n(row.selected_minutes),picMinutes:n(row.selected_pic_minutes),copilotMinutes:n(row.selected_copilot_minutes),dualMinutes:n(row.selected_dual_minutes),instructorMinutes:n(row.selected_instructor_minutes),nightMinutes:n(row.selected_night_minutes),ifrMinutes:n(row.selected_ifr_minutes),dayLandings:n(row.selected_day_landings),nightLandings:n(row.selected_night_landings),safetyMinutes:n(row.selected_safety_minutes),cost:n(row.selected_cost),uniqueAircraft:n(row.selected_unique_aircraft),uniqueAirports:n(row.selected_unique_airports),uniqueRoutes:n(row.selected_unique_routes)},
    monthly:jsonObjects(row.monthly).map(item=>({month:s(item.month_key),flights:n(item.flights),minutes:n(item.minutes),picMinutes:n(item.pic_minutes),nightMinutes:n(item.night_minutes),ifrMinutes:n(item.ifr_minutes),landings:n(item.landings)})),
    roles:jsonObjects(row.roles).map(item=>({role:s(item.role),flights:n(item.flights),minutes:n(item.minutes)})),
    aircraftTypes:jsonObjects(row.aircraft_types).map(item=>({aircraftType:s(item.aircraft_type),registrations:n(item.registrations),flights:n(item.flights),minutes:n(item.minutes),picMinutes:n(item.pic_minutes),lastDate:s(item.last_date)})),
    aircraftClasses:jsonObjects(row.aircraft_classes).map(item=>({aircraftClass:s(item.aircraft_class),flights:n(item.flights),minutes:n(item.minutes),picMinutes:n(item.pic_minutes),lastDate:s(item.last_date)})),
    categories:jsonObjects(row.categories).map(item=>({category:(normalizedCategory(item.category)??"OTHER"),flights:n(item.flights),minutes:n(item.minutes),picMinutes:n(item.pic_minutes),lastDate:s(item.last_date)})),
    registrations:jsonObjects(row.registrations).map(item=>({registration:s(item.registration),flights:n(item.flights),minutes:n(item.minutes),cost:n(item.cost),lastDate:s(item.last_date)})),
    airports:jsonObjects(row.airports).map(item=>({airport:s(item.airport),visits:n(item.visits),departures:n(item.departures),arrivals:n(item.arrivals),firstDate:s(item.first_date),lastDate:s(item.last_date)})),
    routes:jsonObjects(row.routes).map(item=>({route:s(item.route),departure:s(item.departure),arrival:s(item.arrival),flights:n(item.flights),minutes:n(item.minutes),firstDate:s(item.first_date),lastDate:s(item.last_date)})),
    current12m:{flights:n(row.current_flights),minutes:n(row.current_minutes),picMinutes:n(row.current_pic_minutes),landings:n(row.current_landings),activeMonths:n(row.current_active_months)},
    previous12m:{flights:n(row.previous_flights),minutes:n(row.previous_minutes),picMinutes:n(row.previous_pic_minutes),landings:n(row.previous_landings),activeMonths:n(row.previous_active_months)},
    career:{firstDate:s(row.first_date),lastDate:s(row.last_date),flights:n(row.flights),minutes:n(row.minutes),activeYears:n(row.active_years),busiestYear:n(row.busiest_year),busiestYearMinutes:n(row.busiest_year_minutes),busiestYearFlights:n(row.busiest_year_flights)},
  };
}
