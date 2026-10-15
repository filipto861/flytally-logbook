# DeepSeek R1 follow-up — self-contained code-level review package (exact source)

**Date:** 15 October 2026. **Read-only review only.** **DO NOT EXECUTE CODE BLOCKS:** each line has a numeric `NNNN | ` prefix and is for source comparison only.

Repository: `filipto861/flytally-logbook`; Draft PR #338.
**Frozen accepted application SHA:** `4f8165272ff5dc33facdc60af1931f37b97c0303`. All extracts below fetched from this **exact** commit, not the later docs-only HEAD. Any source edit or production-operation request needs a separate owner approval.

The previous DeepSeek review read only documentation and classified B1-B5, H1-H5. Please now inspect the code below and **reconcile or dismiss** each finding with path and line numbers. Special attention:

1. **B2:** A `public.flytally_branch_identity` sentinel inserted on production will be **copied onto cloned branches**, so is not a reliable independent Neon branch identity. Evaluate branch ID + endpoint hostname reconciliation from Neon API and explicitly checked operator URL immediately before DDL, without extra live DDL.
2. **H1:** `lib/db-optimization.ts` currently permits automatic v21 with `FLYTALLY_LOCAL_POSTGRES=1` and a loopback hostname alone; verify production fail-closed and propose an additional allowlisted fixture **DB name, username and purpose-specific flag**, with `VERCEL` denial. The owner-local Playwright suite launches an optimized **production** Next.js build on its disposable `flytally_currency_test` database, so a blanket `NODE_ENV==='production'` veto would reject legitimate local acceptance. Account for this explicitly.
3. **H2/H3:** SQL does `BEGIN` -> `SET LOCAL lock_timeout='5s'`, `statement_timeout='60s'`, `search_path=public,pg_catalog` -> `set_config(..., true)` -> `pg_advisory_xact_lock(704190104)` -> precondition DO -> DDL. This is lock **before transactional preconditions**, not necessarily the first SQL command after BEGIN. Catalog queries filter `public` for columns/constraints; DDL table names themselves are unqualified and depend on pinned search path. Suggest any hardening.
4. **H4:** The existing `main` v20 runtime reads only migration versions `<=DATABASE_SCHEMA_VERSION`, so version21 registry is ignored; no complete v20-application-on-v21 data compatibility test has yet run.
5. **H5:** `migrateDatabase()` skips v21 DDL if `SELECT version ...` already finds v21, without independently validating all required columns/types/nullability/checks or their validity. Evaluate a cheap shape assertion on pre-registered 21 and other fail-closed states.
6. **B1/B3/B5:** Canonical Neon `br-raspy-fog-b1btvu5t`, PostgreSQL 18.6, is owner-approved but `protected:false`; no current-branch new snapshot and no true real-history signed-v13 recovery proof. **These cannot be cleared by code source review.** Never mutate canonical production in this consultation.
7. **B4:** pinned SIX XML origin is explicitly owner-attested and byte-pinned, but not independently downloaded from official SIX. Keep that distinction; advise release policy, do not invent approval.

**Evidence:** owner-local on `4f8165272ff5dc33facdc60af1931f37b97c0303`: TypeScript PASS, native disposable PG16 source 6/6 + integration 9/9 + executable release SQL 3/3, full Node 1549/1549, Next build 41/41 twice, authenticated desktop/mobile browser 8/8 and schema postcheck 1|12|4. These are **local**, not PG18 production or CI. Exact SQL Git blob IDs: preflight `a7bb228aa65cbaeb13df0e3c9de4c8f79170d152`; migrate `4abc32a9430943affaaa836e6737ad7b1c9021f4`; postflight `57fa4685ac8658bc637bcb5055a46312df9a79d9`.

**Request back:** BLOCKERS/HIGH/MEDIUM/LOW with evidence, confirm mitigations separately from release-procedural gates, propose minimal implementation batch plus negative tests, and explicitly distinguish executable fixes versus operator controls versus evidence gaps. Do not edit repository, change branch/snapshot/protection, merge, or deploy.

## Source excerpts and complete release artifacts

### `tooling/v380-v21-preflight.sql` — lines 1-112

Read-only exact source (line prefix is not SQL/code):

```text
0001 | \set ON_ERROR_STOP on
0002 | \pset pager off
0003 | \if :{?expected_database}
0004 | \else
0005 |   \echo 'Required -v expected_database=... is missing. STOP.'
0006 |   SELECT 1/0; -- ON_ERROR_STOP must terminate with a non-zero exit
0007 | \endif
0008 | 
0009 | -- READ ONLY. Explicit -v expected_database=neondb is required; branch identity
0010 | -- must be separately proven via Neon before any production execution.
0011 | BEGIN TRANSACTION READ ONLY;
0012 | SET LOCAL search_path=public,pg_catalog;
0013 | SELECT set_config('flytally.expected_database', :'expected_database',true);
0014 | 
0015 | SELECT current_database() AS db,current_user AS db_user,pg_is_in_recovery() AS replica,now() AS observed_at;
0016 | DO $v380$
0017 | DECLARE
0018 |   expected_names text[] := ARRAY[
0019 |     'flight audit and locking',
0020 |     'backups and recoverable trash',
0021 |     'core query indexes',
0022 |     'restore and route performance indexes',
0023 |     'EASA FCL.050 flight logbook fields',
0024 |     'FCL.050 structured aircraft, FSTD and certification',
0025 |     'certified flight correction revisions',
0026 |     'certified FSTD correction revisions',
0027 |     'private beta authentication foundation',
0028 |     'private pilot connections',
0029 |     'instructor flight approvals',
0030 |     'shared flight participation',
0031 |     'crew connections and verified approvals',
0032 |     'user-owned structured flight expenses',
0033 |     'Safety Pilot connected PIC collaboration',
0034 |     'general PIC invitation provenance',
0035 |     'historical flight aircraft identity preservation',
0036 |     'aircraft default operation type',
0037 |     'aircraft default engine type',
0038 |     'certified flight void archive and provenance'
0039 |   ];
0040 |   actual_name text;
0041 |   v integer;
0042 | BEGIN
0043 |   IF current_database() IS DISTINCT FROM current_setting('flytally.expected_database',true) THEN
0044 |     RAISE EXCEPTION 'v21: wrong database target';
0045 |   END IF;
0046 |   IF pg_is_in_recovery() THEN
0047 |     RAISE EXCEPTION 'v21: cannot migrate a recovery replica';
0048 |   END IF;
0049 |   IF to_regclass('public.flytally_schema_migrations') IS NULL THEN
0050 |     RAISE EXCEPTION 'v21: migration registry absent';
0051 |   END IF;
0052 |   FOR v IN 1..20 LOOP
0053 |     SELECT name INTO actual_name FROM public.flytally_schema_migrations WHERE version=v;
0054 |     IF actual_name IS DISTINCT FROM expected_names[v] THEN
0055 |       RAISE EXCEPTION 'v21: registry name drift at version %',v;
0056 |     END IF;
0057 |   END LOOP;
0058 |   IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>20
0059 |     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>20) THEN
0060 |     RAISE EXCEPTION 'v21: registry must be exactly 1 through 20';
0061 |   END IF;
0062 |   IF NOT (to_regclass('public.rates') IS NOT NULL AND
0063 |       to_regclass('public.aircraft') IS NOT NULL AND
0064 |       to_regclass('public.flights') IS NOT NULL AND
0065 |       to_regclass('public.flight_expenses') IS NOT NULL) THEN
0066 |     RAISE EXCEPTION 'v21: required monetary table missing';
0067 |   END IF;
0068 |   IF to_regclass('public.voided_certified_flights') IS NULL
0069 |     OR to_regclass('public.flight_source_provenance') IS NULL
0070 |     OR to_regprocedure('public.logbook_protect_locked_flight()') IS NULL
0071 |     OR to_regprocedure('public.logbook_protect_source_provenance()') IS NULL
0072 |     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0073 |       AND tgname='trg_logbook_protect_locked_flight' AND NOT tgisinternal)
0074 |     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0075 |       AND tgname='trg_logbook_prevent_voided_flight_id_reuse' AND NOT tgisinternal) THEN
0076 |     RAISE EXCEPTION 'v21: required v20 protected history or triggers missing';
0077 |   END IF;
0078 |   IF EXISTS(
0079 |     SELECT 1 FROM information_schema.columns
0080 |     WHERE table_schema='public' AND (
0081 |       (table_name='rates' AND column_name='currency_code')
0082 |       OR (table_name='rates' AND column_name='currency_minor_units')
0083 |       OR (table_name='rates' AND column_name='price_per_hour_decimal')
0084 |       OR (table_name='rates' AND column_name='dry_price_per_hour_decimal')
0085 |       OR (table_name='aircraft' AND column_name='default_price_currency_code')
0086 |       OR (table_name='aircraft' AND column_name='default_price_currency_minor_units')
0087 |       OR (table_name='aircraft' AND column_name='default_price_per_hour_decimal')
0088 |       OR (table_name='flights' AND column_name='price_currency_code')
0089 |       OR (table_name='flights' AND column_name='price_currency_minor_units')
0090 |       OR (table_name='flights' AND column_name='price_per_hour_decimal')
0091 |       OR (table_name='flight_expenses' AND column_name='amount_encoding')
0092 |       OR (table_name='flight_expenses' AND column_name='amount_minor_units')
0093 |     )
0094 |   ) THEN
0095 |     RAISE EXCEPTION 'v21: partial or existing monetary columns - fail closed';
0096 |   END IF;
0097 |   IF EXISTS(
0098 |     SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
0099 |     JOIN pg_namespace n ON n.oid=t.relnamespace
0100 |     WHERE n.nspname='public' AND c.conname IN ('rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check','flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check')
0101 |   ) THEN
0102 |     RAISE EXCEPTION 'v21: partial or existing CHECK constraints - fail closed';
0103 |   END IF;
0104 | END;
0105 | $v380$;
0106 | SELECT (SELECT COUNT(*) FROM public.rates) rates,(SELECT COUNT(*) FROM public.aircraft) aircraft,
0107 |  (SELECT COUNT(*) FROM public.flights) flights,(SELECT COUNT(*) FROM public.flight_expenses) expenses,
0108 |  (SELECT COUNT(*) FROM public.voided_certified_flights) voided,
0109 |  (SELECT COUNT(*) FROM public.flight_source_provenance) provenance,
0110 |  (SELECT COUNT(*) FROM public.account_backups) backups;
0111 | ROLLBACK;
0112 | 
```

### `tooling/v380-v21-migrate.sql` — lines 1-315

Read-only exact source (line prefix is not SQL/code):

