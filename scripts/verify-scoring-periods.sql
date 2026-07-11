-- Read-only production verification for scoring-period lifecycle deployment.
-- Run with a PostgreSQL connection after the migration is deployed:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verify-scoring-periods.sql

BEGIN;
SET TRANSACTION READ ONLY;

SELECT
  year,
  term_number,
  name,
  start_date,
  end_date,
  expected_saturdays,
  status
FROM public.academic_terms
WHERE year = 2026
  AND term_number IN (2, 3, 4)
ORDER BY term_number;

SELECT
  terms.year,
  terms.term_number,
  COUNT(saturdays.id) AS saturday_count,
  MIN(saturdays.saturday_date) AS first_saturday,
  MAX(saturdays.saturday_date) AS last_saturday
FROM public.academic_terms AS terms
LEFT JOIN public.academic_term_saturdays AS saturdays
  ON saturdays.term_id = terms.id
WHERE terms.year = 2026
  AND terms.term_number IN (2, 3, 4)
GROUP BY terms.year, terms.term_number
ORDER BY terms.term_number;

SELECT
  classes.name AS class_name,
  terms.term_number,
  periods.id AS period_id,
  periods.status,
  periods.offering_goal_snapshot,
  periods.reopen_count,
  periods.version
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
JOIN public.classes
  ON classes.id = periods.class_id
WHERE terms.year = 2026
  AND terms.term_number IN (2, 3, 4)
ORDER BY classes.name, terms.term_number;

-- Q4 is pre-created only as a draft shell. Participants and rules are copied
-- atomically by open_class_scoring_period at the next rollover.
SELECT
  COUNT(*) AS q4_period_count,
  COUNT(*) FILTER (WHERE periods.status <> 'draft') AS q4_non_draft_periods,
  COUNT(participants.id) AS q4_participant_rows,
  COUNT(rules.id) AS q4_rule_rows
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
LEFT JOIN public.class_scoring_period_students AS participants
  ON participants.period_id = periods.id
LEFT JOIN public.class_scoring_period_rules AS rules
  ON rules.period_id = periods.id
WHERE terms.year = 2026
  AND terms.term_number = 4;

SELECT
  days.day_date,
  terms.term_number,
  periods.status,
  COUNT(*) OVER (PARTITION BY days.class_id, days.day_date) AS mapping_count
FROM public.attendance_days AS days
LEFT JOIN public.class_scoring_periods AS periods
  ON periods.id = days.period_id
LEFT JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
WHERE days.day_date BETWEEN DATE '2026-04-11' AND DATE '2026-10-03'
ORDER BY days.day_date;

-- 2026-07-11 must resolve only to Q3.
SELECT
  COUNT(*) AS july_11_period_matches,
  COUNT(*) FILTER (WHERE terms.term_number = 3) AS july_11_q3_matches,
  COUNT(*) FILTER (WHERE terms.term_number <> 3) AS july_11_non_q3_matches
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
JOIN public.academic_term_saturdays AS saturdays
  ON saturdays.term_id = terms.id
WHERE saturdays.saturday_date = DATE '2026-07-11';

SELECT
  terms.term_number,
  participants.status,
  participants.source,
  COUNT(*) AS participant_count
FROM public.class_scoring_period_students AS participants
JOIN public.class_scoring_periods AS periods
  ON periods.id = participants.period_id
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
WHERE terms.year = 2026
  AND terms.term_number IN (2, 3)
GROUP BY terms.term_number, participants.status, participants.source
ORDER BY terms.term_number, participants.status, participants.source;

SELECT
  terms.term_number,
  rules.variant_kind,
  COUNT(*) AS rule_count,
  SUM(rules.points) FILTER (
    WHERE rules.is_active = TRUE
      AND rules.variant_kind = 'declared'
  ) AS active_declared_points
FROM public.class_scoring_period_rules AS rules
JOIN public.class_scoring_periods AS periods
  ON periods.id = rules.period_id
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
WHERE terms.year = 2026
  AND terms.term_number IN (2, 3)
GROUP BY terms.term_number, rules.variant_kind
ORDER BY terms.term_number, rules.variant_kind;

SELECT
  COUNT(*) FILTER (WHERE days.period_id IS NULL) AS attendance_days_without_period,
  COUNT(*) FILTER (
    WHERE days.period_id IS NULL
      AND days.day_date BETWEEN DATE '2026-04-11' AND DATE '2026-10-03'
  ) AS in_range_days_without_period
FROM public.attendance_days AS days;

