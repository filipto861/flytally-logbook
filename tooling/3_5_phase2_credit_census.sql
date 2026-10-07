-- FlyTally 3.5.0 Phase 2
-- READ-ONLY production census for Part-FCL aircraft-credit tuple shapes.
-- Returns aggregate counts only: no user ids, registrations, basis text or other row content.

WITH normalized AS (
  SELECT
    id,
    user_id,
    active,
    UPPER(TRIM(COALESCE(part_fcl_credit_class,''))) AS credit_class,
    TRIM(COALESCE(part_fcl_credit_basis,'')) AS credit_basis,
    TRIM(COALESCE(part_fcl_credit_from,'')) AS credit_from
  FROM aircraft
),
classified AS (
  SELECT
    *,
    CASE
      WHEN credit_class='' THEN 'NONE'
      WHEN credit_class NOT IN ('SEP','TMG') THEN 'INVALID_CLASS'
      WHEN credit_from<>'' AND NOT (
        credit_from ~ '^\\d{4}-\\d{2}-\\d{2}$'
        AND pg_input_is_valid(credit_from,'date')
      ) THEN 'INVALID_DATE'
      WHEN credit_basis<>'' AND credit_from<>'' THEN 'COMPLETE'
      WHEN credit_basis='' AND credit_from='' THEN 'CLASS_ONLY'
      WHEN credit_basis<>'' AND credit_from='' THEN 'BASIS_NO_DATE'
      WHEN credit_basis='' AND credit_from<>'' THEN 'DATE_NO_BASIS'
      ELSE 'OTHER'
    END AS credit_shape
  FROM normalized
),
flight_counts AS (
  SELECT
    a.id AS aircraft_id,
    COUNT(f.id)::bigint AS flights,
    COUNT(f.id) FILTER (
      WHERE f.certified_at IS NOT NULL
        AND UPPER(TRIM(COALESCE(f.evidence,'')))='ULL'
    )::bigint AS certified_ull_flights
  FROM aircraft a
  LEFT JOIN flights f
    ON f.user_id=a.user_id
   AND UPPER(TRIM(f.registration))=UPPER(TRIM(a.registration))
  GROUP BY a.id
)
SELECT
  c.credit_shape,
  COUNT(*)::bigint AS aircraft_profiles,
  COUNT(*) FILTER (WHERE c.active=1)::bigint AS active_profiles,
  COUNT(*) FILTER (WHERE c.active=0)::bigint AS inactive_profiles,
  COALESCE(SUM(fc.flights),0)::bigint AS saved_flights,
  COALESCE(SUM(fc.certified_ull_flights),0)::bigint AS certified_ull_flights
FROM classified c
LEFT JOIN flight_counts fc ON fc.aircraft_id=c.id
GROUP BY c.credit_shape
ORDER BY
  CASE c.credit_shape
    WHEN 'NONE' THEN 1
    WHEN 'COMPLETE' THEN 2
    WHEN 'CLASS_ONLY' THEN 3
    WHEN 'BASIS_NO_DATE' THEN 4
    WHEN 'DATE_NO_BASIS' THEN 5
    WHEN 'INVALID_DATE' THEN 6
    WHEN 'INVALID_CLASS' THEN 7
    ELSE 8
  END,
  c.credit_shape;