```text
0001 | \set ON_ERROR_STOP on
0002 | \pset pager off
0003 | \if :{?expected_database}
0004 | \else
0005 |   \echo 'Required -v expected_database=... is missing. STOP.'
0006 |   SELECT 1/0; -- ON_ERROR_STOP must terminate with a non-zero exit
0007 | \endif
0008 | 
0009 | -- EXECUTION-GRADE DESIGN - NOT YET AUTHORIZED ON NEON. Run only after explicit
0010 | -- production target, fresh-snapshot and full acceptance owner approval.
0011 | -- New names/definitions source-identical to review draft; no legacy backfill.
0012 | BEGIN;
0013 | SET LOCAL lock_timeout='5s';
0014 | SET LOCAL statement_timeout='60s';
0015 | SET LOCAL search_path=public,pg_catalog;
0016 | SELECT set_config('flytally.expected_database', :'expected_database',true);
0017 | SELECT pg_advisory_xact_lock(704190104);
0018 | DO $v380$
0019 | DECLARE
0020 |   expected_names text[] := ARRAY[
0021 |     'flight audit and locking',
0022 |     'backups and recoverable trash',
0023 |     'core query indexes',
0024 |     'restore and route performance indexes',
0025 |     'EASA FCL.050 flight logbook fields',
0026 |     'FCL.050 structured aircraft, FSTD and certification',
0027 |     'certified flight correction revisions',
0028 |     'certified FSTD correction revisions',
0029 |     'private beta authentication foundation',
0030 |     'private pilot connections',
0031 |     'instructor flight approvals',
0032 |     'shared flight participation',
0033 |     'crew connections and verified approvals',
0034 |     'user-owned structured flight expenses',
0035 |     'Safety Pilot connected PIC collaboration',
0036 |     'general PIC invitation provenance',
0037 |     'historical flight aircraft identity preservation',
0038 |     'aircraft default operation type',
0039 |     'aircraft default engine type',
0040 |     'certified flight void archive and provenance'
0041 |   ];
0042 |   actual_name text;
0043 |   v integer;
0044 | BEGIN
0045 |   IF current_database() IS DISTINCT FROM current_setting('flytally.expected_database',true) THEN
0046 |     RAISE EXCEPTION 'v21: wrong database target';
0047 |   END IF;
0048 |   IF pg_is_in_recovery() THEN
0049 |     RAISE EXCEPTION 'v21: cannot migrate a recovery replica';
0050 |   END IF;
0051 |   IF to_regclass('public.flytally_schema_migrations') IS NULL THEN
0052 |     RAISE EXCEPTION 'v21: migration registry absent';
0053 |   END IF;
0054 |   FOR v IN 1..20 LOOP
0055 |     SELECT name INTO actual_name FROM public.flytally_schema_migrations WHERE version=v;
0056 |     IF actual_name IS DISTINCT FROM expected_names[v] THEN
0057 |       RAISE EXCEPTION 'v21: registry name drift at version %',v;
0058 |     END IF;
0059 |   END LOOP;
0060 |   IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>20
0061 |     OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>20) THEN
0062 |     RAISE EXCEPTION 'v21: registry must be exactly 1 through 20';
0063 |   END IF;
0064 |   IF NOT (to_regclass('public.rates') IS NOT NULL AND
0065 |       to_regclass('public.aircraft') IS NOT NULL AND
0066 |       to_regclass('public.flights') IS NOT NULL AND
0067 |       to_regclass('public.flight_expenses') IS NOT NULL) THEN
0068 |     RAISE EXCEPTION 'v21: required monetary table missing';
0069 |   END IF;
0070 |   IF to_regclass('public.voided_certified_flights') IS NULL
0071 |     OR to_regclass('public.flight_source_provenance') IS NULL
0072 |     OR to_regprocedure('public.logbook_protect_locked_flight()') IS NULL
0073 |     OR to_regprocedure('public.logbook_protect_source_provenance()') IS NULL
0074 |     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0075 |       AND tgname='trg_logbook_protect_locked_flight' AND NOT tgisinternal)
0076 |     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0077 |       AND tgname='trg_logbook_prevent_voided_flight_id_reuse' AND NOT tgisinternal) THEN
0078 |     RAISE EXCEPTION 'v21: required v20 protected history or triggers missing';
0079 |   END IF;
0080 |   IF EXISTS(
0081 |     SELECT 1 FROM information_schema.columns
0082 |     WHERE table_schema='public' AND (
0083 |       (table_name='rates' AND column_name='currency_code')
0084 |       OR (table_name='rates' AND column_name='currency_minor_units')
0085 |       OR (table_name='rates' AND column_name='price_per_hour_decimal')
0086 |       OR (table_name='rates' AND column_name='dry_price_per_hour_decimal')
0087 |       OR (table_name='aircraft' AND column_name='default_price_currency_code')
0088 |       OR (table_name='aircraft' AND column_name='default_price_currency_minor_units')
0089 |       OR (table_name='aircraft' AND column_name='default_price_per_hour_decimal')
0090 |       OR (table_name='flights' AND column_name='price_currency_code')
0091 |       OR (table_name='flights' AND column_name='price_currency_minor_units')
0092 |       OR (table_name='flights' AND column_name='price_per_hour_decimal')
0093 |       OR (table_name='flight_expenses' AND column_name='amount_encoding')
0094 |       OR (table_name='flight_expenses' AND column_name='amount_minor_units')
0095 |     )
0096 |   ) THEN
0097 |     RAISE EXCEPTION 'v21: partial or existing monetary columns - fail closed';
0098 |   END IF;
0099 |   IF EXISTS(
0100 |     SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
0101 |     JOIN pg_namespace n ON n.oid=t.relnamespace
0102 |     WHERE n.nspname='public' AND c.conname IN ('rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check','flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check')
0103 |   ) THEN
0104 |     RAISE EXCEPTION 'v21: partial or existing CHECK constraints - fail closed';
0105 |   END IF;
0106 | END;
0107 | $v380$;
0108 | 
0109 | ALTER TABLE rates
0110 |   ADD COLUMN IF NOT EXISTS currency_code TEXT,
0111 |   ADD COLUMN IF NOT EXISTS currency_minor_units SMALLINT,
0112 |   ADD COLUMN IF NOT EXISTS price_per_hour_decimal NUMERIC,
0113 |   ADD COLUMN IF NOT EXISTS dry_price_per_hour_decimal NUMERIC;
0114 | 
0115 | ALTER TABLE aircraft
0116 |   ADD COLUMN IF NOT EXISTS default_price_currency_code TEXT,
0117 |   ADD COLUMN IF NOT EXISTS default_price_currency_minor_units SMALLINT,
0118 |   ADD COLUMN IF NOT EXISTS default_price_per_hour_decimal NUMERIC;
0119 | 
0120 | ALTER TABLE flights
0121 |   ADD COLUMN IF NOT EXISTS price_currency_code TEXT,
0122 |   ADD COLUMN IF NOT EXISTS price_currency_minor_units SMALLINT,
0123 |   ADD COLUMN IF NOT EXISTS price_per_hour_decimal NUMERIC;
0124 | 
0125 | ALTER TABLE flight_expenses
0126 |   ADD COLUMN IF NOT EXISTS amount_encoding TEXT,
0127 |   ADD COLUMN IF NOT EXISTS amount_minor_units SMALLINT;
0128 | 
0129 | DO $currency$
0130 | BEGIN
0131 |   IF NOT EXISTS (
0132 |     SELECT 1 FROM pg_constraint
0133 |     WHERE conrelid = 'rates'::regclass AND conname = 'rates_exact_currency_tuple_v21_check'
0134 |   ) THEN
0135 |     ALTER TABLE rates ADD CONSTRAINT rates_exact_currency_tuple_v21_check CHECK (
0136 |       (
0137 |         currency_code IS NULL AND currency_minor_units IS NULL
0138 |         AND price_per_hour_decimal IS NULL AND dry_price_per_hour_decimal IS NULL
0139 |       ) OR (
0140 |         currency_code IS NOT NULL AND currency_code ~ '^[A-Z]{3}$'
0141 |         AND currency_minor_units IS NOT NULL AND currency_minor_units BETWEEN 0 AND 9
0142 |         AND price_per_hour_decimal IS NOT NULL AND price_per_hour_decimal > 0
0143 |         AND price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
0144 |         AND (
0145 |           dry_price_per_hour_decimal IS NULL OR (
0146 |             dry_price_per_hour_decimal >= 0
0147 |             AND dry_price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
0148 |           )
0149 |         )
0150 |       )
0151 |     );
0152 |   END IF;
0153 | END;
0154 | $currency$;
0155 | 
0156 | DO $currency$
0157 | BEGIN
0158 |   IF NOT EXISTS (
0159 |     SELECT 1 FROM pg_constraint
0160 |     WHERE conrelid = 'aircraft'::regclass AND conname = 'aircraft_exact_currency_tuple_v21_check'
0161 |   ) THEN
0162 |     ALTER TABLE aircraft ADD CONSTRAINT aircraft_exact_currency_tuple_v21_check CHECK (
0163 |       (
0164 |         default_price_currency_code IS NULL
0165 |         AND default_price_currency_minor_units IS NULL
0166 |         AND default_price_per_hour_decimal IS NULL
0167 |       ) OR (
0168 |         default_price_currency_code IS NOT NULL AND default_price_currency_code ~ '^[A-Z]{3}$'
0169 |         AND default_price_currency_minor_units IS NOT NULL AND default_price_currency_minor_units BETWEEN 0 AND 9
0170 |         AND default_price_per_hour_decimal IS NOT NULL AND default_price_per_hour_decimal >= 0
0171 |         AND default_price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
0172 |       )
0173 |     );
0174 |   END IF;
0175 | END;
0176 | $currency$;
0177 | 
0178 | DO $currency$
0179 | BEGIN
0180 |   IF NOT EXISTS (
0181 |     SELECT 1 FROM pg_constraint
0182 |     WHERE conrelid = 'flights'::regclass AND conname = 'flights_exact_currency_tuple_v21_check'
0183 |   ) THEN
0184 |     ALTER TABLE flights ADD CONSTRAINT flights_exact_currency_tuple_v21_check CHECK (
0185 |       (
0186 |         price_currency_code IS NULL AND price_currency_minor_units IS NULL
0187 |         AND price_per_hour_decimal IS NULL
0188 |       ) OR (
0189 |         price_currency_code IS NOT NULL AND price_currency_code ~ '^[A-Z]{3}$'
0190 |         AND price_currency_minor_units IS NOT NULL AND price_currency_minor_units BETWEEN 0 AND 9
0191 |         AND price_per_hour_decimal IS NOT NULL AND price_per_hour_decimal >= 0
0192 |         AND price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
0193 |       )
0194 |     );
0195 |   END IF;
0196 | END;
0197 | $currency$;
0198 | 
0199 | DO $currency$
0200 | BEGIN
0201 |   IF NOT EXISTS (
0202 |     SELECT 1 FROM pg_constraint
0203 |     WHERE conrelid = 'flight_expenses'::regclass AND conname = 'expenses_amount_encoding_v21_check'
0204 |   ) THEN
0205 |     ALTER TABLE flight_expenses ADD CONSTRAINT expenses_amount_encoding_v21_check CHECK (
0206 |       COALESCE(
0207 |         (amount_encoding IS NULL AND amount_minor_units IS NULL)
0208 |         OR (amount_encoding = 'legacy_two_decimal' AND amount_minor_units = 2)
0209 |         OR (amount_encoding = 'iso_minor_units' AND amount_minor_units IS NOT NULL AND amount_minor_units BETWEEN 0 AND 9),
0210 |         FALSE
0211 |       )
0212 |     );
0213 |   END IF;
0214 | END;
0215 | $currency$;
0216 | 
0217 | INSERT INTO public.flytally_schema_migrations(version,name)
0218 | VALUES(21,'source-backed currency exact-money');
0219 | DO $v380$
0220 | DECLARE
0221 |   expected_names text[] := ARRAY[
0222 |     'flight audit and locking',
0223 |     'backups and recoverable trash',
0224 |     'core query indexes',
0225 |     'restore and route performance indexes',
0226 |     'EASA FCL.050 flight logbook fields',
0227 |     'FCL.050 structured aircraft, FSTD and certification',
0228 |     'certified flight correction revisions',
0229 |     'certified FSTD correction revisions',
0230 |     'private beta authentication foundation',
0231 |     'private pilot connections',
0232 |     'instructor flight approvals',
0233 |     'shared flight participation',
0234 |     'crew connections and verified approvals',
0235 |     'user-owned structured flight expenses',
0236 |     'Safety Pilot connected PIC collaboration',
0237 |     'general PIC invitation provenance',
0238 |     'historical flight aircraft identity preservation',
0239 |     'aircraft default operation type',
0240 |     'aircraft default engine type',
0241 |     'certified flight void archive and provenance'
0242 |   ];
0243 |   actual_name text;
0244 |   v integer;
0245 |   matching_columns integer;
0246 |   matching_checks integer;
0247 | BEGIN
0248 |   IF current_database() IS DISTINCT FROM current_setting('flytally.expected_database',true) THEN
0249 |     RAISE EXCEPTION 'v21 postflight: wrong database target';
0250 |   END IF;
0251 |   IF pg_is_in_recovery() THEN
0252 |     RAISE EXCEPTION 'v21 postflight: recovery replica';
0253 |   END IF;
0254 |   FOR v IN 1..20 LOOP
0255 |     SELECT name INTO actual_name FROM public.flytally_schema_migrations WHERE version=v;
0256 |     IF actual_name IS DISTINCT FROM expected_names[v] THEN
0257 |       RAISE EXCEPTION 'v21 postflight: old migration drift at version %',v;
0258 |     END IF;
0259 |   END LOOP;
0260 |   IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>21
0261 |     OR (SELECT name FROM public.flytally_schema_migrations WHERE version=21)
0262 |       IS DISTINCT FROM 'source-backed currency exact-money' THEN
0263 |     RAISE EXCEPTION 'v21 postflight: registry not exactly 1..21';
0264 |   END IF;
0265 |   SELECT COUNT(*) INTO matching_columns FROM information_schema.columns
0266 |     WHERE table_schema='public' AND is_nullable='YES' AND column_default IS NULL AND (
0267 |       (table_name='rates' AND column_name='currency_code' AND data_type='text')
0268 |         OR (table_name='rates' AND column_name='currency_minor_units' AND data_type='smallint')
0269 |         OR (table_name='rates' AND column_name='price_per_hour_decimal' AND data_type='numeric')
0270 |         OR (table_name='rates' AND column_name='dry_price_per_hour_decimal' AND data_type='numeric')
0271 |         OR (table_name='aircraft' AND column_name='default_price_currency_code' AND data_type='text')
0272 |         OR (table_name='aircraft' AND column_name='default_price_currency_minor_units' AND data_type='smallint')
0273 |         OR (table_name='aircraft' AND column_name='default_price_per_hour_decimal' AND data_type='numeric')
0274 |         OR (table_name='flights' AND column_name='price_currency_code' AND data_type='text')
0275 |         OR (table_name='flights' AND column_name='price_currency_minor_units' AND data_type='smallint')
0276 |         OR (table_name='flights' AND column_name='price_per_hour_decimal' AND data_type='numeric')
0277 |         OR (table_name='flight_expenses' AND column_name='amount_encoding' AND data_type='text')
0278 |         OR (table_name='flight_expenses' AND column_name='amount_minor_units' AND data_type='smallint')
0279 |     );
0280 |   IF matching_columns<>12 THEN
0281 |     RAISE EXCEPTION 'v21 postflight: expected 12 nullable, no-default correctly typed columns, found %',matching_columns;
0282 |   END IF;
0283 |   SELECT COUNT(*) INTO matching_checks FROM pg_constraint c
0284 |     JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
0285 |     WHERE n.nspname='public' AND c.contype='c' AND c.convalidated AND (
0286 |       (t.relname='rates' AND c.conname='rates_exact_currency_tuple_v21_check')
0287 |         OR (t.relname='aircraft' AND c.conname='aircraft_exact_currency_tuple_v21_check')
0288 |         OR (t.relname='flights' AND c.conname='flights_exact_currency_tuple_v21_check')
0289 |         OR (t.relname='flight_expenses' AND c.conname='expenses_amount_encoding_v21_check')
0290 |     );
0291 |   IF matching_checks<>4 THEN
0292 |     RAISE EXCEPTION 'v21 postflight: expected 4 validated CHECKs, found %',matching_checks;
0293 |   END IF;
0294 |   IF EXISTS(SELECT 1 FROM public.rates WHERE currency_code IS NOT NULL OR currency_minor_units IS NOT NULL
0295 |     OR price_per_hour_decimal IS NOT NULL OR dry_price_per_hour_decimal IS NOT NULL)
0296 |   OR EXISTS(SELECT 1 FROM public.aircraft WHERE default_price_currency_code IS NOT NULL
0297 |     OR default_price_currency_minor_units IS NOT NULL OR default_price_per_hour_decimal IS NOT NULL)
0298 |   OR EXISTS(SELECT 1 FROM public.flights WHERE price_currency_code IS NOT NULL
0299 |     OR price_currency_minor_units IS NOT NULL OR price_per_hour_decimal IS NOT NULL)
0300 |   OR EXISTS(SELECT 1 FROM public.flight_expenses WHERE amount_encoding IS NOT NULL
0301 |     OR amount_minor_units IS NOT NULL) THEN
0302 |     RAISE EXCEPTION 'v21 postflight: historical rows unexpectedly populated';
0303 |   END IF;
0304 |   IF to_regclass('public.voided_certified_flights') IS NULL
0305 |     OR to_regclass('public.flight_source_provenance') IS NULL
0306 |     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0307 |       AND tgname='trg_logbook_protect_locked_flight' AND NOT tgisinternal)
0308 |     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0309 |       AND tgname='trg_logbook_prevent_voided_flight_id_reuse' AND NOT tgisinternal) THEN
0310 |     RAISE EXCEPTION 'v21 postflight: v20 protection missing';
0311 |   END IF;
0312 | END;
0313 | $v380$;
0314 | COMMIT;
0315 | 
```

