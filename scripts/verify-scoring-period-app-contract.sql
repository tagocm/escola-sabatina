-- Read-only post-deploy verification for the second-stage app-contract cutover.
-- Run only after 20260711011516_enforce_scoring_period_app_contract.sql.

BEGIN;
SET TRANSACTION READ ONLY;

SELECT
  has_table_privilege('anon', 'public.attendance_days', 'INSERT')
    AS anon_can_insert_attendance_days,
  has_table_privilege('anon', 'public.attendance_days', 'UPDATE')
    AS anon_can_update_attendance_days,
  has_table_privilege('authenticated', 'public.attendance_days', 'INSERT')
    AS authenticated_can_insert_attendance_days,
  has_table_privilege('authenticated', 'public.attendance_days', 'UPDATE')
    AS authenticated_can_update_attendance_days,
  has_table_privilege('authenticated', 'public.attendance_days', 'SELECT')
    AS authenticated_can_select_attendance_days;

SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'attendance_days'
ORDER BY policyname;

SELECT
  to_regprocedure('public.save_attendance_day_offering(uuid,date,numeric,text)')
    IS NOT NULL AS has_period_aware_offering_rpc,
  has_function_privilege(
    'authenticated',
    'public.save_attendance_day_offering(uuid,date,numeric,text)',
    'EXECUTE'
  ) AS authenticated_can_call_offering_rpc;

ROLLBACK;
