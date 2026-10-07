-- FlyTally 3.5.0 Phase 2
-- READ-ONLY production census for Part-FCL aircraft-credit tuple shapes.
-- Returns aggregate counts only: no user ids, registrations, basis text or other row content.

WITH raw AS (
  SELECT
    id,
    user_id,
    registration,
    active,
    UPPER(TRIM(COALESCE(part_fcl_credit_class,''))) AS credit_class,
    TRIM(COALESCE(part_fcl_credit_basis,'')) AS credit_basis,
    TRIM(COALESCE(part_fcl_credit_from,'')) AS credit_from
  FROM aircraft
),
classified AS (
  SELECT
    r.*,
    CASE
      WHEN r.credit_class='' AND r.credit_basis='' AND r.credit_from='' THEN 'NONE'
      WHEN r.credit_class='' THEN 'ORPHAN_METADATA'
      WHEN r.credit_class NOT IN ('SEP','TMG') THEN 'INVALID_CLASS'
      WHEN r.credit_from<>'' AND (
        r.credit_from !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        OR NOT pg_input_is_valid(r.credit_from,'date')
      ) THEN 'INVALID_DATE'
      WHEN r.credit_basis<>'' AND r.credit_from<>'' THEN 'COMPLETE'
      WHEN r.credit_basis='' AND r.credit_from='' THEN 'CLASS_ONLY'
      WHEN r.credit_basis<>'' AND r.credit_from='' THEN 'BASIS_NO_DATE'
      WHEN r.credit_basis='' AND r.credit_from<>'' THEN 'DATE_NO_BASIS'
      ELSE 'OTHER'
    END AS credit_shape
  FROM raw r
),
joined AS (
  SELECT
    c.*,
    COUNT(f.id)::bigint AS flights,
    COUNT(f.id) FILTER (
      WHERE f.certified_at IS NOT NULL
        AND UPPER(TRIM(COALESCE(f.evidence,'')))='ULL'
    )::bigint AS certified_ull_flights
  FROM classified c
  LEFT JOIN flights f
    ON f.user_id=c.user_id
   AND UPPER(TRIM(f.registration))=UPPER(TRIM(c.registration))
  GROUP BY c.id,c.user_id,c.registration,c.active,c.credit_class,c.credit_basis,c.credit_from,c.credit_shape
)
SELECT
  credit_shape,
  COUNT(*)::bigint AS aircraft_profiles,
  COUNT(*) FILTER (WHERE active=1)::bigint AS active_profiles,
  COUNT(*) FILTER (WHERE active=0)::bigint AS inactive_profiles,
  COALESCE(SUM(flights),0)::bigint AS saved_flights,
  COALESCE(SUM(certified_ull_flights),0)::bigint AS certified_ull_flights
FROM joined
GROUP BY credit_shape
ORDER BY
  CASE credit_shape
    WHEN 'NONE' THEN 1
    WHEN 'COMPLETE' THEN 2
    WHEN 'CLASS_ONLY' THEN 3
    WHEN 'BASIS_NO_DATE' THEN 4
    WHEN 'DATE_NO_BASIS' THEN 5
    WHEN 'ORPHAN_METADATA' THEN 6
    WHEN 'INVALID_DATE' THEN 7
    WHEN 'INVALID_CLASS' THEN 8
    ELSE 9
  END,
  credit_shape;