### `tooling/v380-v21-postflight.sql` — lines 1-115

Read-only exact source (line prefix is not SQL/code):

```text
0001 | \set ON_ERROR_STOP on
0002 | \pset pager off
0003 | \if :{?expected_database}
0004 | \else
0005 |   \echo 'Required -v expected_database=... is missing. STOP.'
0006 |   SELECT 1/0; -- ON_ERROR_STOP must terminate with a non-zero exit
0007 | \endif
0008 | 
0009 | -- READ ONLY. Must run immediately after migration and before new v21 writes.
0010 | BEGIN TRANSACTION READ ONLY;
0011 | SET LOCAL search_path=public,pg_catalog;
0012 | SELECT set_config('flytally.expected_database', :'expected_database',true);
0013 | SELECT current_database() AS db,current_user AS db_user,pg_is_in_recovery() AS replica,now() AS observed_at;
0014 | DO $v380$
0015 | DECLARE
0016 |   expected_names text[] := ARRAY[
0017 |     'flight audit and locking',
0018 |     'backups and recoverable trash',
0019 |     'core query indexes',
0020 |     'restore and route performance indexes',
0021 |     'EASA FCL.050 flight logbook fields',
0022 |     'FCL.050 structured aircraft, FSTD and certification',
0023 |     'certified flight correction revisions',
0024 |     'certified FSTD correction revisions',
0025 |     'private beta authentication foundation',
0026 |     'private pilot connections',
0027 |     'instructor flight approvals',
0028 |     'shared flight participation',
0029 |     'crew connections and verified approvals',
0030 |     'user-owned structured flight expenses',
0031 |     'Safety Pilot connected PIC collaboration',
0032 |     'general PIC invitation provenance',
0033 |     'historical flight aircraft identity preservation',
0034 |     'aircraft default operation type',
0035 |     'aircraft default engine type',
0036 |     'certified flight void archive and provenance'
0037 |   ];
0038 |   actual_name text;
0039 |   v integer;
0040 |   matching_columns integer;
0041 |   matching_checks integer;
0042 | BEGIN
0043 |   IF current_database() IS DISTINCT FROM current_setting('flytally.expected_database',true) THEN
0044 |     RAISE EXCEPTION 'v21 postflight: wrong database target';
0045 |   END IF;
0046 |   IF pg_is_in_recovery() THEN
0047 |     RAISE EXCEPTION 'v21 postflight: recovery replica';
0048 |   END IF;
0049 |   FOR v IN 1..20 LOOP
0050 |     SELECT name INTO actual_name FROM public.flytally_schema_migrations WHERE version=v;
0051 |     IF actual_name IS DISTINCT FROM expected_names[v] THEN
0052 |       RAISE EXCEPTION 'v21 postflight: old migration drift at version %',v;
0053 |     END IF;
0054 |   END LOOP;
0055 |   IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>21
0056 |     OR (SELECT name FROM public.flytally_schema_migrations WHERE version=21)
0057 |       IS DISTINCT FROM 'source-backed currency exact-money' THEN
0058 |     RAISE EXCEPTION 'v21 postflight: registry not exactly 1..21';
0059 |   END IF;
0060 |   SELECT COUNT(*) INTO matching_columns FROM information_schema.columns
0061 |     WHERE table_schema='public' AND is_nullable='YES' AND column_default IS NULL AND (
0062 |       (table_name='rates' AND column_name='currency_code' AND data_type='text')
0063 |         OR (table_name='rates' AND column_name='currency_minor_units' AND data_type='smallint')
0064 |         OR (table_name='rates' AND column_name='price_per_hour_decimal' AND data_type='numeric')
0065 |         OR (table_name='rates' AND column_name='dry_price_per_hour_decimal' AND data_type='numeric')
0066 |         OR (table_name='aircraft' AND column_name='default_price_currency_code' AND data_type='text')
0067 |         OR (table_name='aircraft' AND column_name='default_price_currency_minor_units' AND data_type='smallint')
0068 |         OR (table_name='aircraft' AND column_name='default_price_per_hour_decimal' AND data_type='numeric')
0069 |         OR (table_name='flights' AND column_name='price_currency_code' AND data_type='text')
0070 |         OR (table_name='flights' AND column_name='price_currency_minor_units' AND data_type='smallint')
0071 |         OR (table_name='flights' AND column_name='price_per_hour_decimal' AND data_type='numeric')
0072 |         OR (table_name='flight_expenses' AND column_name='amount_encoding' AND data_type='text')
0073 |         OR (table_name='flight_expenses' AND column_name='amount_minor_units' AND data_type='smallint')
0074 |     );
0075 |   IF matching_columns<>12 THEN
0076 |     RAISE EXCEPTION 'v21 postflight: expected 12 nullable, no-default correctly typed columns, found %',matching_columns;
0077 |   END IF;
0078 |   SELECT COUNT(*) INTO matching_checks FROM pg_constraint c
0079 |     JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
0080 |     WHERE n.nspname='public' AND c.contype='c' AND c.convalidated AND (
0081 |       (t.relname='rates' AND c.conname='rates_exact_currency_tuple_v21_check')
0082 |         OR (t.relname='aircraft' AND c.conname='aircraft_exact_currency_tuple_v21_check')
0083 |         OR (t.relname='flights' AND c.conname='flights_exact_currency_tuple_v21_check')
0084 |         OR (t.relname='flight_expenses' AND c.conname='expenses_amount_encoding_v21_check')
0085 |     );
0086 |   IF matching_checks<>4 THEN
0087 |     RAISE EXCEPTION 'v21 postflight: expected 4 validated CHECKs, found %',matching_checks;
0088 |   END IF;
0089 |   IF EXISTS(SELECT 1 FROM public.rates WHERE currency_code IS NOT NULL OR currency_minor_units IS NOT NULL
0090 |     OR price_per_hour_decimal IS NOT NULL OR dry_price_per_hour_decimal IS NOT NULL)
0091 |   OR EXISTS(SELECT 1 FROM public.aircraft WHERE default_price_currency_code IS NOT NULL
0092 |     OR default_price_currency_minor_units IS NOT NULL OR default_price_per_hour_decimal IS NOT NULL)
0093 |   OR EXISTS(SELECT 1 FROM public.flights WHERE price_currency_code IS NOT NULL
0094 |     OR price_currency_minor_units IS NOT NULL OR price_per_hour_decimal IS NOT NULL)
0095 |   OR EXISTS(SELECT 1 FROM public.flight_expenses WHERE amount_encoding IS NOT NULL
0096 |     OR amount_minor_units IS NOT NULL) THEN
0097 |     RAISE EXCEPTION 'v21 postflight: historical rows unexpectedly populated';
0098 |   END IF;
0099 |   IF to_regclass('public.voided_certified_flights') IS NULL
0100 |     OR to_regclass('public.flight_source_provenance') IS NULL
0101 |     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0102 |       AND tgname='trg_logbook_protect_locked_flight' AND NOT tgisinternal)
0103 |     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0104 |       AND tgname='trg_logbook_prevent_voided_flight_id_reuse' AND NOT tgisinternal) THEN
0105 |     RAISE EXCEPTION 'v21 postflight: v20 protection missing';
0106 |   END IF;
0107 | END;
0108 | $v380$;
0109 | SELECT (SELECT COUNT(*) FROM public.rates) rates,(SELECT COUNT(*) FROM public.aircraft) aircraft,
0110 |  (SELECT COUNT(*) FROM public.flights) flights,(SELECT COUNT(*) FROM public.flight_expenses) expenses,
0111 |  (SELECT COUNT(*) FROM public.voided_certified_flights) voided,
0112 |  (SELECT COUNT(*) FROM public.flight_source_provenance) provenance,
0113 |  (SELECT COUNT(*) FROM public.account_backups) backups;
0114 | ROLLBACK;
0115 | 
```

