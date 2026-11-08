-- Fail-closed P5 privilege matrix against the *actual* V22 candidate,
-- not the synthetic SECURITY DEFINER model. CI-owned loopback PG16 only.
-- Creates no roles, grants or data; all actors are created by the guarded CI.
DO $m0b_p5$
DECLARE
  v_role TEXT;
  v_sig TEXT;
  v_oid OID;
  v_security_definer BOOLEAN;
  v_config TEXT[];
  v_names TEXT[]:=ARRAY[
    'public.logbook_v22_reject_witness_change_candidate()',
    'public.logbook_v22_expire_owner_candidate(bigint,integer)',
    'public.logbook_v22_attest_redelete_candidate(bigint,uuid,bigint,bigint)',
    'public.logbook_v22_finalize_restored_source_candidate(bigint,bigint)',
    'public.logbook_v22_redelete_source_candidate(bigint,bigint,uuid)'
  ];
  v_roles TEXT[]:=ARRAY['m0b_v22_read_only','m0b_v22_p5_pilot_a',
    'm0b_v22_p5_pilot_b','m0b_v22_p5_sweep'];
BEGIN
  IF current_database()<>'flytally_m0b_disposable_full_v21'
    OR current_user<>'flytally'
    OR coalesce(host(inet_server_addr()),'')<>'127.0.0.1'
    OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999
    OR to_regclass('public.flytally_schema_migrations') IS NULL
    OR (SELECT count(*) FROM public.flytally_schema_migrations)<>21
    OR to_regclass('public.logbook_event_uid_registry') IS NULL
  THEN
    RAISE EXCEPTION 'Refused P5 privilege matrix outside owned full-V21 disposable loopback PG16';
  END IF;
  FOREACH v_role IN ARRAY v_roles LOOP
    IF to_regrole(v_role) IS NULL
      OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=v_role AND rolcanlogin)
      OR NOT has_schema_privilege(v_role,'public','USAGE')
      OR pg_has_role(v_role,'flytally','MEMBER')
      OR has_table_privilege(v_role,'public.deleted_flights','SELECT')
      OR has_table_privilege(v_role,'public.deleted_flights','DELETE')
      OR has_table_privilege(v_role,'public.flights','UPDATE')
      OR has_table_privilege(v_role,'public.logbook_event_uid_registry','UPDATE')
      OR has_table_privilege(v_role,'public.logbook_v22_restored_source_receipt_candidate','INSERT')
    THEN
      RAISE EXCEPTION 'P5 limited principal has wrong login, membership, schema or table access: %',v_role;
    END IF;
  END LOOP;
  FOREACH v_sig IN ARRAY v_names LOOP
    v_oid:=to_regprocedure(v_sig)::oid;
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'P5 V22 candidate function not installed: %',v_sig;
    END IF;
    SELECT prosecdef,proconfig INTO v_security_definer,v_config FROM pg_proc WHERE oid=v_oid;
    IF v_security_definer
      OR NOT ('search_path=pg_catalog,pg_temp'=ANY(coalesce(v_config,ARRAY[]::text[])))
      OR EXISTS(SELECT 1 FROM aclexplode(coalesce(
           (SELECT proacl FROM pg_proc WHERE oid=v_oid),
           acldefault('f',(SELECT proowner FROM pg_proc WHERE oid=v_oid))))
         WHERE grantee=0 AND privilege_type='EXECUTE')
      OR NOT has_function_privilege(current_user,v_oid,'EXECUTE')
    THEN
      RAISE EXCEPTION 'P5 candidate has unsafe definer, search path, PUBLIC grant or owner privileges: %',v_sig;
    END IF;
    FOREACH v_role IN ARRAY v_roles LOOP
      IF has_function_privilege(v_role,v_oid,'EXECUTE') THEN
        RAISE EXCEPTION 'P5 unauthorized role can execute V22 candidate % via %',v_sig,v_role;
      END IF;
    END LOOP;
  END LOOP;
END
$m0b_p5$;
