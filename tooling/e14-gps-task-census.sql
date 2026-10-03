-- FlyTally E1.4 — historical synthetic GPS Task read-only census.
-- Purpose: measure scope and classify rows before any cleanup decision.
-- This file MUST remain SELECT-only. It intentionally ends with ROLLBACK.
-- Target: production database, only after the operator confirms the target.

BEGIN TRANSACTION READ ONLY;

SELECT
  current_database() AS database_name,
  current_user AS database_user,
  NOW() AS observed_at;

-- A. Discover exact and near-match live values. Only exact task='GPS import'
-- is eligible for the proposed cleanup; variants are evidence for manual review.
SELECT
  task AS task_value,
  COUNT(*) AS live_rows,
  COUNT(*) FILTER (WHERE certified_at IS NULL) AS currently_uncertified,
  COUNT(*) FILTER (WHERE certified_at IS NOT NULL) AS currently_certified,
  COUNT(DISTINCT user_id) AS affected_accounts,
  MIN(date) AS first_flight_date,
  MAX(date) AS last_flight_date
FROM flights
WHERE LOWER(BTRIM(COALESCE(task,'')))='gps import'
GROUP BY task
ORDER BY task;

-- B. Classify exact live rows. "Uncertified" alone is NOT enough:
-- a correction-open row may have certified history and must not be bulk-edited.
WITH exact AS (
  SELECT
    f.*,
    EXISTS(
      SELECT 1
      FROM flight_certified_revisions r
      WHERE r.user_id=f.user_id AND r.flight_id=f.id
    ) AS has_certified_history
  FROM flights f
  WHERE f.task='GPS import'
), classified AS (
  SELECT
    exact.*,
    CASE
      WHEN certified_at IS NOT NULL THEN 'CERTIFIED_CURRENT'
      WHEN has_certified_history
        OR COALESCE(record_revision,1)>1
        OR correction_opened_at IS NOT NULL
        THEN 'CORRECTION_OR_CERTIFIED_HISTORY'
      WHEN locked_at IS NOT NULL THEN 'LOCKED_DRAFT'
      WHEN COALESCE(certification_hash,'')<>'' THEN 'INCONSISTENT_UNCERTIFIED_HASH'
      ELSE 'ORDINARY_EDITABLE_DRAFT'
    END AS cleanup_class
  FROM exact
)
SELECT
  cleanup_class,
  COUNT(*) AS rows,
  COUNT(DISTINCT user_id) AS affected_accounts,
  MIN(date) AS first_flight_date,
  MAX(date) AS last_flight_date
FROM classified
GROUP BY cleanup_class
ORDER BY cleanup_class;

-- C. Minimal row-level evidence for exact live rows. No names/emails are emitted.
WITH exact AS (
  SELECT
    f.*,
    EXISTS(
      SELECT 1
      FROM flight_certified_revisions r
      WHERE r.user_id=f.user_id AND r.flight_id=f.id
    ) AS has_certified_history
  FROM flights f
  WHERE f.task='GPS import'
)
SELECT
  id,
  user_id,
  date,
  CASE
    WHEN certified_at IS NOT NULL THEN 'CERTIFIED_CURRENT'
    WHEN has_certified_history
      OR COALESCE(record_revision,1)>1
      OR correction_opened_at IS NOT NULL
      THEN 'CORRECTION_OR_CERTIFIED_HISTORY'
    WHEN locked_at IS NOT NULL THEN 'LOCKED_DRAFT'
    WHEN COALESCE(certification_hash,'')<>'' THEN 'INCONSISTENT_UNCERTIFIED_HASH'
    ELSE 'ORDINARY_EDITABLE_DRAFT'
  END AS cleanup_class,
  COALESCE(record_revision,1) AS record_revision,
  (certified_at IS NOT NULL) AS currently_certified,
  (locked_at IS NOT NULL) AS currently_locked,
  (correction_opened_at IS NOT NULL) AS correction_open,
  (COALESCE(certification_hash,'')<>'') AS certification_hash_present,
  has_certified_history,
  EXISTS(
    SELECT 1 FROM flight_participations p
    WHERE p.source_flight_id=exact.id AND p.source_user_id=exact.user_id
  ) AS has_participation_history,
  EXISTS(
    SELECT 1 FROM instructor_flight_approvals a
    WHERE a.flight_id=exact.id AND a.student_user_id=exact.user_id
  ) AS has_instructor_approval_history,
  EXISTS(
    SELECT 1 FROM flight_verifications v
    WHERE v.flight_id=exact.id AND v.flight_user_id=exact.user_id
  ) AS has_verification_history
FROM exact
ORDER BY cleanup_class,user_id,date,id;

-- D. Certified revision snapshots are immutable historical evidence and are
-- never cleanup candidates. Count exact and near-match values only.
SELECT
  snapshot_data->>'task' AS task_value,
  COUNT(*) AS revision_snapshots,
  COUNT(DISTINCT user_id) AS affected_accounts,
  MIN(certified_at) AS first_certified_at,
  MAX(certified_at) AS last_certified_at
FROM flight_certified_revisions
WHERE LOWER(BTRIM(COALESCE(snapshot_data->>'task','')))='gps import'
GROUP BY snapshot_data->>'task'
ORDER BY task_value;

-- E. Deleted-flight recovery copies are also historical/recovery evidence.
-- They are counted but never changed by E1.4 cleanup.
SELECT
  flight_data->>'task' AS task_value,
  COUNT(*) AS deleted_copies,
  COUNT(DISTINCT user_id) AS affected_accounts,
  MIN(deleted_at) AS first_deleted_at,
  MAX(deleted_at) AS last_deleted_at
FROM deleted_flights
WHERE LOWER(BTRIM(COALESCE(flight_data->>'task','')))='gps import'
GROUP BY flight_data->>'task'
ORDER BY task_value;

-- F. Audit history is evidence only. Count entries that captured the synthetic
-- value in either side of an audited change.
SELECT
  COUNT(*) AS audit_events_with_gps_import,
  COUNT(DISTINCT user_id) AS affected_accounts
FROM flight_audit_log
WHERE COALESCE(old_data->>'task','')='GPS import'
   OR COALESCE(new_data->>'task','')='GPS import';

ROLLBACK;