### `lib/migration-plan.ts` — lines 1-30

Read-only exact source (line prefix is not SQL/code):

```text
0001 | export const DATABASE_SCHEMA_VERSION=21;
0002 | 
0003 | export const DATABASE_MIGRATIONS=[
0004 |   {version:1,name:"flight audit and locking"},
0005 |   {version:2,name:"backups and recoverable trash"},
0006 |   {version:3,name:"core query indexes"},
0007 |   {version:4,name:"restore and route performance indexes"},
0008 |   {version:5,name:"EASA FCL.050 flight logbook fields"},
0009 |   {version:6,name:"FCL.050 structured aircraft, FSTD and certification"},
0010 |   {version:7,name:"certified flight correction revisions"},
0011 |   {version:8,name:"certified FSTD correction revisions"},
0012 |   {version:9,name:"private beta authentication foundation"},
0013 |   {version:10,name:"private pilot connections"},
0014 |   {version:11,name:"instructor flight approvals"},
0015 |   {version:12,name:"shared flight participation"},
0016 |   {version:13,name:"crew connections and verified approvals"},
0017 |   {version:14,name:"user-owned structured flight expenses"},
0018 |   {version:15,name:"Safety Pilot connected PIC collaboration"},
0019 |   {version:16,name:"general PIC invitation provenance"},
0020 |   {version:17,name:"historical flight aircraft identity preservation"},
0021 |   {version:18,name:"aircraft default operation type"},
0022 |   {version:19,name:"aircraft default engine type"},
0023 |   {version:20,name:"certified flight void archive and provenance"},
0024 |   {version:21,name:"source-backed currency exact-money"},
0025 | ] as const;
0026 | 
0027 | export function pendingMigrationVersions(applied:Iterable<number>){
0028 |   const completed=new Set(applied);
0029 |   return DATABASE_MIGRATIONS.filter(migration=>!completed.has(migration.version)).map(migration=>migration.version);
0030 | }
```

### `lib/db-optimization.ts` — lines 1-40

Read-only exact source (line prefix is not SQL/code):