SELECT
  COUNT(*) AS score_count,
  COUNT(*) FILTER (WHERE scores.period_rule_id IS NULL) AS scores_without_period_rule,
  COUNT(*) FILTER (
    WHERE day_periods.id IS DISTINCT FROM rule_periods.id
  ) AS score_period_mismatches
FROM public.attendance_scores AS scores
JOIN public.attendance_days AS days
  ON days.id = scores.day_id
LEFT JOIN public.class_scoring_periods AS day_periods
  ON day_periods.id = days.period_id
LEFT JOIN public.class_scoring_period_rules AS rules
  ON rules.id = scores.period_rule_id
LEFT JOIN public.class_scoring_periods AS rule_periods
  ON rule_periods.id = rules.period_id;

SELECT
  COUNT(*) AS audit_count,
  COUNT(*) FILTER (WHERE audit.period_id IS NULL) AS audit_rows_without_period,
  COUNT(*) FILTER (
    WHERE audit.period_id IS NOT NULL
      AND days.period_id IS DISTINCT FROM audit.period_id
  ) AS audit_period_mismatches
FROM public.scoring_audit_log AS audit
LEFT JOIN public.attendance_days AS days
  ON days.id = audit.day_id;

SELECT
  terms.term_number,
  findings.finding_code,
  findings.severity,
  findings.is_blocking,
  findings.status,
  COUNT(*) AS finding_count
FROM public.class_scoring_period_findings AS findings
JOIN public.class_scoring_periods AS periods
  ON periods.id = findings.period_id
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
WHERE terms.year = 2026
  AND terms.term_number IN (2, 3)
  AND findings.is_current = TRUE
GROUP BY
  terms.term_number,
  findings.finding_code,
  findings.severity,
  findings.is_blocking,
  findings.status
ORDER BY terms.term_number, findings.finding_code, findings.status;

SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'academic_terms',
    'academic_term_saturdays',
    'class_scoring_periods',
    'class_scoring_period_students',
    'class_scoring_period_rules',
    'class_scoring_period_lifecycle',
    'class_scoring_period_findings',
    'class_scoring_period_annotations',
    'class_scoring_period_result_revisions',
    'class_scoring_period_results'
  )
ORDER BY tablename;

SELECT
  to_regprocedure('public.open_class_scoring_period(uuid,uuid,text)') IS NOT NULL
    AS has_open_period_rpc,
  to_regprocedure('public.save_student_attendance_record_v2(uuid,date,uuid,uuid[],integer,jsonb,text)') IS NOT NULL
    AS has_scoring_v2_rpc,
  to_regprocedure('public.save_student_attendance_record(uuid,date,uuid,uuid[],integer,jsonb,text)') IS NOT NULL
    AS has_legacy_wrapper,
  to_regprocedure('public.save_attendance_day_offering(uuid,date,numeric,text)') IS NOT NULL
    AS has_offering_rpc,
  to_regprocedure('public.approve_scoring_period_audit(uuid,text)') IS NOT NULL
    AS has_audit_approval_rpc,
  to_regprocedure('public.reopen_scoring_period(uuid,text)') IS NOT NULL
    AS has_reopen_rpc,
  to_regprocedure('public.resolve_scoring_period_finding(uuid,text,boolean)') IS NOT NULL
    AS has_finding_resolution_rpc,
  to_regprocedure('public.move_active_students_to_class(uuid,uuid,text)') IS NOT NULL
    AS has_roster_transfer_rpc;

SELECT
  has_table_privilege(
    'service_role',
    'public.class_scoring_periods',
    'UPDATE'
  ) AS service_role_can_update_periods,
  has_table_privilege(
    'service_role',
    'public.class_scoring_period_findings',
    'UPDATE'
  ) AS service_role_can_update_findings,
  has_function_privilege(
    'authenticated',
    'private.sync_open_scoring_period_student()',
    'EXECUTE'
  ) AS authenticated_can_execute_roster_trigger,
  has_function_privilege(
    'service_role',
    'private.prevent_locked_scoring_fact_mutation()',
    'EXECUTE'
  ) AS service_role_can_execute_lock_trigger,
  has_function_privilege(
    'authenticated',
    'private.refresh_scoring_period_findings(uuid)',
    'EXECUTE'
  ) AS authenticated_can_refresh_findings_directly,
  has_function_privilege(
    'authenticated',
    'public.move_active_students_to_class(uuid,uuid,text)',
    'EXECUTE'
  ) AS authenticated_can_call_roster_transfer;

ROLLBACK;
