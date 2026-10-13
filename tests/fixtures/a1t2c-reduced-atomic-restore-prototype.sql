-- A1-T2c D1 TEST-ONLY prototype, NOT a production migration or runtime API.
-- Run exclusively in a fresh disposable PG16 schema after reduced v20 + pinned v21 DDL.
-- Explicitly limited fixture columns; NOT full v20/Neon/portable-backup acceptance.
-- One SELECT a1t2c_try_restore(...) is one atomic PostgreSQL statement.
CREATE OR REPLACE FUNCTION a1t2c_try_restore(
  p_user_id BIGINT, p_trash_id BIGINT, p_hold_ms INT DEFAULT 0
) RETURNS TABLE(outcome TEXT, restored_flight_id BIGINT)
LANGUAGE plpgsql AS $a1t2c$
DECLARE
  src deleted_flights%ROWTYPE;
  f JSONB;
  t JSONB;
  e JSONB;
  restored flights%ROWTYPE;
  restored_track flight_tracks%ROWTYPE;
  restored_expense flight_expenses%ROWTYPE;
  n_tracks INT := 0;
  n_expenses INT := 0;
  key_text TEXT;
  tuple_present BOOLEAN;
BEGIN
  -- The source flight no longer exists. Lock the actual archival record.
  SELECT * INTO src FROM deleted_flights d
   WHERE d.id = p_trash_id AND d.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR src.restored_at IS NOT NULL OR src.purge_after <= clock_timestamp() THEN
    RETURN QUERY SELECT 'not_found_or_expired'::TEXT, NULL::BIGINT;
    RETURN;
  END IF;
  f := src.flight_data;
  IF jsonb_typeof(f) <> 'object'
     OR jsonb_typeof(src.tracks_data) <> 'array'
     OR jsonb_typeof(src.expenses_data) <> 'array'
     OR f->>'id' IS DISTINCT FROM src.original_flight_id::TEXT
     OR f->>'user_id' IS DISTINCT FROM p_user_id::TEXT
     OR (f->>'date') IS NULL
     OR (f->>'registration') IS NULL THEN
    RAISE EXCEPTION 'a1t2c_invalid_archive' USING ERRCODE='P8101';
  END IF;
  -- Reject certified/corrected and externally evidenced revision histories.
  IF (f->>'certified_at') IS NOT NULL
     OR (f->>'locked_at') IS NOT NULL
     OR COALESCE(f->>'certification_hash','') <> ''
     OR COALESCE(f->>'record_revision','1') <> '1'
     OR EXISTS (SELECT 1 FROM flight_certified_revisions r
                WHERE r.user_id=p_user_id AND r.flight_id=src.original_flight_id) THEN
    RAISE EXCEPTION 'a1t2c_protected_archive' USING ERRCODE='P8102';
  END IF;
  -- Do not infer old flight-price denomination. A v21 tuple is all or none.
  tuple_present := f->>'price_currency_code' IS NOT NULL
       OR f->>'price_currency_minor_units' IS NOT NULL
       OR f->>'price_per_hour_decimal' IS NOT NULL;
  IF tuple_present AND (
       f->>'price_currency_code' IS NULL
       OR f->>'price_currency_minor_units' IS NULL
       OR f->>'price_per_hour_decimal' IS NULL
       OR NOT (f->>'price_currency_code' ~ '^[A-Z]{3}$')
       OR NOT (f->>'price_currency_minor_units' ~ '^[0-9]$')
       OR NOT (f->>'price_per_hour_decimal' ~ '^[0-9]+(\.[0-9]+)?$')
    ) THEN
    RAISE EXCEPTION 'a1t2c_invalid_flight_money' USING ERRCODE='P8103';
  END IF;

  -- This is the EXISTING normalized restore identity, not new global uniqueness.
  key_text := jsonb_build_array(p_user_id,f->>'date',UPPER(TRIM(f->>'registration')),
    COALESCE(f->>'off_block',''),
    UPPER(TRIM(COALESCE(f->>'departure',''))),
    UPPER(TRIM(COALESCE(f->>'arrival',''))))::TEXT;
  -- Serializes COOPERATING restores, not unrelated Add/Edit writers.
  PERFORM pg_advisory_xact_lock(hashtextextended(key_text,0));
  IF p_hold_ms > 0 THEN PERFORM pg_sleep(LEAST(p_hold_ms,1200)::NUMERIC / 1000); END IF;
  IF EXISTS (
    SELECT 1 FROM flights x
     WHERE x.user_id=p_user_id AND x.date::TEXT=f->>'date'
       AND UPPER(TRIM(x.registration))=UPPER(TRIM(f->>'registration'))
       AND COALESCE(x.off_block,'')=COALESCE(f->>'off_block','')
       AND UPPER(TRIM(COALESCE(x.departure,'')))=UPPER(TRIM(COALESCE(f->>'departure','')))
       AND UPPER(TRIM(COALESCE(x.arrival,'')))=UPPER(TRIM(COALESCE(f->>'arrival','')))
  ) THEN
    RETURN QUERY SELECT 'duplicate'::TEXT,NULL::BIGINT;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(src.tracks_data) AS x(t)
     GROUP BY x.t->>'id' HAVING COUNT(*)>1
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(src.expenses_data) AS x(e)
     GROUP BY x.e->>'id' HAVING COUNT(*)>1
  ) THEN
    RAISE EXCEPTION 'a1t2c_duplicate_archived_child_id' USING ERRCODE='P8104';
  END IF;

  INSERT INTO flights (
    user_id,date,registration,off_block,departure,arrival,
    price_per_hour,billing_basis,note,
    price_currency_code,price_currency_minor_units,price_per_hour_decimal
  ) VALUES (
    p_user_id,(f->>'date')::DATE,f->>'registration',f->>'off_block',f->>'departure',f->>'arrival',
    (f->>'price_per_hour')::DOUBLE PRECISION,f->>'billing_basis',f->>'note',
    f->>'price_currency_code',(f->>'price_currency_minor_units')::SMALLINT,(f->>'price_per_hour_decimal')::NUMERIC
  ) RETURNING * INTO restored;
  -- Compare ALL non-ID fields represented by the reduced fixture, including exact NUMERIC.
  IF (to_jsonb(restored)-'id'-'user_id') IS DISTINCT FROM (f-'id'-'user_id') THEN
    RAISE EXCEPTION 'a1t2c_flight_preservation_mismatch' USING ERRCODE='P8105';
  END IF;
  FOR t IN SELECT value FROM jsonb_array_elements(src.tracks_data) AS x(value) LOOP
    IF jsonb_typeof(t) <> 'object' OR t->>'user_id' IS DISTINCT FROM p_user_id::TEXT
       OR t->>'flight_id' IS DISTINCT FROM src.original_flight_id::TEXT
       OR NOT (COALESCE(t->>'id','') ~ '^[1-9][0-9]*$') THEN
      RAISE EXCEPTION 'a1t2c_track_ownership' USING ERRCODE='P8106';
    END IF;
    INSERT INTO flight_tracks (
      user_id,flight_id,file_name,imported_at,point_count,distance_km,
      start_utc,end_utc,min_alt_m,max_alt_m,coordinates_json,
      overview_coordinates_json,overview_version
    ) VALUES (
      p_user_id,restored.id,t->>'file_name',(t->>'imported_at')::TIMESTAMPTZ,
      (t->>'point_count')::INT,(t->>'distance_km')::NUMERIC,
      (t->>'start_utc')::TIMESTAMPTZ,(t->>'end_utc')::TIMESTAMPTZ,
      (t->>'min_alt_m')::NUMERIC,(t->>'max_alt_m')::NUMERIC,
      t->>'coordinates_json',t->>'overview_coordinates_json',
      (t->>'overview_version')::INT
    ) RETURNING * INTO restored_track;
    IF (to_jsonb(restored_track)-'id'-'user_id'-'flight_id')
         IS DISTINCT FROM (t-'id'-'user_id'-'flight_id') THEN
      RAISE EXCEPTION 'a1t2c_track_preservation_mismatch' USING ERRCODE='P8107';
    END IF;
    n_tracks := n_tracks + 1;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(src.expenses_data) AS x(value) LOOP
    IF jsonb_typeof(e) <> 'object' OR e->>'user_id' IS DISTINCT FROM p_user_id::TEXT
       OR e->>'flight_id' IS DISTINCT FROM src.original_flight_id::TEXT
       OR NOT (COALESCE(e->>'id','') ~ '^[1-9][0-9]*$')
       OR NOT (COALESCE(e->>'amount_minor','') ~ '^[1-9][0-9]*$')
       OR (e->>'amount_minor')::NUMERIC > 1000000000
       OR NOT (COALESCE(e->>'currency','') ~ '^[A-Z]{3}$') THEN
      RAISE EXCEPTION 'a1t2c_expense_source_invalid' USING ERRCODE='P8108';
    END IF;
    IF NOT (
      ((e->>'amount_encoding') IS NULL AND (e->>'amount_minor_units') IS NULL)
      OR (e->>'amount_encoding'='legacy_two_decimal' AND e->>'amount_minor_units'='2')
      OR (e->>'amount_encoding'='iso_minor_units' AND e->>'amount_minor_units' ~ '^[0-9]$')
    ) THEN
      RAISE EXCEPTION 'a1t2c_expense_encoding_invalid' USING ERRCODE='P8109';
    END IF;
    INSERT INTO flight_expenses(
      user_id,flight_id,category,label,amount_minor,currency,created_at,
      amount_encoding,amount_minor_units
    ) VALUES(
      p_user_id,restored.id,e->>'category',e->>'label',(e->>'amount_minor')::BIGINT,
      e->>'currency',(e->>'created_at')::TIMESTAMPTZ,
      e->>'amount_encoding',(e->>'amount_minor_units')::SMALLINT
    ) RETURNING * INTO restored_expense;
    IF (to_jsonb(restored_expense)-'id'-'user_id'-'flight_id')
       IS DISTINCT FROM (e-'id'-'user_id'-'flight_id') THEN
      RAISE EXCEPTION 'a1t2c_expense_preservation_mismatch' USING ERRCODE='P8110';
    END IF;
    n_expenses := n_expenses+1;
  END LOOP;
  IF n_tracks <> jsonb_array_length(src.tracks_data)
     OR n_expenses <> jsonb_array_length(src.expenses_data) THEN
    RAISE EXCEPTION 'a1t2c_child_count_mismatch' USING ERRCODE='P8111';
  END IF;
  UPDATE deleted_flights d SET restored_at=clock_timestamp(),restored_flight_id=restored.id
    WHERE d.id=src.id AND d.user_id=p_user_id AND d.restored_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'a1t2c_marker_failure' USING ERRCODE='P8112';
  END IF;
  RETURN QUERY SELECT 'restored'::TEXT,restored.id;
END;
$a1t2c$;