```text
0001 | import "server-only";
0002 | import { sql } from "@/lib/db";
0003 | import { DATABASE_SCHEMA_VERSION,pendingMigrationVersions } from "@/lib/migration-plan";
0004 | 
0005 | declare global{
0006 |   // eslint-disable-next-line no-var
0007 |   var __logbookOptimization:Promise<void>|undefined;
0008 | }
0009 | 
0010 | const migrationNames:Record<number,string>={
0011 |   1:"flight audit and locking",
0012 |   2:"backups and recoverable trash",
0013 |   3:"core query indexes",
0014 |   4:"restore and route performance indexes",
0015 |   5:"EASA FCL.050 flight logbook fields",
0016 |   6:"FCL.050 structured aircraft, FSTD and certification",
0017 |   7:"certified flight correction revisions",
0018 |   8:"certified FSTD correction revisions",
0019 |   9:"private beta authentication foundation",
0020 |   10:"private pilot connections",
0021 |   11:"instructor flight approvals",
0022 |   12:"shared flight participation",
0023 |   13:"crew connections and verified approvals",
0024 |   14:"user-owned structured flight expenses",
0025 |   15:"Safety Pilot connected PIC collaboration",
0026 |   16:"general PIC invitation provenance",
0027 |   17:"historical flight aircraft identity preservation",
0028 |   18:"aircraft default operation type",
0029 |   19:"aircraft default engine type",
0030 |   20:"certified flight void archive and provenance",
0031 |   21:"source-backed currency exact-money",
0032 | };
0033 | 
0034 | const migrationQueries=(version:number)=>{
0035 |   if(version===1)return[
0036 |     sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`,
0037 |     sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS locked_by_user_id BIGINT`,
0038 |     sql`CREATE TABLE IF NOT EXISTS flight_audit_log (
0039 |       id BIGSERIAL PRIMARY KEY,flight_id BIGINT NOT NULL,user_id BIGINT NOT NULL,actor_user_id BIGINT,
0040 |       action TEXT NOT NULL CHECK(action IN ('created','updated','deleted')),old_data JSONB,new_data JSONB,
```

### `lib/db-optimization.ts` — lines 835-1079

Read-only exact source (line prefix is not SQL/code):

```text
0835 | 
0836 |         IF OLD.locked_at IS NOT NULL
0837 |           AND (to_jsonb(OLD)-'locked_at'-'locked_by_user_id') IS DISTINCT FROM (to_jsonb(NEW)-'locked_at'-'locked_by_user_id') THEN
0838 |           RAISE EXCEPTION 'Locked flight cannot be changed';
0839 |         END IF;
0840 |         RETURN NEW;
0841 |       END;
0842 |     $void$ LANGUAGE plpgsql`,
0843 |     sql`DROP TRIGGER IF EXISTS trg_logbook_protect_locked_flight ON flights`,
0844 |     sql`CREATE TRIGGER trg_logbook_protect_locked_flight
0845 |       BEFORE UPDATE OR DELETE ON flights
0846 |       FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight()`,
0847 |   ];
0848 |   if(version===21)return[
0849 |     sql`DO $v380$
0850 |     DECLARE
0851 |       expected_names text[] := ARRAY[
0852 |         'flight audit and locking',
0853 |         'backups and recoverable trash',
0854 |         'core query indexes',
0855 |         'restore and route performance indexes',
0856 |         'EASA FCL.050 flight logbook fields',
0857 |         'FCL.050 structured aircraft, FSTD and certification',
0858 |         'certified flight correction revisions',
0859 |         'certified FSTD correction revisions',
0860 |         'private beta authentication foundation',
0861 |         'private pilot connections',
0862 |         'instructor flight approvals',
0863 |         'shared flight participation',
0864 |         'crew connections and verified approvals',
0865 |         'user-owned structured flight expenses',
0866 |         'Safety Pilot connected PIC collaboration',
0867 |         'general PIC invitation provenance',
0868 |         'historical flight aircraft identity preservation',
0869 |         'aircraft default operation type',
0870 |         'aircraft default engine type',
0871 |         'certified flight void archive and provenance'
0872 |       ];
0873 |       actual_name text;
0874 |       v integer;
0875 |     BEGIN
0876 |       IF pg_is_in_recovery() THEN
0877 |         RAISE EXCEPTION 'v21: cannot migrate a recovery replica';
0878 |       END IF;
0879 |       IF to_regclass('public.flytally_schema_migrations') IS NULL THEN
0880 |         RAISE EXCEPTION 'v21: migration registry absent';
0881 |       END IF;
0882 |       FOR v IN 1..20 LOOP
0883 |         SELECT name INTO actual_name FROM public.flytally_schema_migrations WHERE version=v;
0884 |         IF actual_name IS DISTINCT FROM expected_names[v] THEN
0885 |           RAISE EXCEPTION 'v21: registry name drift at version %',v;
0886 |         END IF;
0887 |       END LOOP;
0888 |       IF (SELECT COUNT(*) FROM public.flytally_schema_migrations)<>20
0889 |         OR EXISTS(SELECT 1 FROM public.flytally_schema_migrations WHERE version<1 OR version>20) THEN
0890 |         RAISE EXCEPTION 'v21: registry must be exactly 1 through 20';
0891 |       END IF;
0892 |       IF NOT (to_regclass('public.rates') IS NOT NULL AND
0893 |           to_regclass('public.aircraft') IS NOT NULL AND
0894 |           to_regclass('public.flights') IS NOT NULL AND
0895 |           to_regclass('public.flight_expenses') IS NOT NULL) THEN
0896 |         RAISE EXCEPTION 'v21: required monetary table missing';
0897 |       END IF;
0898 |       IF to_regclass('public.voided_certified_flights') IS NULL
0899 |         OR to_regclass('public.flight_source_provenance') IS NULL
0900 |         OR to_regprocedure('public.logbook_protect_locked_flight()') IS NULL
0901 |         OR to_regprocedure('public.logbook_protect_source_provenance()') IS NULL
0902 |         OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0903 |           AND tgname='trg_logbook_protect_locked_flight' AND NOT tgisinternal)
0904 |         OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.flights'::regclass
0905 |           AND tgname='trg_logbook_prevent_voided_flight_id_reuse' AND NOT tgisinternal) THEN
0906 |         RAISE EXCEPTION 'v21: required v20 protected history or triggers missing';
0907 |       END IF;
0908 |       IF EXISTS(
0909 |         SELECT 1 FROM information_schema.columns
0910 |         WHERE table_schema='public' AND (
0911 |           (table_name='rates' AND column_name='currency_code')
0912 |           OR (table_name='rates' AND column_name='currency_minor_units')
0913 |           OR (table_name='rates' AND column_name='price_per_hour_decimal')
0914 |           OR (table_name='rates' AND column_name='dry_price_per_hour_decimal')
0915 |           OR (table_name='aircraft' AND column_name='default_price_currency_code')
0916 |           OR (table_name='aircraft' AND column_name='default_price_currency_minor_units')
0917 |           OR (table_name='aircraft' AND column_name='default_price_per_hour_decimal')
0918 |           OR (table_name='flights' AND column_name='price_currency_code')
0919 |           OR (table_name='flights' AND column_name='price_currency_minor_units')
0920 |           OR (table_name='flights' AND column_name='price_per_hour_decimal')
0921 |           OR (table_name='flight_expenses' AND column_name='amount_encoding')
0922 |           OR (table_name='flight_expenses' AND column_name='amount_minor_units')
0923 |         )
0924 |       ) THEN
0925 |         RAISE EXCEPTION 'v21: partial or existing monetary columns - fail closed';
0926 |       END IF;
0927 |       IF EXISTS(
0928 |         SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
0929 |         JOIN pg_namespace n ON n.oid=t.relnamespace
0930 |         WHERE n.nspname='public' AND c.conname IN ('rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check','flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check')
0931 |       ) THEN
0932 |         RAISE EXCEPTION 'v21: partial or existing CHECK constraints - fail closed';
0933 |       END IF;
0934 |     END;
0935 |     $v380$`,
0936 |     sql`ALTER TABLE rates
0937 |       ADD COLUMN IF NOT EXISTS currency_code TEXT,
0938 |       ADD COLUMN IF NOT EXISTS currency_minor_units SMALLINT,
0939 |       ADD COLUMN IF NOT EXISTS price_per_hour_decimal NUMERIC,
0940 |       ADD COLUMN IF NOT EXISTS dry_price_per_hour_decimal NUMERIC;`,
0941 |     sql`ALTER TABLE aircraft
0942 |       ADD COLUMN IF NOT EXISTS default_price_currency_code TEXT,
0943 |       ADD COLUMN IF NOT EXISTS default_price_currency_minor_units SMALLINT,
0944 |       ADD COLUMN IF NOT EXISTS default_price_per_hour_decimal NUMERIC;`,
0945 |     sql`ALTER TABLE flights
0946 |       ADD COLUMN IF NOT EXISTS price_currency_code TEXT,
0947 |       ADD COLUMN IF NOT EXISTS price_currency_minor_units SMALLINT,
0948 |       ADD COLUMN IF NOT EXISTS price_per_hour_decimal NUMERIC;`,
0949 |     sql`ALTER TABLE flight_expenses
0950 |       ADD COLUMN IF NOT EXISTS amount_encoding TEXT,
0951 |       ADD COLUMN IF NOT EXISTS amount_minor_units SMALLINT;`,
0952 |     sql`DO $currency$
0953 |     BEGIN
0954 |       IF NOT EXISTS (
0955 |         SELECT 1 FROM pg_constraint
0956 |         WHERE conrelid = 'rates'::regclass AND conname = 'rates_exact_currency_tuple_v21_check'
0957 |       ) THEN
0958 |         ALTER TABLE rates ADD CONSTRAINT rates_exact_currency_tuple_v21_check CHECK (
0959 |           (
0960 |             currency_code IS NULL AND currency_minor_units IS NULL
0961 |             AND price_per_hour_decimal IS NULL AND dry_price_per_hour_decimal IS NULL
0962 |           ) OR (
0963 |             currency_code IS NOT NULL AND currency_code ~ '^[A-Z]{3}$'
0964 |             AND currency_minor_units IS NOT NULL AND currency_minor_units BETWEEN 0 AND 9
0965 |             AND price_per_hour_decimal IS NOT NULL AND price_per_hour_decimal > 0
0966 |             AND price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
0967 |             AND (
0968 |               dry_price_per_hour_decimal IS NULL OR (
0969 |                 dry_price_per_hour_decimal >= 0
0970 |                 AND dry_price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
0971 |               )
0972 |             )
0973 |           )
0974 |         );
0975 |       END IF;
0976 |     END;
0977 |     $currency$;`,
0978 |     sql`DO $currency$
0979 |     BEGIN
0980 |       IF NOT EXISTS (
0981 |         SELECT 1 FROM pg_constraint
0982 |         WHERE conrelid = 'aircraft'::regclass AND conname = 'aircraft_exact_currency_tuple_v21_check'
0983 |       ) THEN
0984 |         ALTER TABLE aircraft ADD CONSTRAINT aircraft_exact_currency_tuple_v21_check CHECK (
0985 |           (
0986 |             default_price_currency_code IS NULL
0987 |             AND default_price_currency_minor_units IS NULL
0988 |             AND default_price_per_hour_decimal IS NULL
0989 |           ) OR (
0990 |             default_price_currency_code IS NOT NULL AND default_price_currency_code ~ '^[A-Z]{3}$'
0991 |             AND default_price_currency_minor_units IS NOT NULL AND default_price_currency_minor_units BETWEEN 0 AND 9
0992 |             AND default_price_per_hour_decimal IS NOT NULL AND default_price_per_hour_decimal >= 0
0993 |             AND default_price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
0994 |           )
0995 |         );
0996 |       END IF;
0997 |     END;
0998 |     $currency$;`,
0999 |     sql`DO $currency$
1000 |     BEGIN
1001 |       IF NOT EXISTS (
1002 |         SELECT 1 FROM pg_constraint
1003 |         WHERE conrelid = 'flights'::regclass AND conname = 'flights_exact_currency_tuple_v21_check'
1004 |       ) THEN
1005 |         ALTER TABLE flights ADD CONSTRAINT flights_exact_currency_tuple_v21_check CHECK (
1006 |           (
1007 |             price_currency_code IS NULL AND price_currency_minor_units IS NULL
1008 |             AND price_per_hour_decimal IS NULL
1009 |           ) OR (
1010 |             price_currency_code IS NOT NULL AND price_currency_code ~ '^[A-Z]{3}$'
1011 |             AND price_currency_minor_units IS NOT NULL AND price_currency_minor_units BETWEEN 0 AND 9
1012 |             AND price_per_hour_decimal IS NOT NULL AND price_per_hour_decimal >= 0
1013 |             AND price_per_hour_decimal::text NOT IN ('NaN','Infinity','-Infinity')
1014 |           )
1015 |         );
1016 |       END IF;
1017 |     END;
1018 |     $currency$;`,
1019 |     sql`DO $currency$
1020 |     BEGIN
1021 |       IF NOT EXISTS (
1022 |         SELECT 1 FROM pg_constraint
1023 |         WHERE conrelid = 'flight_expenses'::regclass AND conname = 'expenses_amount_encoding_v21_check'
1024 |       ) THEN
1025 |         ALTER TABLE flight_expenses ADD CONSTRAINT expenses_amount_encoding_v21_check CHECK (
1026 |           COALESCE(
1027 |             (amount_encoding IS NULL AND amount_minor_units IS NULL)
1028 |             OR (amount_encoding = 'legacy_two_decimal' AND amount_minor_units = 2)
1029 |             OR (amount_encoding = 'iso_minor_units' AND amount_minor_units IS NOT NULL AND amount_minor_units BETWEEN 0 AND 9),
1030 |             FALSE
1031 |           )
1032 |         );
1033 |       END IF;
1034 |     END;
1035 |     $currency$;`,
1036 |   ];
1037 |   throw new Error(`Unknown database migration ${version}`);
1038 | };
1039 | 
1040 | function allowDisposableLocalV21Migration(){
1041 |   if(process.env.FLYTALLY_LOCAL_POSTGRES!=="1"||!process.env.DATABASE_URL)return false;
1042 |   try{
1043 |     const hostname=new URL(process.env.DATABASE_URL).hostname;
1044 |     return ["127.0.0.1","localhost","::1","[::1]"].includes(hostname);
1045 |   }catch{
1046 |     return false;
1047 |   }
1048 | }
1049 | 
1050 | async function migrateDatabase(){
1051 |   await sql`CREATE TABLE IF NOT EXISTS flytally_schema_migrations (
1052 |     version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
1053 |   )`;
1054 |   const rows=await sql`SELECT version FROM flytally_schema_migrations WHERE version<=${DATABASE_SCHEMA_VERSION} ORDER BY version` as Array<{version:number|string}>;
1055 |   for(const version of pendingMigrationVersions(rows.map(row=>Number(row.version)))){
1056 |     // Physical v21 + registry must already be applied by the separately approved
1057 |     // schema-first SQL. Only verified disposable loopback fixtures can auto-build it.
1058 |     if(version===21&&!allowDisposableLocalV21Migration()){
1059 |       throw new Error("Currency schema v21 requires approved explicit migration before runtime.");
1060 |     }
1061 |     await sql.transaction([
1062 |       sql`SELECT pg_advisory_xact_lock(704190104)`,
1063 |       ...migrationQueries(version),
1064 |       sql`INSERT INTO flytally_schema_migrations(version,name) VALUES(${version},${migrationNames[version]}) ON CONFLICT(version) DO NOTHING`,
1065 |     ]);
1066 |   }
1067 | }
1068 | 
1069 | export function ensureDatabaseOptimizations():Promise<void>{
1070 |   if(!globalThis.__logbookOptimization){
1071 |     globalThis.__logbookOptimization=migrateDatabase().catch(error=>{
1072 |       globalThis.__logbookOptimization=undefined;
1073 |       console.error("database-migration-failed",error);
1074 |       throw error;
1075 |     });
1076 |   }
1077 |   return globalThis.__logbookOptimization;
1078 | }
1079 | 
```

### `tests/currency-v21-release-contract.test.ts` — lines 1-85

Read-only exact source (line prefix is not SQL/code):

