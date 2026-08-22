import "server-only";
import { sql } from "@/lib/db";
import { airportCatalogSize,airportCodeMigrations,getCatalogAirport } from "@/lib/airport-catalog";
export async function getDatabaseData(userId:number){
  const [aircraft,rates,airports,quality,issues,airportStats,routeCodes]=await Promise.all([
    sql`SELECT a.id,a.registration,a.aircraft_type,a.icao_type,a.aircraft_class,a.evidence,a.default_price_per_hour,a.default_role,a.billing_basis,a.active,a.note,COALESCE(current_rate.price_per_hour,a.default_price_per_hour,0) current_price_per_hour,current_rate.valid_from current_price_valid_from,COALESCE(rate_stats.rate_count,0)::int rate_count FROM aircraft a LEFT JOIN LATERAL (SELECT price_per_hour,valid_from FROM rates r WHERE r.user_id=a.user_id AND UPPER(TRIM(r.registration))=UPPER(TRIM(a.registration)) AND (r.valid_from IS NULL OR r.valid_from='' OR r.valid_from<=CURRENT_DATE::text) ORDER BY r.valid_from DESC NULLS LAST,r.id DESC LIMIT 1) current_rate ON TRUE LEFT JOIN LATERAL (SELECT COUNT(*)::int rate_count FROM rates r WHERE r.user_id=a.user_id AND UPPER(TRIM(r.registration))=UPPER(TRIM(a.registration))) rate_stats ON TRUE WHERE a.user_id=${userId} ORDER BY a.active DESC,a.registration`,
    sql`SELECT id,registration,aircraft_type,valid_from,price_per_hour,dry_price_per_hour,source FROM rates WHERE user_id=${userId} ORDER BY registration,valid_from DESC NULLS LAST`,
    sql`SELECT id,ident,name,municipality,iso_country,latitude_deg,longitude_deg,active,closed,source FROM airports WHERE user_id=${userId} ORDER BY active DESC,ident LIMIT 500`,
    sql`WITH flight_quality AS (
      SELECT COUNT(*)::int total,
        COUNT(*) FILTER(WHERE NULLIF(TRIM(registration),'') IS NULL)::int missing_registration,
        COUNT(*) FILTER(WHERE NULLIF(TRIM(departure),'') IS NULL OR NULLIF(TRIM(arrival),'') IS NULL)::int missing_route,
        COUNT(*) FILTER(WHERE off_block !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR on_block !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')::int invalid_block_time,
        COUNT(*) FILTER(WHERE price_per_hour IS NULL OR price_per_hour<=0)::int missing_price,
        COUNT(*) FILTER(WHERE NULLIF(TRIM(evidence),'') IS NULL OR NULLIF(TRIM(role),'') IS NULL)::int missing_classification
      FROM flights WHERE user_id=${userId}
    ), track_quality AS (
      SELECT COUNT(*)::int tracks,
        COUNT(*) FILTER(WHERE COALESCE(point_count,0)<2)::int empty_tracks,
        COUNT(*) FILTER(WHERE COALESCE(distance_km,0)<=0)::int zero_distance_tracks
      FROM flight_tracks WHERE user_id=${userId}
    ), rate_quality AS (
      SELECT COUNT(*)::int historical_rates,
        COUNT(*) FILTER(WHERE valid_from IS NULL OR valid_from='' OR valid_from !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')::int invalid_rate_dates,
        COUNT(*) FILTER(WHERE price_per_hour IS NULL OR price_per_hour<=0)::int invalid_rates,
        COUNT(*) FILTER(WHERE valid_from ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND valid_from>CURRENT_DATE::text)::int future_rates
      FROM rates WHERE user_id=${userId}
    ), duplicate_flights AS (
      SELECT COALESCE(SUM(n-1),0)::int duplicate_flights FROM (
        SELECT COUNT(*) n FROM flights WHERE user_id=${userId}
        GROUP BY date,UPPER(TRIM(registration)),UPPER(TRIM(departure)),UPPER(TRIM(arrival)),off_block,on_block HAVING COUNT(*)>1
      ) d
    ) SELECT * FROM flight_quality CROSS JOIN track_quality CROSS JOIN rate_quality CROSS JOIN duplicate_flights`,
    sql`WITH base AS (SELECT f.*,a.registration profile_registration,a.evidence profile_evidence,a.aircraft_class profile_class,a.aircraft_type profile_type FROM flights f LEFT JOIN aircraft a ON a.user_id=f.user_id AND UPPER(TRIM(a.registration))=UPPER(TRIM(f.registration)) WHERE f.user_id=${userId}), duplicates AS (SELECT id,ROW_NUMBER() OVER(PARTITION BY date,UPPER(TRIM(registration)),UPPER(TRIM(departure)),UPPER(TRIM(arrival)),off_block,takeoff,landing,on_block ORDER BY id) duplicate_rank FROM base), findings AS (
      SELECT id,'problem' severity,'missing_registration' code,'Missing aircraft registration' title,'Flight is not assigned to an aircraft.' detail FROM base WHERE NULLIF(TRIM(registration),'') IS NULL
      UNION ALL SELECT id,'problem','invalid_date','Invalid flight date','Date cannot be used for chronology, filters or export.' FROM base WHERE date IS NULL OR date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      UNION ALL SELECT id,'warning','missing_route','Departure or arrival airport missing','Route map and statistics will be incomplete.' FROM base WHERE NULLIF(TRIM(departure),'') IS NULL OR NULLIF(TRIM(arrival),'') IS NULL
      UNION ALL SELECT id,'problem','invalid_block_time','Invalid or incomplete BLOCK time','Check Off-block and On-block.' FROM base WHERE NULLIF(TRIM(off_block),'') IS NOT NULL AND (off_block !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR on_block !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      UNION ALL SELECT id,'warning','missing_time_pair','Incomplete time pair','Off-block/On-block and Takeoff/Landing must be entered together.' FROM base WHERE (NULLIF(TRIM(off_block),'') IS NULL)<>(NULLIF(TRIM(on_block),'') IS NULL) OR (NULLIF(TRIM(takeoff),'') IS NULL)<>(NULLIF(TRIM(landing),'') IS NULL)
      UNION ALL SELECT id,'warning','extreme_block','Unusually long BLOCK','Calculated BLOCK exceeds 18 hours.' FROM base WHERE off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440)>1080
      UNION ALL SELECT id,'warning','implausible_taxi','Unusually long taxi time','Difference between BLOCK and AIR exceeds 180 minutes.' FROM base WHERE off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND takeoff ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND landing ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440)-MOD((split_part(landing,':',1)::int*60+split_part(landing,':',2)::int)-(split_part(takeoff,':',1)::int*60+split_part(takeoff,':',2)::int)+1440,1440)>180
      UNION ALL SELECT id,'warning','missing_classification','Logbook, role or class missing','ULL/EASA and PIC/DUAL totals may be incomplete.' FROM base WHERE NULLIF(TRIM(evidence),'') IS NULL OR NULLIF(TRIM(role),'') IS NULL OR NULLIF(TRIM(aircraft_class),'') IS NULL
      UNION ALL SELECT id,'warning','missing_price','Historical flight rate missing','Flight rate was not captured when saved.' FROM base WHERE price_per_hour IS NULL OR price_per_hour<=0
      UNION ALL SELECT id,'warning','aircraft_without_profile','Aircraft profile missing','Aircraft defaults and consistency checks are unavailable.' FROM base WHERE NULLIF(TRIM(registration),'') IS NOT NULL AND profile_registration IS NULL
      UNION ALL SELECT id,'warning','profile_mismatch','Flight differs from aircraft profile','Logbook, class or type differs from the current aircraft profile.' FROM base WHERE profile_registration IS NOT NULL AND ((NULLIF(TRIM(evidence),'') IS NOT NULL AND UPPER(TRIM(evidence))<>UPPER(TRIM(profile_evidence))) OR (NULLIF(TRIM(aircraft_class),'') IS NOT NULL AND UPPER(TRIM(aircraft_class))<>UPPER(TRIM(profile_class))) OR (NULLIF(TRIM(aircraft_type),'') IS NOT NULL AND LOWER(TRIM(aircraft_type))<>LOWER(TRIM(profile_type))))
      UNION ALL SELECT b.id,'problem','exact_duplicate','Exact duplicate flight','A flight with identical times appears more than once.' FROM base b JOIN duplicates d ON d.id=b.id WHERE d.duplicate_rank>1
      UNION ALL SELECT id,'warning','unknown_departure','Unknown departure airport','Code is not in the custom or global airport catalogue.' FROM base b WHERE NULLIF(TRIM(departure),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM airports x WHERE UPPER(x.ident)=UPPER(TRIM(b.departure)) AND x.active=1 AND COALESCE(x.closed,0)=0 AND (x.user_id=${userId} OR LOWER(COALESCE(x.source,'')) LIKE 'ourairports%'))
      UNION ALL SELECT id,'warning','unknown_arrival','Unknown arrival airport','Code is not in the custom or global airport catalogue.' FROM base b WHERE NULLIF(TRIM(arrival),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM airports x WHERE UPPER(x.ident)=UPPER(TRIM(b.arrival)) AND x.active=1 AND COALESCE(x.closed,0)=0 AND (x.user_id=${userId} OR LOWER(COALESCE(x.source,'')) LIKE 'ourairports%'))
      UNION ALL SELECT id,'problem','air_exceeds_block','AIR time exceeds BLOCK','Check the flight time order.' FROM base WHERE off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND takeoff ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND landing ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND MOD((split_part(landing,':',1)::int*60+split_part(landing,':',2)::int)-(split_part(takeoff,':',1)::int*60+split_part(takeoff,':',2)::int)+1440,1440)>MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440)+5
      UNION ALL SELECT b.id,'problem','track_too_short','GPS track has too few points','Track must contain at least two valid points.' FROM base b JOIN flight_tracks t ON t.flight_id=b.id AND t.user_id=b.user_id WHERE COALESCE(t.point_count,0)<2
      UNION ALL SELECT b.id,'warning','track_zero_distance','GPS track has zero distance','Check the saved track geometry.' FROM base b JOIN flight_tracks t ON t.flight_id=b.id AND t.user_id=b.user_id WHERE COALESCE(t.point_count,0)>=2 AND COALESCE(t.distance_km,0)<=0
    ) SELECT f.*,b.date,b.registration,b.departure,b.arrival FROM findings f JOIN base b ON b.id=f.id ORDER BY CASE severity WHEN 'problem' THEN 0 ELSE 1 END,b.date DESC,b.id DESC LIMIT 250`,
    sql`SELECT COUNT(DISTINCT UPPER(ident))::int total,COUNT(DISTINCT UPPER(ident)) FILTER(WHERE user_id=${userId})::int own FROM airports WHERE active=1 AND COALESCE(closed,0)=0 AND (user_id=${userId} OR LOWER(COALESCE(source,'')) LIKE 'ourairports%')`,
    sql`WITH codes AS (
      SELECT UPPER(TRIM(departure)) code,COUNT(*)::int departures,0::int arrivals FROM flights WHERE user_id=${userId} AND UPPER(TRIM(COALESCE(departure,''))) ~ '^CZ-[0-9]{4}$' GROUP BY 1
      UNION ALL
      SELECT UPPER(TRIM(arrival)) code,0::int departures,COUNT(*)::int arrivals FROM flights WHERE user_id=${userId} AND UPPER(TRIM(COALESCE(arrival,''))) ~ '^CZ-[0-9]{4}$' GROUP BY 1
    ) SELECT code,SUM(departures)::int departures,SUM(arrivals)::int arrivals FROM codes GROUP BY code ORDER BY code`
  ]);
  const visibleIssues=issues.filter(issue=>issue.code==="unknown_departure"?!getCatalogAirport(String(issue.departure??"")):issue.code==="unknown_arrival"?!getCatalogAirport(String(issue.arrival??"")):true),stats=airportStats[0]??{},counts=new Map(routeCodes.map(row=>[String(row.code),row])),codeMigrations=airportCodeMigrations(routeCodes.map(row=>String(row.code))).map(item=>{const count=counts.get(item.from)??{};return{...item,departures:Number(count.departures??0),arrivals:Number(count.arrivals??0)}});
  return {aircraft,rates,airports,quality:quality[0]??{},issues:visibleIssues,airportStats:{...stats,total:Math.max(Number(stats.total??0),airportCatalogSize())},codeMigrations} as {aircraft:Array<Record<string,unknown>>;rates:Array<Record<string,unknown>>;airports:Array<Record<string,unknown>>;quality:Record<string,unknown>;issues:Array<Record<string,unknown>>;airportStats:Record<string,unknown>;codeMigrations:Array<{from:string;to:string;name:string;departures:number;arrivals:number}>};
}