```text
0001 | import assert from "node:assert/strict";
0002 | import test from "node:test";
0003 | import {readFileSync} from "node:fs";
0004 | 
0005 | const source=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
0006 | const draft=source("sql/drafts/3_8_0_currency_v21_additive_candidate.sql");
0007 | const pre=source("tooling/v380-v21-preflight.sql");
0008 | const migrate=source("tooling/v380-v21-migrate.sql");
0009 | const post=source("tooling/v380-v21-postflight.sql");
0010 | const plan=source("lib/migration-plan.ts");
0011 | const runtime=source("lib/db-optimization.ts");
0012 | const normalize=(v:string)=>v.replace(/\s+/g," ").trim();
0013 | // Git for Windows may check out the SQL draft with CRLF rather than LF.
0014 | const alters=[...draft.matchAll(/^ALTER TABLE (?:rates|aircraft|flights|flight_expenses)\r?\n[\s\S]*?;/gm)].map(x=>x[0]);
0015 | const checks=[...draft.matchAll(/DO \$currency\$[\s\S]*?\$currency\$;/g)].map(x=>x[0]);
0016 | 
0017 | test("v21 executable DDL and runtime use all eight exact source-backed draft blocks",()=>{
0018 |   assert.equal(alters.length,4);
0019 |   assert.equal(checks.length,4);
0020 |   for(const ddl of [...alters,...checks]){
0021 |     assert.ok(normalize(migrate).includes(normalize(ddl)),"Production file differs from v21 review DDL");
0022 |     assert.ok(normalize(runtime).includes(normalize(ddl)),"Runtime v21 differs from review DDL");
0023 |   }
0024 |   assert.match(draft,/REVIEW CANDIDATE ONLY/);
0025 |   assert.doesNotMatch(draft,/INSERT INTO public\.flytally_schema_migrations/);
0026 | });
0027 | 
0028 | test("v21 registration is consistent and not claimed as already applied",()=>{
0029 |   assert.match(plan,/DATABASE_SCHEMA_VERSION=21;/);
0030 |   assert.match(plan,/\{version:21,name:"source-backed currency exact-money"\}/);
0031 |   assert.match(runtime,/21:"source-backed currency exact-money"/);
0032 |   assert.match(runtime,/if\(version===21\)return\[/);
0033 |   assert.match(migrate,/VALUES\(21,'source-backed currency exact-money'\)/);
0034 |   assert.doesNotMatch(draft,/\bversion:21\b/);
0035 |   assert.equal((runtime.match(/if\(version===21\)return\[/g)||[]).length,1);
0036 | });
0037 | 
0038 | test("SQL files require explicit database identity, with isolated read-only pre/post and bounded atomic migration",()=>{
0039 |   for(const s of [pre,migrate,post]){
0040 |     assert.match(s,/\\if :\{\?expected_database\}/);
0041 |     assert.match(s,/set_config\('flytally\.expected_database', :'expected_database',true\)/);
0042 |     assert.match(s,/current_database\(\) IS DISTINCT FROM current_setting\('flytally\.expected_database',true\)/);
0043 |     assert.match(s,/SET LOCAL search_path=public,pg_catalog/);
0044 |     assert.equal([...Buffer.from(s,"utf8")].every(x=>x<128),true,"Release scripts must be PowerShell5.1 ASCII-safe");
0045 |   }
0046 |   for(const s of [pre,post]){
0047 |     assert.match(s,/BEGIN TRANSACTION READ ONLY/);
0048 |     assert.match(s,/ROLLBACK;/);
0049 |     assert.doesNotMatch(s,/\bINSERT INTO\b/);
0050 |   }
0051 |   assert.match(migrate,/SET LOCAL lock_timeout='5s'/);
0052 |   assert.match(migrate,/SET LOCAL statement_timeout='60s'/);
0053 |   assert.match(migrate,/SELECT pg_advisory_xact_lock\(704190104\)/);
0054 |   assert.ok(migrate.indexOf("VALUES(21,")>migrate.indexOf("ALTER TABLE rates"));
0055 |   assert.ok(migrate.indexOf("DO $v380$",migrate.indexOf("VALUES(21,"))>migrate.indexOf("VALUES(21,"));
0056 |   assert.match(migrate,/COMMIT;\s*$/);
0057 |   assert.doesNotMatch(migrate,/\b(?:UPDATE|DELETE FROM|DROP TABLE|DROP COLUMN)\b/i);
0058 | });
0059 | 
0060 | test("release preflight and runtime refuse any partial v21 state and require certified-history protection",()=>{
0061 |   for(const s of [pre,migrate,runtime]){
0062 |     assert.match(s,/partial or existing monetary columns - fail closed/);
0063 |     assert.match(s,/partial or existing CHECK constraints - fail closed/);
0064 |     assert.match(s,/required v20 protected history or triggers missing/);
0065 |     assert.match(s,/registry must be exactly 1 through 20/);
0066 |     assert.match(s,/logbook_protect_locked_flight/);
0067 |     assert.match(s,/logbook_protect_source_provenance/);
0068 |   }
0069 |   for(const s of [post,migrate]){
0070 |     assert.match(s,/expected 12 nullable, no-default correctly typed columns/);
0071 |     assert.match(s,/expected 4 validated CHECKs/);
0072 |     assert.match(s,/historical rows unexpectedly populated/);
0073 |     assert.match(s,/registry not exactly 1\.\.21/);
0074 |   }
0075 | });
0076 | 
0077 | test("production runtime never performs an unsanctioned v21 automatic migration",()=>{
0078 |   assert.match(runtime,/if\(version===21&&!allowDisposableLocalV21Migration\(\)\)/);
0079 |   assert.match(runtime,/Currency schema v21 requires approved explicit migration before runtime/);
0080 |   assert.match(runtime,/FLYTALLY_LOCAL_POSTGRES!=="1"/);
0081 |   assert.match(runtime,/new URL\(process\.env\.DATABASE_URL\)\.hostname/);
0082 |   assert.match(runtime,/\["127\.0\.0\.1","localhost","::1","\[::1\]"\]/);
0083 |   assert.doesNotMatch(runtime,/FLYTALLY_V21_RELEASE_DISPOSABLE.*process\.env/);
0084 | });
0085 | 
```

### `tests/integration/postgres-currency-v21-release.test.ts` — lines 1-124

Read-only exact source (line prefix is not SQL/code):

```text
0001 | import assert from "node:assert/strict";
0002 | import test,{before} from "node:test";
0003 | import {readFileSync} from "node:fs";
0004 | import {spawnSync} from "node:child_process";
0005 | import {resolve} from "node:path";
0006 | 
0007 | // Run ONLY after tooling/run-currency-m2a0-local.ps1 has verified its own fresh
0008 | // loopback PostgreSQL16 instance AND set both purpose-bound environment flags.
0009 | // This test owns PUBLIC in that disposable database; never run on Neon/other DBs.
0010 | const enabled=process.env.FLYTALLY_V21_RELEASE_DISPOSABLE==="1"&&process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
0011 | const url=process.env.DATABASE_URL||"";
0012 | const root=resolve(import.meta.dirname,"../..");
0013 | const source=(p:string)=>readFileSync(resolve(root,p),"utf8");
0014 | const plan=source("lib/migration-plan.ts");
0015 | const pre=source("tooling/v380-v21-preflight.sql");
0016 | const migrate=source("tooling/v380-v21-migrate.sql");
0017 | const post=source("tooling/v380-v21-postflight.sql");
0018 | const expectedDb="flytally_currency_test";
0019 | 
0020 | function exec(script:string){
0021 |   return spawnSync("psql",["-w","-X","-qAt","-v","ON_ERROR_STOP=1",
0022 |     "-v","expected_database="+expectedDb,"-d",url],{
0023 |     input:script,encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"},maxBuffer:4*1024*1024,
0024 |   });
0025 | }
0026 | function run(script:string){
0027 |   const r=exec(script);
0028 |   if(r.error)throw r.error;
0029 |   if(r.status!==0)throw new Error(String(r.stderr||r.stdout));
0030 |   return String(r.stdout||"").trim();
0031 | }
0032 | function reject(script:string,pattern:RegExp){
0033 |   const r=exec(script);
0034 |   if(r.error)throw r.error;
0035 |   assert.notEqual(r.status,0,"Invalid migration unexpectedly succeeded");
0036 |   assert.match(String(r.stderr||r.stdout),pattern);
0037 | }
0038 | 
0039 | before(()=>{
0040 |   if(!enabled)return;
0041 |   const parsed=new URL(url);
0042 |   assert.ok(["127.0.0.1","localhost","::1","[::1]"].includes(parsed.hostname),
0043 |     "v21 release integration must only target a disposable loopback host");
0044 |   assert.equal(decodeURIComponent(parsed.pathname),"/"+expectedDb,"Unexpected test database");
0045 |   assert.equal(parsed.username,"flytally","Unexpected test database role");
0046 |   const probe=run("SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())");
0047 |   assert.equal(probe,expectedDb+"|flytally|127.0.0.1","Disposable DB identity mismatch");
0048 |   assert.equal(run("SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public'"),"0",
0049 |     "Public schema not empty: refusing any modification");
0050 |   const entries=[...plan.matchAll(/\{version:(\d+),name:"([^"]+)"\}/g)]
0051 |     .map(x=>({v:Number(x[1]),n:x[2]})).filter(x=>x.v<=20);
0052 |   assert.equal(entries.length,20);
0053 |   const names=entries.map(e=>"("+e.v+",'"+e.n.replaceAll("'","''")+"')").join(",");
0054 |   run(`
0055 |     CREATE TABLE flytally_schema_migrations(version integer PRIMARY KEY,name text NOT NULL,applied_at timestamptz DEFAULT now());
0056 |     INSERT INTO flytally_schema_migrations(version,name) VALUES ${names};
0057 |     CREATE TABLE rates(id integer PRIMARY KEY,price_per_hour double precision,dry_price_per_hour double precision);
0058 |     CREATE TABLE aircraft(id integer PRIMARY KEY,default_price_per_hour double precision);
0059 |     CREATE TABLE flights(id integer PRIMARY KEY,price_per_hour double precision,certified_at timestamptz,certification_hash text);
0060 |     CREATE TABLE flight_expenses(id integer PRIMARY KEY,amount_minor bigint,currency text);
0061 |     CREATE TABLE voided_certified_flights(id integer PRIMARY KEY,flight_snapshot jsonb);
0062 |     CREATE TABLE flight_source_provenance(id integer PRIMARY KEY,source_hash text);
0063 |     CREATE TABLE account_backups(id integer PRIMARY KEY,payload_sha256 text);
0064 |     CREATE FUNCTION logbook_protect_locked_flight() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql;
0065 |     CREATE FUNCTION logbook_protect_source_provenance() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql;
0066 |     CREATE FUNCTION logbook_prevent_voided_flight_id_reuse() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql;
0067 |     CREATE TRIGGER trg_logbook_protect_locked_flight BEFORE UPDATE ON flights
0068 |       FOR EACH ROW EXECUTE FUNCTION logbook_protect_locked_flight();
0069 |     CREATE TRIGGER trg_logbook_prevent_voided_flight_id_reuse BEFORE INSERT ON flights
0070 |       FOR EACH ROW EXECUTE FUNCTION logbook_prevent_voided_flight_id_reuse();
0071 |     INSERT INTO rates VALUES(1,3060.25,2500.75);
0072 |     INSERT INTO aircraft VALUES(1,3400.5);
0073 |     INSERT INTO flights VALUES(1,1200.25,now(),repeat('a',64));
0074 |     INSERT INTO flight_expenses VALUES(1,1255,'EUR');
0075 |     INSERT INTO voided_certified_flights VALUES(1,'{"original_flight_id":99,"certification_hash":"signed"}'::jsonb);
0076 |     INSERT INTO flight_source_provenance VALUES(1,repeat('b',64));
0077 |     INSERT INTO account_backups VALUES(1,repeat('c',64));
0078 |   `);
0079 | });
0080 | 
0081 | test("v21 preflight rejects incomplete schema and aborts migration without a registry write",{skip:!enabled},()=>{
0082 |   run(pre);
0083 |   run("ALTER TABLE rates ADD COLUMN currency_code TEXT");
0084 |   reject(pre,/partial or existing monetary columns - fail closed/);
0085 |   reject(migrate,/partial or existing monetary columns - fail closed/);
0086 |   assert.equal(run("SELECT count(*) FROM flytally_schema_migrations"),"20");
0087 |   run("ALTER TABLE rates DROP COLUMN currency_code");
0088 |   run(pre);
0089 | });
0090 | 
0091 | test("v21 production artifact applies atomically and preserves legacy and certified evidence",{skip:!enabled},()=>{
0092 |   const beforeSnapshot=run(`SELECT
0093 |      (SELECT row_to_json(r)::text FROM (SELECT price_per_hour,dry_price_per_hour FROM rates WHERE id=1) r)||'|'||
0094 |      (SELECT row_to_json(a)::text FROM (SELECT default_price_per_hour FROM aircraft WHERE id=1) a)||'|'||
0095 |      (SELECT row_to_json(f)::text FROM (SELECT price_per_hour,certified_at,certification_hash FROM flights WHERE id=1) f)||'|'||
0096 |      (SELECT row_to_json(e)::text FROM (SELECT amount_minor,currency FROM flight_expenses WHERE id=1) e)||'|'||
0097 |      (SELECT flight_snapshot::text FROM voided_certified_flights WHERE id=1)||'|'||
0098 |      (SELECT source_hash FROM flight_source_provenance WHERE id=1)||'|'||
0099 |      (SELECT payload_sha256 FROM account_backups WHERE id=1)`);
0100 |   run(migrate);
0101 |   run(post);
0102 |   const afterSnapshot=run(`SELECT
0103 |      (SELECT row_to_json(r)::text FROM (SELECT price_per_hour,dry_price_per_hour FROM rates WHERE id=1) r)||'|'||
0104 |      (SELECT row_to_json(a)::text FROM (SELECT default_price_per_hour FROM aircraft WHERE id=1) a)||'|'||
0105 |      (SELECT row_to_json(f)::text FROM (SELECT price_per_hour,certified_at,certification_hash FROM flights WHERE id=1) f)||'|'||
0106 |      (SELECT row_to_json(e)::text FROM (SELECT amount_minor,currency FROM flight_expenses WHERE id=1) e)||'|'||
0107 |      (SELECT flight_snapshot::text FROM voided_certified_flights WHERE id=1)||'|'||
0108 |      (SELECT source_hash FROM flight_source_provenance WHERE id=1)||'|'||
0109 |      (SELECT payload_sha256 FROM account_backups WHERE id=1)`);
0110 |   assert.equal(afterSnapshot,beforeSnapshot);
0111 |   assert.equal(run("SELECT count(*) FROM flytally_schema_migrations WHERE version=21 AND name='source-backed currency exact-money'"),"1");
0112 |   assert.equal(run("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('currency_code','currency_minor_units','price_per_hour_decimal','dry_price_per_hour_decimal','default_price_currency_code','default_price_currency_minor_units','default_price_per_hour_decimal','price_currency_code','price_currency_minor_units','amount_encoding','amount_minor_units')"),"12");
0113 |   reject(migrate,/registry must be exactly 1 through 20/);
0114 | });
0115 | 
0116 | test("v21 executable CHECKs reject malformed exact monetary tuples",{skip:!enabled},()=>{
0117 |   run("UPDATE rates SET currency_code='KWD',currency_minor_units=3,price_per_hour_decimal=3060.125 WHERE id=1");
0118 |   assert.equal(run("SELECT price_per_hour_decimal::text FROM rates WHERE id=1"),"3060.125");
0119 |   reject("UPDATE rates SET currency_minor_units=NULL WHERE id=1",/rates_exact_currency_tuple_v21_check/);
0120 |   reject("UPDATE rates SET price_per_hour_decimal='Infinity'::numeric WHERE id=1",/rates_exact_currency_tuple_v21_check/);
0121 |   run("UPDATE flight_expenses SET amount_encoding='iso_minor_units',amount_minor_units=3 WHERE id=1");
0122 |   reject("UPDATE flight_expenses SET amount_minor_units=NULL WHERE id=1",/expenses_amount_encoding_v21_check/);
0123 | });
0124 | 
```

### `lib/db.ts` — lines 1-47

Read-only exact source (line prefix is not SQL/code):

```text
0001 | import "server-only";
0002 | import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
0003 | import { createLocalPostgresQuery } from "@/lib/local-postgres";
0004 | 
0005 | declare global {
0006 |   // eslint-disable-next-line no-var
0007 |   var __logbookSql: NeonQueryFunction<false, false> | undefined;
0008 | }
0009 | 
0010 | let productionSql: NeonQueryFunction<false, false> | undefined;
0011 | 
0012 | function databaseUrl(): string {
0013 |   const value = process.env.DATABASE_URL?.trim();
0014 |   if (!value) throw new Error("DATABASE_URL is not configured.");
0015 |   return value;
0016 | }
0017 | 
0018 | function getSql(): NeonQueryFunction<false, false> {
0019 |   const cached = process.env.NODE_ENV === "production" ? productionSql : globalThis.__logbookSql;
0020 |   if (cached) return cached;
0021 | 
0022 |   const client = process.env.FLYTALLY_LOCAL_POSTGRES === "1"
0023 |     ? createLocalPostgresQuery() as unknown as NeonQueryFunction<false,false>
0024 |     : neon(databaseUrl(), { fullResults:false,arrayMode:false });
0025 | 
0026 |   if (process.env.NODE_ENV === "production") productionSql = client;
0027 |   else globalThis.__logbookSql = client;
0028 | 
0029 |   return client;
0030 | }
0031 | 
0032 | // Keep importing database-backed routes safe during Next.js build-time module
0033 | // evaluation. The connection string is required only when a query is actually
0034 | // executed, while still exposing the complete Neon query-function surface.
0035 | const deferredSqlTarget = (() => undefined) as unknown as NeonQueryFunction<false, false>;
0036 | 
0037 | export const sql = new Proxy(deferredSqlTarget, {
0038 |   apply(_target, thisArg, argArray) {
0039 |     return Reflect.apply(getSql(), thisArg, argArray);
0040 |   },
0041 |   get(_target, property) {
0042 |     const client = getSql();
0043 |     const value = Reflect.get(client, property, client);
0044 |     return typeof value === "function" ? value.bind(client) : value;
0045 |   },
0046 | }) as NeonQueryFunction<false, false>;
0047 | 
```

### `tooling/run-auth-browser.mjs` — lines 1-91

Read-only exact source (line prefix is not SQL/code):

```text
0001 | import { spawnSync } from "node:child_process";
0002 | import { fileURLToPath } from "node:url";
0003 | import { createRequire } from "node:module";
0004 | import { dirname, join } from "node:path";
0005 | import { probePostgresConnection } from "./postgres-cli.mjs";
0006 | 
0007 | if(process.env.FLYTALLY_AUTH_BROWSER!=="1"||process.env.FLYTALLY_LOCAL_POSTGRES!=="1"){
0008 |   console.error("FLYTALLY_AUTH_BROWSER=1 and FLYTALLY_LOCAL_POSTGRES=1 are required for authenticated browser acceptance. The browser gate did not run.");
0009 |   process.exit(2);
0010 | }
0011 | 
0012 | const databaseUrl=String(process.env.DATABASE_URL??"").trim();
0013 | if(!databaseUrl){
0014 |   console.error("DATABASE_URL is required for authenticated browser acceptance. The browser gate did not run.");
0015 |   process.exit(2);
0016 | }
0017 | 
0018 | let parsedDatabaseUrl;
0019 | try{
0020 |   parsedDatabaseUrl=new URL(databaseUrl);
0021 | }catch{
0022 |   console.error("Authenticated browser acceptance requires a valid DATABASE_URL. The browser gate did not run.");
0023 |   process.exit(2);
0024 | }
0025 | if(!new Set(["127.0.0.1","localhost","::1","[::1]"]).has(parsedDatabaseUrl.hostname)){
0026 |   console.error(`Authenticated browser acceptance may only reset a localhost PostgreSQL fixture; got host ${parsedDatabaseUrl.hostname}. The browser gate did not run.`);
0027 |   process.exit(2);
0028 | }
0029 | 
0030 | let browserEnv;
0031 | try{
0032 |   browserEnv=probePostgresConnection(databaseUrl,{
0033 |     env:process.env,
0034 |     label:"Authenticated browser acceptance",
0035 |     failureSuffix:"The browser gate did not run.",
0036 |   });
0037 | }catch(error){
0038 |   console.error(error instanceof Error?error.message:String(error));
0039 |   process.exit(2);
0040 | }
0041 | 
0042 | const bootstrap=fileURLToPath(new URL("./bootstrap-browser-smoke-db.mjs",import.meta.url));
0043 | const bootstrapResult=spawnSync(process.execPath,[bootstrap],{stdio:"inherit",env:browserEnv});
0044 | if(bootstrapResult.error)throw bootstrapResult.error;
0045 | if(bootstrapResult.status!==0)process.exit(bootstrapResult.status??1);
0046 | 
0047 | // Only explicitly opted-in Currency browser acceptance may use the verified
0048 | // disposable localhost fixture for runtime v20/v21 schema initialization.
0049 | if(process.env.FLYTALLY_CURRENCY_V21_BROWSER==="1"){
0050 |   if(parsedDatabaseUrl.hostname!=="127.0.0.1" ||
0051 |      parsedDatabaseUrl.pathname!=="/flytally_currency_test" ||
0052 |      process.env.FLYTALLY_AUTH_BROWSER!=="1" ||
0053 |      process.env.FLYTALLY_LOCAL_POSTGRES!=="1"){
0054 |     throw new Error("Currency v21 browser SQL requires the named disposable localhost fixture.");
0055 |   }
0056 |   // Do not pre-apply review-only DDL without its registry row. The running app
0057 |   // will apply v20 then v21 atomically using its localhost-only guarded path.
0058 |   console.log("Disposable Currency browser fixture is ready for guarded runtime v20/v21 migration.");
0059 | }
0060 | 
0061 | const require=createRequire(import.meta.url);
0062 | const playwrightPackage=require.resolve("@playwright/test/package.json");
0063 | const playwrightCli=join(dirname(playwrightPackage),"cli.js");
0064 | const browserResult=spawnSync(process.execPath,[playwrightCli,"test","--config=playwright.config.mjs",...process.argv.slice(2)],{stdio:"inherit",env:browserEnv});
0065 | if(browserResult.error)throw browserResult.error;
0066 | if(browserResult.status===0&&process.env.FLYTALLY_CURRENCY_V21_BROWSER==="1"){
0067 |   // Browser actions exercised the application against a disposable localhost DB.
0068 |   // Independently verify that the runtime finished the complete v21 migration.
0069 |   const evidenceQuery=`SELECT (SELECT COUNT(*) FROM public.flytally_schema_migrations
0070 |     WHERE version=21 AND name='source-backed currency exact-money'),
0071 |     (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND (
0072 |       (table_name='rates' AND column_name IN ('currency_code','currency_minor_units','price_per_hour_decimal','dry_price_per_hour_decimal'))
0073 |       OR (table_name='aircraft' AND column_name IN ('default_price_currency_code','default_price_currency_minor_units','default_price_per_hour_decimal'))
0074 |       OR (table_name='flights' AND column_name IN ('price_currency_code','price_currency_minor_units','price_per_hour_decimal'))
0075 |       OR (table_name='flight_expenses' AND column_name IN ('amount_encoding','amount_minor_units'))
0076 |     )),
0077 |     (SELECT COUNT(*) FROM pg_constraint WHERE conname IN (
0078 |       'rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check',
0079 |       'flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check'
0080 |     ))`;
0081 |   const observed=spawnSync("psql",["-d",databaseUrl,"-X","-w","-v","ON_ERROR_STOP=1","-At","-F","|","-c",evidenceQuery],{
0082 |     encoding:"utf8",env:browserEnv,
0083 |   });
0084 |   if(observed.error)throw observed.error;
0085 |   if(observed.status!==0||String(observed.stdout).trim()!=="1|12|4"){
0086 |     throw new Error("Currency browser runtime v21 registry/column/constraint postcheck failed.");
0087 |   }
0088 |   console.log("Verified disposable currency browser runtime v21: 1 registry, 12 columns, 4 CHECKs.");
0089 | }
0090 | process.exit(browserResult.status??1);
0091 | 
```

### `tooling/run-currency-380-browser-local.ps1` — lines 1-175

Read-only exact source (line prefix is not SQL/code):

```text
0001 | # Currency 3.8.0 authenticated browser Trash v20/v21 acceptance on disposable localhost PostgreSQL16.
0002 | # DESTRUCTIVE FIXTURE: run-auth-browser bootstrap DROPS public schema.
0003 | # Never point this runner at any existing local service/database or production/Neon.
0004 | # This runner exclusively creates, verifies, and destroys its OWN localhost cluster.
0005 | # Windows PowerShell 5.1; Git/Node 24/PG16 and repository Playwright browsers.
0006 | # Run: powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-380-browser-local.ps1
0007 | $ErrorActionPreference = "Stop"
0008 | Set-StrictMode -Version Latest
0009 | 
0010 | $repoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
0011 | $expectedBranch = "feat/3.8.0-m2a0-schema-review-main"
0012 | $oldPath = $env:Path
0013 | $oldDatabaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
0014 | $oldPgIntegration = [Environment]::GetEnvironmentVariable("FLYTALLY_POSTGRES_INTEGRATION", "Process")
0015 | $oldD3bTargetedPg16 = [Environment]::GetEnvironmentVariable("FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE", "Process")
0016 | $oldD3bMigrationsPg16 = [Environment]::GetEnvironmentVariable("FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE", "Process")
0017 | $oldPgPassword = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")
0018 | $oldAuthBrowser = [Environment]::GetEnvironmentVariable("FLYTALLY_AUTH_BROWSER", "Process")
0019 | $oldCurrencyBrowser = [Environment]::GetEnvironmentVariable("FLYTALLY_CURRENCY_V21_BROWSER", "Process")
0020 | $oldLocalPostgres = [Environment]::GetEnvironmentVariable("FLYTALLY_LOCAL_POSTGRES", "Process")
0021 | $oldSessionSecret = [Environment]::GetEnvironmentVariable("SESSION_SECRET", "Process")
0022 | $oldSigningSecret = [Environment]::GetEnvironmentVariable("SIGNING_SECRET", "Process")
0023 | $temporaryRoot = $null
0024 | $dataDir = $null
0025 | $started = $false
0026 | $startupAttempted = $false
0027 | $mayDeleteTemporaryRoot = $false
0028 | 
0029 | function Assert-Exit([string]$step) {
0030 |   if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)." }
0031 | }
0032 | function Restore-Env([string]$name, [string]$value) {
0033 |   [Environment]::SetEnvironmentVariable($name, $value, "Process")
0034 | }
0035 | 
0036 | Write-Host "FlyTally 3.8.0 Currency v20/v21 authenticated browser - disposable localhost PG16" -ForegroundColor Cyan
0037 | Push-Location $repoPath
0038 | try {
0039 |   if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is not on PATH." }
0040 |   if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node 24 is not on PATH." }
0041 |   if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is not on PATH." }
0042 |   $currentBranch = (& git branch --show-current).Trim()
0043 |   Assert-Exit "Git branch read"
0044 |   if ($currentBranch -ne $expectedBranch) { throw "Wrong branch: $currentBranch. Expected $expectedBranch." }
0045 |   # Exact candidate: tracked content MUST be clean. Do not delete, stash or
0046 |   # reclassify the owner's unrelated untracked files.
0047 |   $dirtyTracked = & git status --porcelain --untracked-files=no
0048 |   Assert-Exit "Git tracked-file status"
0049 |   if ($dirtyTracked) {
0050 |     throw "Tracked files have uncommitted changes. Stop before creating a test cluster."
0051 |   }
0052 |   $untrackedFiles = @(& git ls-files --others --exclude-standard)
0053 |   Assert-Exit "Git untracked-file inventory"
0054 |   # tsconfig includes **/*.ts and **/*.tsx; an untracked TypeScript file
0055 |   # could affect typecheck and invalidate exact-commit verification evidence.
0056 |   $untrackedTypescript = @($untrackedFiles | Where-Object { $_ -match '(?i)\.(?:ts|tsx)$' })
0057 |   if ($untrackedTypescript.Count -gt 0) {
0058 |     throw "Untracked TypeScript files may affect the exact-candidate typecheck. Use a separate clean worktree for testing."
0059 |   }
0060 |   if ($untrackedFiles.Count -gt 0) {
0061 |     Write-Host "Ignoring $($untrackedFiles.Count) unrelated untracked file(s); none will be deleted or modified."
0062 |   }
0063 |   $commit = (& git rev-parse HEAD).Trim()
0064 |   Assert-Exit "Git commit identity"
0065 |   if (-not ((& node --version) -match '^v24\.')) { throw "Node 24.x required." }
0066 |   Write-Host "Candidate: $commit"
0067 | 
0068 |   # Build for exactly this candidate before starting destructive browser fixture.
0069 |   # Refuse a pre-existing web server: Playwright must start our own Next process.
0070 |   $webProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 3000)
0071 |   try { $webProbe.Start() } catch { throw "Local port 3000 is already occupied. Browser test NOT RUN; stop the other server first." } finally { $webProbe.Stop() }
0072 |   if ($env:CI) { throw "CI env must be unset for this local browser gate: retries must stay zero." }
0073 |   # Auth and backups must be signed with isolated per-run test-only secrets.
0074 |   # Process environment overrides .env.local; restore it in finally.
0075 |   $env:SESSION_SECRET = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
0076 |   $env:SIGNING_SECRET = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
0077 |   npm.cmd run build
0078 |   Assert-Exit "Exact candidate Next.js build"
0079 | 
0080 |   $pgBin = Join-Path $env:ProgramFiles "PostgreSQL\16\bin"
0081 |   foreach ($program in @("initdb.exe","pg_ctl.exe","createdb.exe","psql.exe")) {
0082 |     if (-not (Test-Path (Join-Path $pgBin $program))) {
0083 |       throw "PostgreSQL 16 tools not found in $pgBin. Cluster was not started."
0084 |     }
0085 |   }
0086 |   $env:Path = "$pgBin;$env:Path"
0087 |   $initdb = Join-Path $pgBin "initdb.exe"
0088 |   $pgctl = Join-Path $pgBin "pg_ctl.exe"
0089 |   $createdb = Join-Path $pgBin "createdb.exe"
0090 |   $psql = Join-Path $pgBin "psql.exe"
0091 | 
0092 |   # Acquire a free localhost port without touching the existing 55432 server.
0093 |   $portSocket = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
0094 |   $portSocket.Start()
0095 |   try { $port = $portSocket.LocalEndpoint.Port } finally { $portSocket.Stop() }
0096 |   if ($port -in @(5432,55432)) { throw "Refusing existing or standard PostgreSQL port." }
0097 | 
0098 |   # Exclusive user-temp location, used only by this script. Never reuse cluster data.
0099 |   $temporaryRoot = Join-Path $env:TEMP ("flytally-380-browser-" + [guid]::NewGuid().ToString("N"))
0100 |   [void](New-Item -ItemType Directory -Path $temporaryRoot)
0101 |   $dataDir = Join-Path $temporaryRoot "postgres-data"
0102 |   $logPath = Join-Path $temporaryRoot "postgres.log"
0103 | 
0104 |   Write-Host "Creating isolated PostgreSQL 16 cluster on 127.0.0.1:$port"
0105 |   Write-Host "Temporary data: $temporaryRoot"
0106 |   # Trust is limited to an ephemeral PostgreSQL server bound to loopback only.
0107 |   & $initdb -D $dataDir -U flytally -A trust --encoding=UTF8 --no-instructions
0108 |   Assert-Exit "Disposable initdb"
0109 |   $startupAttempted = $true
0110 |   & $pgctl -D $dataDir -l $logPath -o "-h 127.0.0.1 -p $port" -w -t 30 start
0111 |   Assert-Exit "Disposable postgres startup"
0112 |   $started = $true
0113 | 
0114 |   & $createdb -h 127.0.0.1 -p $port -U flytally flytally_currency_test
0115 |   Assert-Exit "Disposable database creation"
0116 |   # Fresh cluster uses localhost trust, never copies any existing DB password.
0117 |   $env:PGPASSWORD = ""
0118 |   $env:DATABASE_URL = "postgresql://flytally@127.0.0.1:$port/flytally_currency_test"
0119 |   $env:FLYTALLY_AUTH_BROWSER = "1"
0120 |   $env:FLYTALLY_CURRENCY_V21_BROWSER = "1"
0121 |   $env:FLYTALLY_LOCAL_POSTGRES = "1"
0122 |   # Format each database field explicitly to avoid platform-dependent scalar
0123 |   # concatenation and preserve actionable, non-secret diagnostics on mismatch.
0124 |   $identityOutput = @(& $psql -X -w -v ON_ERROR_STOP=1 -At -F "|" -d $env:DATABASE_URL -c "SELECT current_database(), current_user, host(inet_server_addr()), inet_server_port()")
0125 |   Assert-Exit "Disposable local database identity"
0126 |   $identityRows = @($identityOutput | ForEach-Object { [string]$_ } | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
0127 |   $expectedIdentity = "flytally_currency_test|flytally|127.0.0.1|$port"
0128 |   $observedIdentity = $identityRows -join "; "
0129 |   Write-Host "Database identity expected: [$expectedIdentity]"
0130 |   Write-Host "Database identity observed: [$observedIdentity]"
0131 |   if ($identityRows.Count -ne 1 -or $identityRows[0] -cne $expectedIdentity) {
0132 |     throw "Test database identity mismatch. PostgreSQL tests NOT RUN. No existing database was changed."
0133 |   }
0134 |   Write-Host "Verified disposable DB identity."
0135 | 
0136 |   # The browser harness invokes a fixture bootstrap that drops schema public;
0137 |   # DATABASE_URL above points exclusively to the newly created verified cluster.
0138 |   npm.cmd run test:browser -- e2e/trash-integrity.spec.mjs
0139 |   Assert-Exit "Currency 3.8.0 authenticated desktop/mobile Trash-integrity acceptance"
0140 |   Write-Host "LOCAL CURRENCY 3.8 AUTH BROWSER PASS on $commit with disposable localhost database only; full signed portable v13 recovery and production Neon remain OPEN. Not production." -ForegroundColor Green
0141 | } finally {
0142 |   Restore-Env "DATABASE_URL" $oldDatabaseUrl
0143 |   Restore-Env "FLYTALLY_POSTGRES_INTEGRATION" $oldPgIntegration
0144 |   Restore-Env "FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE" $oldD3bTargetedPg16
0145 |   Restore-Env "FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE" $oldD3bMigrationsPg16
0146 |   Restore-Env "PGPASSWORD" $oldPgPassword
0147 |   Restore-Env "FLYTALLY_AUTH_BROWSER" $oldAuthBrowser
0148 |   Restore-Env "FLYTALLY_CURRENCY_V21_BROWSER" $oldCurrencyBrowser
0149 |   Restore-Env "FLYTALLY_LOCAL_POSTGRES" $oldLocalPostgres
0150 |   Restore-Env "SESSION_SECRET" $oldSessionSecret
0151 |   Restore-Env "SIGNING_SECRET" $oldSigningSecret
0152 |   $env:Path = $oldPath
0153 | 
0154 |   if ($started) {
0155 |     # Stop ONLY the unique cluster this script created. If stop fails, preserve data
0156 |     # for inspection rather than delete files belonging to a running server.
0157 |     & (Join-Path $env:ProgramFiles "PostgreSQL\16\bin\pg_ctl.exe") -D $dataDir -m fast -w -t 30 stop
0158 |     if ($LASTEXITCODE -eq 0) {
0159 |       $mayDeleteTemporaryRoot = $true
0160 |     } else {
0161 |       Write-Warning "Temporary PostgreSQL stop failed. Preserving data at $temporaryRoot for manual inspection."
0162 |     }
0163 |   } elseif ($temporaryRoot) {
0164 |     if ($startupAttempted -and (Test-Path (Join-Path $dataDir "postmaster.pid"))) {
0165 |       Write-Warning "PostgreSQL startup status unknown. Preserving $temporaryRoot for inspection."
0166 |     } else {
0167 |       $mayDeleteTemporaryRoot = $true
0168 |     }
0169 |   }
0170 |   if ($mayDeleteTemporaryRoot -and $temporaryRoot -and (Test-Path $temporaryRoot)) {
0171 |     Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
0172 |   }
0173 |   Pop-Location
0174 | }
0175 | 
```

## Scope/limitations of packet

`lib/db-optimization.ts` includes exact 1-40 and 835-1079 to keep this packet manageable; earlier versions 1-19 body is omitted. **All three executable v21 SQL files, migration-plan.ts, tests/currency-v21-release-contract.test.ts and tests/integration/postgres-currency-v21-release.test.ts are included in full**. Supporting browser runtime and runner files are also included to disambiguate `NODE_ENV`. For an assertion about omitted sections, ask owner for `git show 4f8165272ff5dc33facdc60af1931f37b97c0303:<path>` output rather than guessing. The file is a frozen read-only copy and **not an execution artifact**.
