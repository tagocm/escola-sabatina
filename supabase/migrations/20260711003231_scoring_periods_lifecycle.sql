-- Additive scoring-period lifecycle for quarterly rollovers.
--
-- This migration intentionally keeps attendance_days.period_id and
-- attendance_scores.period_rule_id nullable during the compatibility window.
-- The current application may still initialize an attendance day before the
-- period-aware scoring RPC attaches it to the matching class period.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_sao_paulo_date()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE;
$$;

-- ---------------------------------------------------------------------------
-- Academic calendar and per-class scoring periods
-- ---------------------------------------------------------------------------

CREATE TABLE public.academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  term_number INTEGER NOT NULL CHECK (term_number BETWEEN 1 AND 4),
  name TEXT NOT NULL CHECK (NULLIF(BTRIM(name), '') IS NOT NULL),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  expected_saturdays INTEGER NOT NULL DEFAULT 13 CHECK (expected_saturdays > 0),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT academic_terms_date_order CHECK (end_date >= start_date),
  CONSTRAINT academic_terms_start_is_saturday CHECK (EXTRACT(ISODOW FROM start_date) = 6),
  CONSTRAINT academic_terms_end_is_saturday CHECK (EXTRACT(ISODOW FROM end_date) = 6),
  CONSTRAINT academic_terms_year_number_key UNIQUE (year, term_number)
);

CREATE TABLE public.academic_term_saturdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number > 0),
  saturday_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT academic_term_saturdays_week_key UNIQUE (term_id, week_number),
  CONSTRAINT academic_term_saturdays_date_key UNIQUE (term_id, saturday_date),
  CONSTRAINT academic_term_saturdays_is_saturday CHECK (EXTRACT(ISODOW FROM saturday_date) = 6)
);

CREATE TABLE public.class_scoring_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'open',
      'closed_pending_audit',
      'audit_in_progress',
      'audited_locked'
    )),
  offering_goal_snapshot NUMERIC NOT NULL DEFAULT 0
    CHECK (offering_goal_snapshot >= 0),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_reason TEXT,
  audit_started_at TIMESTAMPTZ,
  audit_started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  audited_at TIMESTAMPTZ,
  audited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  audit_reason TEXT,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reopen_count INTEGER NOT NULL DEFAULT 0 CHECK (reopen_count >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT class_scoring_periods_class_term_key UNIQUE (class_id, term_id),
  CONSTRAINT class_scoring_periods_id_class_key UNIQUE (id, class_id),
  CONSTRAINT class_scoring_periods_locked_state_check CHECK (
    status <> 'audited_locked'
    OR (audited_at IS NOT NULL AND locked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX class_scoring_periods_one_open_per_class
  ON public.class_scoring_periods(class_id)
  WHERE status = 'open';

CREATE INDEX class_scoring_periods_term_idx
  ON public.class_scoring_periods(term_id);

-- ---------------------------------------------------------------------------
-- Period snapshots: participants and rule versions
-- ---------------------------------------------------------------------------

CREATE TABLE public.class_scoring_period_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.class_scoring_periods(id) ON DELETE CASCADE,
  class_id UUID NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  student_name_snapshot TEXT NOT NULL
    CHECK (NULLIF(BTRIM(student_name_snapshot), '') IS NOT NULL),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'pending_review', 'excluded')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('historical_record', 'active_at_backfill', 'manual')),
  joined_on DATE,
  left_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT class_scoring_period_students_period_class_fkey
    FOREIGN KEY (period_id, class_id)
    REFERENCES public.class_scoring_periods(id, class_id)
    ON DELETE CASCADE,
  CONSTRAINT class_scoring_period_students_date_order
    CHECK (left_on IS NULL OR joined_on IS NULL OR left_on >= joined_on)
);

CREATE UNIQUE INDEX class_scoring_period_students_live_student_key
  ON public.class_scoring_period_students(period_id, student_id)
  WHERE student_id IS NOT NULL;

CREATE INDEX class_scoring_period_students_class_idx
  ON public.class_scoring_period_students(class_id, period_id);

CREATE TABLE public.class_scoring_period_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.class_scoring_periods(id) ON DELETE CASCADE,
  class_id UUID NOT NULL,
  source_rule_id UUID REFERENCES public.class_scoring_rules(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (NULLIF(BTRIM(name), '') IS NOT NULL),
  category TEXT NOT NULL
    CHECK (category IN ('frequencia', 'participacao', 'espiritual', 'atividade')),
  points INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  variant_kind TEXT NOT NULL DEFAULT 'declared'
    CHECK (variant_kind IN ('declared', 'legacy_observed')),
  effective_from DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT class_scoring_period_rules_period_class_fkey
    FOREIGN KEY (period_id, class_id)
    REFERENCES public.class_scoring_periods(id, class_id)
    ON DELETE CASCADE,
  CONSTRAINT class_scoring_period_rules_effective_order
    CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from)
);

CREATE UNIQUE INDEX class_scoring_period_rules_snapshot_key
  ON public.class_scoring_period_rules(
    period_id,
    source_rule_id,
    points,
    variant_kind
  )
  WHERE source_rule_id IS NOT NULL;

CREATE INDEX class_scoring_period_rules_period_order_idx
  ON public.class_scoring_period_rules(period_id, display_order, name);

-- ---------------------------------------------------------------------------
-- Lifecycle, audit findings, annotations and immutable result revisions
-- ---------------------------------------------------------------------------

CREATE TABLE public.class_scoring_period_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.class_scoring_periods(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'backfilled',
      'opened',
      'closed',
      'audit_started',
      'audit_approved',
      'reopened'
    )),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'Sistema',
  reason TEXT NOT NULL CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL),
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX class_scoring_period_lifecycle_period_idx
  ON public.class_scoring_period_lifecycle(period_id, created_at DESC);

CREATE TABLE public.class_scoring_period_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.class_scoring_periods(id) ON DELETE CASCADE,
  finding_code TEXT NOT NULL CHECK (NULLIF(BTRIM(finding_code), '') IS NOT NULL),
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'error')),
  is_blocking BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'accepted')),
  table_name TEXT,
  row_id UUID,
  saturday_date DATE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  expected_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  actual_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurrence_key TEXT,
  evidence_hash TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX class_scoring_period_findings_open_idx
  ON public.class_scoring_period_findings(period_id, is_blocking, status)
  WHERE status = 'open';

CREATE INDEX class_scoring_period_findings_row_idx
  ON public.class_scoring_period_findings(table_name, row_id);

CREATE UNIQUE INDEX class_scoring_period_findings_evidence_key
  ON public.class_scoring_period_findings(
    period_id,
    finding_code,
    occurrence_key,
    evidence_hash
  )
  WHERE occurrence_key IS NOT NULL
    AND evidence_hash IS NOT NULL;

CREATE TABLE public.class_scoring_period_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.class_scoring_periods(id) ON DELETE CASCADE,
  finding_id UUID REFERENCES public.class_scoring_period_findings(id) ON DELETE SET NULL,
  annotation_type TEXT NOT NULL DEFAULT 'note'
    CHECK (annotation_type IN ('note', 'decision', 'exception', 'reopen_reason')),
  body TEXT NOT NULL CHECK (NULLIF(BTRIM(body), '') IS NOT NULL),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'Sistema',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX class_scoring_period_annotations_period_idx
  ON public.class_scoring_period_annotations(period_id, created_at DESC);

CREATE TABLE public.class_scoring_period_result_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.class_scoring_periods(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'final', 'superseded')),
  reason TEXT NOT NULL CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL),
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  data_hash TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT class_scoring_period_result_revisions_key
    UNIQUE (period_id, revision_number)
);

CREATE TABLE public.class_scoring_period_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id UUID NOT NULL
    REFERENCES public.class_scoring_period_result_revisions(id) ON DELETE CASCADE,
  period_student_id UUID NOT NULL
    REFERENCES public.class_scoring_period_students(id) ON DELETE RESTRICT,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  student_name_snapshot TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank > 0),
  total_points INTEGER NOT NULL DEFAULT 0,
  recorded_saturdays INTEGER NOT NULL DEFAULT 0 CHECK (recorded_saturdays >= 0),
  possible_points INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT class_scoring_period_results_revision_student_key
    UNIQUE (revision_id, period_student_id)
);

CREATE INDEX class_scoring_period_results_rank_idx
  ON public.class_scoring_period_results(revision_id, rank, student_name_snapshot);

-- Existing write tables gain nullable compatibility columns. No historical
-- scoring value is rewritten by this migration.
ALTER TABLE public.attendance_days
  ADD COLUMN IF NOT EXISTS period_id UUID;

ALTER TABLE public.attendance_scores
  ADD COLUMN IF NOT EXISTS period_rule_id UUID;

ALTER TABLE public.scoring_audit_log
  ADD COLUMN IF NOT EXISTS period_id UUID;

ALTER TABLE public.attendance_days
  ADD CONSTRAINT attendance_days_period_fkey
  FOREIGN KEY (period_id)
  REFERENCES public.class_scoring_periods(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.attendance_scores
  ADD CONSTRAINT attendance_scores_period_rule_fkey
  FOREIGN KEY (period_rule_id)
  REFERENCES public.class_scoring_period_rules(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.scoring_audit_log
  ADD CONSTRAINT scoring_audit_log_period_fkey
  FOREIGN KEY (period_id)
  REFERENCES public.class_scoring_periods(id)
  ON DELETE SET NULL
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_attendance_days_period_id
  ON public.attendance_days(period_id, day_date);

CREATE INDEX IF NOT EXISTS idx_attendance_scores_period_rule_id
  ON public.attendance_scores(period_rule_id);

CREATE INDEX IF NOT EXISTS idx_scoring_audit_log_period_changed
  ON public.scoring_audit_log(period_id, changed_at DESC);

DROP TRIGGER IF EXISTS academic_terms_updated_at ON public.academic_terms;
CREATE TRIGGER academic_terms_updated_at
  BEFORE UPDATE ON public.academic_terms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS class_scoring_periods_updated_at ON public.class_scoring_periods;
CREATE TRIGGER class_scoring_periods_updated_at
  BEFORE UPDATE ON public.class_scoring_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Deterministic 2026 Q2/Q3 backfill
-- ---------------------------------------------------------------------------

INSERT INTO public.academic_terms (
  year,
  term_number,
  name,
  start_date,
  end_date,
  expected_saturdays,
  status
)
VALUES
  (2026, 2, '2º trimestre de 2026', DATE '2026-04-11', DATE '2026-07-04', 13, 'closed'),
  (2026, 3, '3º trimestre de 2026', DATE '2026-07-11', DATE '2026-10-03', 13, 'active'),
  (2026, 4, '4º trimestre de 2026', DATE '2026-10-10', DATE '2027-01-02', 13, 'planned')
ON CONFLICT (year, term_number) DO NOTHING;

INSERT INTO public.academic_term_saturdays (
  term_id,
  week_number,
  saturday_date
)
SELECT
  terms.id,
  weeks.week_number,
  terms.start_date + ((weeks.week_number - 1) * 7)
FROM public.academic_terms AS terms
CROSS JOIN LATERAL generate_series(1, terms.expected_saturdays) AS weeks(week_number)
WHERE terms.year = 2026
  AND terms.term_number IN (2, 3, 4)
ON CONFLICT (term_id, week_number) DO NOTHING;

INSERT INTO public.class_scoring_periods (
  class_id,
  term_id,
  status,
  offering_goal_snapshot,
  closed_at,
  closed_reason
)
SELECT
  classes.id,
  terms.id,
  CASE
    WHEN terms.term_number = 2 THEN 'closed_pending_audit'
    WHEN terms.term_number = 3 THEN 'open'
    ELSE 'draft'
  END,
  CASE
    WHEN terms.term_number IN (2, 3) THEN COALESCE(classes.offering_goal, 0)
    ELSE 0
  END,
  CASE WHEN terms.term_number = 2 THEN NOW() ELSE NULL END,
  CASE
    WHEN terms.term_number = 2
      THEN 'Fechamento operacional retroativo; dados aguardam auditoria.'
    ELSE NULL
  END
FROM public.classes
JOIN public.academic_terms AS terms
  ON terms.year = 2026
 AND terms.term_number IN (2, 3, 4)
WHERE (
    terms.term_number = 2
    AND (
      classes.is_active = TRUE
      OR EXISTS (
        SELECT 1
        FROM public.attendance_days AS days
        WHERE days.class_id = classes.id
          AND days.day_date BETWEEN DATE '2026-04-11' AND DATE '2026-07-04'
      )
    )
  )
  OR (
    terms.term_number = 3
    AND classes.is_active = TRUE
  )
  OR (
    terms.term_number = 4
    AND classes.is_active = TRUE
  )
ON CONFLICT (class_id, term_id) DO NOTHING;

-- Each historical day is attached by its class and exact term range. In
-- particular, 2026-07-11 can only resolve to Q3. The empty legacy 2026-04-04
-- placeholder remains nullable and is surfaced as an audit finding below.
UPDATE public.attendance_days AS days
SET period_id = periods.id
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
WHERE periods.class_id = days.class_id
  AND days.day_date BETWEEN terms.start_date AND terms.end_date
  AND terms.year = 2026
  AND terms.term_number IN (2, 3)
  AND days.period_id IS NULL;

-- The audit log is append-only. Temporarily disabling only its mutation guard
-- lets this schema migration annotate existing immutable events with period_id;
-- no prior audit value is changed or deleted.
ALTER TABLE public.scoring_audit_log
  DISABLE TRIGGER prevent_scoring_audit_log_mutation;

UPDATE public.scoring_audit_log AS audit
SET period_id = days.period_id
FROM public.attendance_days AS days
WHERE days.id = audit.day_id
  AND days.period_id IS NOT NULL
  AND audit.period_id IS NULL;

ALTER TABLE public.scoring_audit_log
  ENABLE TRIGGER prevent_scoring_audit_log_mutation;

-- Q2 includes every current active student plus every student with a Q2
-- historical record, even if that student is now inactive or transferred.
INSERT INTO public.class_scoring_period_students (
  period_id,
  class_id,
  student_id,
  student_name_snapshot,
  status,
  source,
  joined_on
)
SELECT DISTINCT
  periods.id,
  periods.class_id,
  students.id,
  students.full_name,
  CASE WHEN students.is_active THEN 'active' ELSE 'inactive' END,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.student_attendance_records AS records
      JOIN public.attendance_days AS days
        ON days.id = records.day_id
      WHERE records.student_id = students.id
        AND records.class_id = periods.class_id
        AND days.day_date BETWEEN terms.start_date AND terms.end_date
    ) THEN 'historical_record'
    ELSE 'active_at_backfill'
  END,
  terms.start_date
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
 AND terms.year = 2026
 AND terms.term_number = 2
JOIN public.students
  ON (
    (students.class_id = periods.class_id AND students.is_active = TRUE)
    OR EXISTS (
      SELECT 1
      FROM public.student_attendance_records AS records
      JOIN public.attendance_days AS days
        ON days.id = records.day_id
      WHERE records.student_id = students.id
        AND records.class_id = periods.class_id
        AND days.day_date BETWEEN terms.start_date AND terms.end_date
    )
  )
ON CONFLICT DO NOTHING;

-- Q3 starts with the active roster of the class at migration time.
INSERT INTO public.class_scoring_period_students (
  period_id,
  class_id,
  student_id,
  student_name_snapshot,
  status,
  source,
  joined_on
)
SELECT
  periods.id,
  periods.class_id,
  students.id,
  students.full_name,
  'active',
  'active_at_backfill',
  terms.start_date
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
 AND terms.year = 2026
 AND terms.term_number = 3
JOIN public.students
  ON students.class_id = periods.class_id
 AND students.is_active = TRUE
ON CONFLICT DO NOTHING;

-- Declared snapshots preserve the current rule catalog independently in Q2
-- and Q3. The historical attendance_scores rows are not changed here.
INSERT INTO public.class_scoring_period_rules (
  period_id,
  class_id,
  source_rule_id,
  name,
  category,
  points,
  is_active,
  display_order,
  variant_kind,
  effective_from,
  effective_until
)
SELECT
  periods.id,
  periods.class_id,
  rules.id,
  rules.name,
  rules.category,
  rules.points,
  rules.is_active,
  rules.display_order,
  'declared',
  terms.start_date,
  terms.end_date
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
 AND terms.year = 2026
 AND terms.term_number IN (2, 3)
JOIN public.class_scoring_rules AS rules
  ON rules.class_id = periods.class_id
ON CONFLICT DO NOTHING;

-- If a historical component carries a point value different from today's
-- catalog, preserve the observed value as a separate period-rule variant.
INSERT INTO public.class_scoring_period_rules (
  period_id,
  class_id,
  source_rule_id,
  name,
  category,
  points,
  is_active,
  display_order,
  variant_kind,
  effective_from,
  effective_until
)
SELECT DISTINCT
  periods.id,
  periods.class_id,
  rules.id,
  rules.name,
  rules.category,
  scores.points_earned,
  FALSE,
  rules.display_order,
  'legacy_observed',
  terms.start_date,
  terms.end_date
FROM public.attendance_scores AS scores
JOIN public.attendance_days AS days
  ON days.id = scores.day_id
JOIN public.class_scoring_periods AS periods
  ON periods.id = days.period_id
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
JOIN public.class_scoring_rules AS rules
  ON rules.id = scores.rule_id
WHERE scores.points_earned <> rules.points
  AND terms.year = 2026
  AND terms.term_number IN (2, 3)
ON CONFLICT DO NOTHING;

-- Link every existing score to the exact period snapshot carrying the same
-- source rule and points. No points_earned or total_points value is rewritten.
UPDATE public.attendance_scores AS scores
SET period_rule_id = period_rules.id
FROM public.attendance_days AS days
JOIN public.class_scoring_period_rules AS period_rules
  ON period_rules.period_id = days.period_id
WHERE days.id = scores.day_id
  AND period_rules.source_rule_id = scores.rule_id
  AND period_rules.points = scores.points_earned
  AND scores.period_rule_id IS NULL;

INSERT INTO public.class_scoring_period_lifecycle (
  period_id,
  event_type,
  from_status,
  to_status,
  actor_name,
  reason,
  metadata
)
SELECT
  periods.id,
  'backfilled',
  NULL,
  periods.status,
  'Sistema',
  CASE
    WHEN terms.term_number = 2
      THEN 'Q2 importado como fechado e pendente de auditoria.'
    ELSE 'Q3 aberto com roster e regras vigentes no início do período.'
  END,
  jsonb_build_object(
    'migration', '20260711003231_scoring_periods_lifecycle',
    'year', terms.year,
    'term_number', terms.term_number
  )
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
WHERE terms.year = 2026
  AND terms.term_number IN (2, 3);

-- ---------------------------------------------------------------------------
-- Initial audit findings. These record inconsistencies; they do not repair or
-- reinterpret historical data automatically.
-- ---------------------------------------------------------------------------

WITH score_totals AS (
  SELECT
    scores.day_id,
    scores.student_id,
    COALESCE(SUM(scores.points_earned), 0)::INTEGER AS component_points
  FROM public.attendance_scores AS scores
  GROUP BY scores.day_id, scores.student_id
), mismatches AS (
  SELECT
    records.id AS record_id,
    records.student_id,
    days.day_date,
    days.period_id,
    records.total_points AS actual_total,
    (
      COALESCE(score_totals.component_points, 0)
      + COALESCE(records.extra_activity_points, 0)
      - COALESCE(records.discipline_penalty_points, 0)
    )::INTEGER AS expected_total
  FROM public.student_attendance_records AS records
  JOIN public.attendance_days AS days
    ON days.id = records.day_id
  LEFT JOIN score_totals
    ON score_totals.day_id = records.day_id
   AND score_totals.student_id = records.student_id
  WHERE days.period_id IS NOT NULL
)
INSERT INTO public.class_scoring_period_findings (
  period_id,
  finding_code,
  severity,
  is_blocking,
  table_name,
  row_id,
  saturday_date,
  student_id,
  expected_data,
  actual_data,
  metadata
)
SELECT
  mismatches.period_id,
  'record_total_mismatch',
  'error',
  TRUE,
  'student_attendance_records',
  mismatches.record_id,
  mismatches.day_date,
  mismatches.student_id,
  jsonb_build_object('total_points', mismatches.expected_total),
  jsonb_build_object('total_points', mismatches.actual_total),
  jsonb_build_object('delta', mismatches.actual_total - mismatches.expected_total)
FROM mismatches
WHERE mismatches.actual_total <> mismatches.expected_total;

INSERT INTO public.class_scoring_period_findings (
  period_id,
  finding_code,
  severity,
  is_blocking,
  table_name,
  row_id,
  saturday_date,
  student_id,
  expected_data,
  actual_data
)
SELECT
  periods.id,
  'rule_points_differ_from_catalog',
  'warning',
  TRUE,
  'attendance_scores',
  scores.id,
  days.day_date,
  scores.student_id,
  jsonb_build_object('catalog_points', rules.points),
  jsonb_build_object('points_earned', scores.points_earned)
FROM public.attendance_scores AS scores
JOIN public.attendance_days AS days
  ON days.id = scores.day_id
JOIN public.class_scoring_periods AS periods
  ON periods.id = days.period_id
JOIN public.class_scoring_rules AS rules
  ON rules.id = scores.rule_id
WHERE scores.points_earned <> rules.points;

WITH expected_roster AS (
  SELECT
    participants.period_id,
    COUNT(*)::INTEGER AS expected_count
  FROM public.class_scoring_period_students AS participants
  WHERE participants.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.student_attendance_records AS historical_records
      JOIN public.attendance_days AS historical_days
        ON historical_days.id = historical_records.day_id
      WHERE historical_records.student_id = participants.student_id
        AND historical_days.period_id = participants.period_id
    )
  GROUP BY participants.period_id
), saturday_counts AS (
  SELECT
    periods.id AS period_id,
    saturdays.saturday_date,
    expected_roster.expected_count,
    COUNT(DISTINCT records.student_id)::INTEGER AS record_count
  FROM public.class_scoring_periods AS periods
  JOIN public.academic_terms AS terms
    ON terms.id = periods.term_id
   AND terms.year = 2026
   AND terms.term_number = 2
  JOIN public.academic_term_saturdays AS saturdays
    ON saturdays.term_id = terms.id
  JOIN expected_roster
    ON expected_roster.period_id = periods.id
  LEFT JOIN public.attendance_days AS days
    ON days.period_id = periods.id
   AND days.day_date = saturdays.saturday_date
  LEFT JOIN public.student_attendance_records AS records
    ON records.day_id = days.id
  GROUP BY
    periods.id,
    saturdays.saturday_date,
    expected_roster.expected_count
)
INSERT INTO public.class_scoring_period_findings (
  period_id,
  finding_code,
  severity,
  is_blocking,
  saturday_date,
  expected_data,
  actual_data,
  metadata
)
SELECT
  saturday_counts.period_id,
  'saturday_incomplete_records',
  'warning',
  TRUE,
  saturday_counts.saturday_date,
  jsonb_build_object('expected_roster_count', saturday_counts.expected_count),
  jsonb_build_object('record_count', saturday_counts.record_count),
  jsonb_build_object('threshold', 'less_than_60_percent_of_expected_roster')
FROM saturday_counts
WHERE saturday_counts.record_count
  < CEIL(saturday_counts.expected_count * 0.60)::INTEGER;

INSERT INTO public.class_scoring_period_findings (
  period_id,
  finding_code,
  severity,
  is_blocking,
  table_name,
  expected_data,
  actual_data,
  metadata
)
SELECT
  periods.id,
  'unattributed_scoring_audit_rows',
  'warning',
  TRUE,
  'scoring_audit_log',
  jsonb_build_object('actor', 'identified', 'request_id', 'present'),
  jsonb_build_object('row_count', COUNT(*)),
  jsonb_build_object('resolution', 'accept legacy gap or document external evidence')
FROM public.class_scoring_periods AS periods
JOIN public.attendance_days AS days
  ON days.period_id = periods.id
JOIN public.scoring_audit_log AS audit
  ON audit.day_id = days.id
WHERE audit.actor_user_id IS NULL
  AND audit.request_id IS NULL
  AND audit.actor_name = 'Sistema'
  AND audit.source = 'database'
  AND audit.reason = 'direct scoring table change without RPC reason'
  AND audit.operation = 'insert'
GROUP BY periods.id
HAVING COUNT(*) > 0;

-- Any attendance day outside the declared Q2/Q3 ranges is retained and made
-- visible as a finding rather than being deleted or silently reclassified.
INSERT INTO public.class_scoring_period_findings (
  period_id,
  finding_code,
  severity,
  is_blocking,
  table_name,
  row_id,
  saturday_date,
  expected_data,
  actual_data
)
SELECT
  q2_periods.id,
  'legacy_unassigned_attendance_day',
  'info',
  FALSE,
  'attendance_days',
  days.id,
  days.day_date,
  jsonb_build_object('period_range', '2026-04-11..2026-07-04'),
  jsonb_build_object(
    'period_id', days.period_id,
    'total_offering', days.total_offering,
    'notes', days.notes
  )
FROM public.attendance_days AS days
JOIN public.class_scoring_periods AS q2_periods
  ON q2_periods.class_id = days.class_id
JOIN public.academic_terms AS q2_terms
  ON q2_terms.id = q2_periods.term_id
 AND q2_terms.year = 2026
 AND q2_terms.term_number = 2
WHERE days.period_id IS NULL;

UPDATE public.class_scoring_period_findings AS findings
SET
  occurrence_key = COALESCE(
    findings.row_id::TEXT,
    findings.saturday_date::TEXT,
    'period'
  ),
  evidence_hash = md5(jsonb_build_object(
    'expected', findings.expected_data,
    'actual', findings.actual_data
  )::TEXT),
  is_current = TRUE,
  last_seen_at = NOW()
WHERE findings.occurrence_key IS NULL
   OR findings.evidence_hash IS NULL;

-- ---------------------------------------------------------------------------
-- Draft result revisions for audit comparison. Approval creates a fresh final
-- revision; these drafts are never treated as audited output.
-- ---------------------------------------------------------------------------

INSERT INTO public.class_scoring_period_result_revisions (
  period_id,
  revision_number,
  status,
  reason,
  summary
)
SELECT
  periods.id,
  1,
  'draft',
  'Snapshot inicial gerado pelo backfill de períodos.',
  jsonb_build_object(
    'migration', '20260711003231_scoring_periods_lifecycle',
    'term', terms.term_number,
    'year', terms.year
  )
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms
  ON terms.id = periods.term_id
WHERE terms.year = 2026
  AND terms.term_number IN (2, 3)
ON CONFLICT (period_id, revision_number) DO NOTHING;

WITH participant_totals AS (
  SELECT
    participants.id AS period_student_id,
    participants.period_id,
    participants.student_id,
    participants.student_name_snapshot,
    COALESCE(SUM(records.total_points), 0)::INTEGER AS total_points,
    COUNT(DISTINCT records.day_id)::INTEGER AS recorded_saturdays
  FROM public.class_scoring_period_students AS participants
  LEFT JOIN (
    public.student_attendance_records AS records
    JOIN public.attendance_days AS days
      ON days.id = records.day_id
  )
    ON records.student_id = participants.student_id
   AND days.period_id = participants.period_id
   AND (participants.joined_on IS NULL OR days.day_date >= participants.joined_on)
   AND (participants.left_on IS NULL OR days.day_date < participants.left_on)
  GROUP BY
    participants.id,
    participants.period_id,
    participants.student_id,
    participants.student_name_snapshot
), rule_totals AS (
  SELECT
    periods.id AS period_id,
    COALESCE(SUM(rules.points) FILTER (
      WHERE rules.is_active = TRUE
        AND rules.variant_kind = 'declared'
    ), 0)::INTEGER AS points_per_saturday
  FROM public.class_scoring_periods AS periods
  LEFT JOIN public.class_scoring_period_rules AS rules
    ON rules.period_id = periods.id
  GROUP BY periods.id
), possible_points AS (
  SELECT
    participants.id AS period_student_id,
    rule_totals.points_per_saturday
      * COUNT(saturdays.id)::INTEGER AS possible_points
  FROM public.class_scoring_period_students AS participants
  JOIN public.class_scoring_periods AS periods
    ON periods.id = participants.period_id
  JOIN public.academic_terms AS terms
    ON terms.id = periods.term_id
  JOIN rule_totals
    ON rule_totals.period_id = periods.id
  LEFT JOIN public.academic_term_saturdays AS saturdays
    ON saturdays.term_id = terms.id
   AND (participants.joined_on IS NULL OR saturdays.saturday_date >= participants.joined_on)
   AND (participants.left_on IS NULL OR saturdays.saturday_date < participants.left_on)
  WHERE participants.status <> 'excluded'
  GROUP BY participants.id, rule_totals.points_per_saturday
), ranked AS (
  SELECT
    participant_totals.*,
    possible_points.possible_points,
    RANK() OVER (
      PARTITION BY participant_totals.period_id
      ORDER BY participant_totals.total_points DESC
    )::INTEGER AS rank
  FROM participant_totals
  JOIN possible_points
    ON possible_points.period_student_id = participant_totals.period_student_id
)
INSERT INTO public.class_scoring_period_results (
  revision_id,
  period_student_id,
  student_id,
  student_name_snapshot,
  rank,
  total_points,
  recorded_saturdays,
  possible_points,
  details
)
SELECT
  revisions.id,
  ranked.period_student_id,
  ranked.student_id,
  ranked.student_name_snapshot,
  ranked.rank,
  ranked.total_points,
  ranked.recorded_saturdays,
  ranked.possible_points,
  jsonb_build_object('snapshot_kind', 'backfill_draft')
FROM ranked
JOIN public.class_scoring_period_result_revisions AS revisions
  ON revisions.period_id = ranked.period_id
 AND revisions.revision_number = 1
ON CONFLICT (revision_id, period_student_id) DO NOTHING;

UPDATE public.class_scoring_period_result_revisions AS revisions
SET
  summary = revisions.summary || jsonb_build_object(
    'participant_count', snapshot.participant_count,
    'total_points', snapshot.total_points
  ),
  data_hash = snapshot.data_hash
FROM (
  SELECT
    results.revision_id,
    COUNT(*)::INTEGER AS participant_count,
    COALESCE(SUM(results.total_points), 0)::INTEGER AS total_points,
    md5(COALESCE(
      string_agg(
        concat_ws(
          '|',
          results.period_student_id::TEXT,
          results.rank::TEXT,
          results.total_points::TEXT,
          results.recorded_saturdays::TEXT,
          results.possible_points::TEXT
        ),
        '||' ORDER BY results.period_student_id
      ),
      ''
    )) AS data_hash
  FROM public.class_scoring_period_results AS results
  GROUP BY results.revision_id
) AS snapshot
WHERE snapshot.revision_id = revisions.id;

-- ---------------------------------------------------------------------------
-- Period-aware scoring audit trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.log_scoring_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_actor_name TEXT;
  v_row JSONB := COALESCE(to_jsonb(NEW), to_jsonb(OLD));
  v_operation TEXT := LOWER(TG_OP);
  v_reason TEXT := NULLIF(BTRIM(current_setting('app.scoring_change_reason', TRUE)), '');
  v_source TEXT := NULLIF(BTRIM(current_setting('app.scoring_change_source', TRUE)), '');
  v_request_id_text TEXT := NULLIF(BTRIM(current_setting('app.scoring_change_request_id', TRUE)), '');
  v_metadata_text TEXT := NULLIF(BTRIM(current_setting('app.scoring_change_metadata', TRUE)), '');
  v_request_id UUID;
  v_period_id UUID;
  v_metadata JSONB := '{}'::JSONB;
BEGIN
  IF v_request_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_request_id := v_request_id_text::UUID;
  END IF;

  IF v_metadata_text IS NOT NULL THEN
    BEGIN
      v_metadata := v_metadata_text::JSONB;
    EXCEPTION WHEN OTHERS THEN
      v_metadata := jsonb_build_object('metadata_parse_error', TRUE);
    END;
  END IF;

  IF v_actor_user_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(BTRIM(full_name), ''), email, 'Professor não identificado')
    INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_user_id;
  END IF;

  SELECT days.period_id
  INTO v_period_id
  FROM public.attendance_days AS days
  WHERE days.id = NULLIF(v_row->>'day_id', '')::UUID;

  INSERT INTO public.scoring_audit_log (
    request_id,
    table_name,
    operation,
    row_id,
    class_id,
    period_id,
    day_id,
    student_id,
    actor_user_id,
    actor_name,
    changed_at,
    transaction_id,
    reason,
    source,
    metadata,
    old_data,
    new_data
  )
  VALUES (
    v_request_id,
    TG_TABLE_NAME,
    v_operation,
    (v_row->>'id')::UUID,
    NULLIF(v_row->>'class_id', '')::UUID,
    v_period_id,
    NULLIF(v_row->>'day_id', '')::UUID,
    NULLIF(v_row->>'student_id', '')::UUID,
    v_actor_user_id,
    COALESCE(v_actor_name, 'Sistema'),
    clock_timestamp(),
    txid_current(),
    COALESCE(v_reason, 'direct scoring table change without RPC reason'),
    COALESCE(v_source, 'database'),
    v_metadata || jsonb_build_object('period_id', v_period_id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- Explicit grants and row-level read policies
-- ---------------------------------------------------------------------------

ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_term_saturdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_scoring_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_scoring_period_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_scoring_period_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_scoring_period_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_scoring_period_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_scoring_period_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_scoring_period_result_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_scoring_period_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.academic_terms FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.academic_term_saturdays FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.class_scoring_periods FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.class_scoring_period_students FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.class_scoring_period_rules FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.class_scoring_period_lifecycle FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.class_scoring_period_findings FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.class_scoring_period_annotations FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.class_scoring_period_result_revisions FROM anon, authenticated, service_role;
REVOKE ALL ON TABLE public.class_scoring_period_results FROM anon, authenticated, service_role;

GRANT SELECT ON TABLE public.academic_terms TO authenticated, service_role;
GRANT SELECT ON TABLE public.academic_term_saturdays TO authenticated, service_role;
GRANT SELECT ON TABLE public.class_scoring_periods TO authenticated, service_role;
GRANT SELECT ON TABLE public.class_scoring_period_students TO authenticated, service_role;
GRANT SELECT ON TABLE public.class_scoring_period_rules TO authenticated, service_role;
GRANT SELECT ON TABLE public.class_scoring_period_lifecycle TO authenticated, service_role;
GRANT SELECT ON TABLE public.class_scoring_period_findings TO authenticated, service_role;
GRANT SELECT ON TABLE public.class_scoring_period_annotations TO authenticated, service_role;
GRANT SELECT ON TABLE public.class_scoring_period_result_revisions TO authenticated, service_role;
GRANT SELECT ON TABLE public.class_scoring_period_results TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_scoring_period_teacher(p_period_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_scoring_periods AS periods
    JOIN public.class_members
      ON class_members.class_id = periods.class_id
    JOIN public.profiles
      ON profiles.id = class_members.user_id
    WHERE periods.id = p_period_id
      AND class_members.user_id = auth.uid()
      AND class_members.is_active = TRUE
      AND profiles.role = 'teacher'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_scoring_period_guardian(p_period_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_scoring_period_students AS participants
    JOIN public.guardian_students
      ON guardian_students.student_id = participants.student_id
    WHERE participants.period_id = p_period_id
      AND guardian_students.guardian_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.is_scoring_period_owner(p_period_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_scoring_periods AS periods
    JOIN public.class_members
      ON class_members.class_id = periods.class_id
    JOIN public.profiles
      ON profiles.id = class_members.user_id
    WHERE periods.id = p_period_id
      AND class_members.user_id = auth.uid()
      AND class_members.is_active = TRUE
      AND class_members.role = 'owner'
      AND profiles.role = 'teacher'
  );
$$;

REVOKE ALL ON FUNCTION private.is_scoring_period_teacher(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_scoring_period_guardian(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_scoring_period_owner(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_scoring_period_teacher(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_scoring_period_guardian(UUID) TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE POLICY academic_terms_select_authenticated
  ON public.academic_terms FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY academic_term_saturdays_select_authenticated
  ON public.academic_term_saturdays FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY class_scoring_periods_select_authorized
  ON public.class_scoring_periods FOR SELECT
  TO authenticated
  USING (
    private.is_scoring_period_teacher(id)
    OR private.is_scoring_period_guardian(id)
  );

CREATE POLICY class_scoring_period_students_select_authorized
  ON public.class_scoring_period_students FOR SELECT
  TO authenticated
  USING (
    private.is_scoring_period_teacher(period_id)
    OR (
      private.is_scoring_period_guardian(period_id)
      AND EXISTS (
        SELECT 1
        FROM public.guardian_students
        WHERE guardian_students.guardian_id = (SELECT auth.uid())
          AND guardian_students.student_id = class_scoring_period_students.student_id
      )
    )
  );

CREATE POLICY class_scoring_period_rules_select_authorized
  ON public.class_scoring_period_rules FOR SELECT
  TO authenticated
  USING (
    private.is_scoring_period_teacher(period_id)
    OR private.is_scoring_period_guardian(period_id)
  );

CREATE POLICY class_scoring_period_lifecycle_select_teachers
  ON public.class_scoring_period_lifecycle FOR SELECT
  TO authenticated
  USING (private.is_scoring_period_teacher(period_id));

CREATE POLICY class_scoring_period_findings_select_teachers
  ON public.class_scoring_period_findings FOR SELECT
  TO authenticated
  USING (private.is_scoring_period_teacher(period_id));

CREATE POLICY class_scoring_period_annotations_select_teachers
  ON public.class_scoring_period_annotations FOR SELECT
  TO authenticated
  USING (private.is_scoring_period_teacher(period_id));

CREATE POLICY class_scoring_period_result_revisions_select_authorized
  ON public.class_scoring_period_result_revisions FOR SELECT
  TO authenticated
  USING (
    private.is_scoring_period_teacher(period_id)
    OR (
      status = 'final'
      AND private.is_scoring_period_guardian(period_id)
    )
  );

CREATE POLICY class_scoring_period_results_select_authorized
  ON public.class_scoring_period_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_scoring_period_result_revisions AS revisions
      WHERE revisions.id = class_scoring_period_results.revision_id
        AND (
          private.is_scoring_period_teacher(revisions.period_id)
          OR (
            revisions.status = 'final'
            AND EXISTS (
              SELECT 1
              FROM public.guardian_students
              WHERE guardian_students.guardian_id = (SELECT auth.uid())
                AND guardian_students.student_id = class_scoring_period_results.student_id
            )
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION private.prevent_scoring_period_append_only_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'scoring period history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS prevent_scoring_period_lifecycle_mutation
  ON public.class_scoring_period_lifecycle;
CREATE TRIGGER prevent_scoring_period_lifecycle_mutation
  BEFORE UPDATE OR DELETE ON public.class_scoring_period_lifecycle
  FOR EACH ROW EXECUTE FUNCTION private.prevent_scoring_period_append_only_mutation();

DROP TRIGGER IF EXISTS prevent_scoring_period_annotations_mutation
  ON public.class_scoring_period_annotations;
CREATE TRIGGER prevent_scoring_period_annotations_mutation
  BEFORE UPDATE OR DELETE ON public.class_scoring_period_annotations
  FOR EACH ROW EXECUTE FUNCTION private.prevent_scoring_period_append_only_mutation();

-- ---------------------------------------------------------------------------
-- Period lifecycle and audit-owner functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.create_scoring_period_result_revision(
  p_period_id UUID,
  p_status TEXT,
  p_reason TEXT,
  p_actor_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_revision_id UUID;
  v_revision_number INTEGER;
BEGIN
  IF p_status NOT IN ('draft', 'final') THEN
    RAISE EXCEPTION 'Status de revisão de resultado inválido.';
  END IF;

  SELECT COALESCE(MAX(revision_number), 0) + 1
  INTO v_revision_number
  FROM public.class_scoring_period_result_revisions
  WHERE period_id = p_period_id;

  IF p_status = 'final' THEN
    UPDATE public.class_scoring_period_result_revisions
    SET status = 'superseded'
    WHERE period_id = p_period_id
      AND status = 'final';
  END IF;

  INSERT INTO public.class_scoring_period_result_revisions (
    period_id,
    revision_number,
    status,
    reason,
    calculated_by,
    approved_at,
    approved_by
  )
  VALUES (
    p_period_id,
    v_revision_number,
    p_status,
    p_reason,
    p_actor_user_id,
    CASE WHEN p_status = 'final' THEN NOW() ELSE NULL END,
    CASE WHEN p_status = 'final' THEN p_actor_user_id ELSE NULL END
  )
  RETURNING id INTO v_revision_id;

  WITH participant_totals AS (
    SELECT
      participants.id AS period_student_id,
      participants.student_id,
      participants.student_name_snapshot,
      COALESCE(SUM(records.total_points), 0)::INTEGER AS total_points,
      COUNT(DISTINCT records.day_id)::INTEGER AS recorded_saturdays
    FROM public.class_scoring_period_students AS participants
    LEFT JOIN (
      public.student_attendance_records AS records
      JOIN public.attendance_days AS days
        ON days.id = records.day_id
    )
      ON records.student_id = participants.student_id
     AND days.period_id = participants.period_id
     AND (participants.joined_on IS NULL OR days.day_date >= participants.joined_on)
     AND (participants.left_on IS NULL OR days.day_date < participants.left_on)
    WHERE participants.period_id = p_period_id
      AND participants.status <> 'excluded'
    GROUP BY
      participants.id,
      participants.student_id,
      participants.student_name_snapshot
  ), rule_total AS (
    SELECT
      COALESCE(SUM(rules.points) FILTER (
        WHERE rules.is_active = TRUE
          AND rules.variant_kind = 'declared'
      ), 0)::INTEGER AS points_per_saturday
    FROM public.class_scoring_periods AS periods
    LEFT JOIN public.class_scoring_period_rules AS rules
      ON rules.period_id = periods.id
    WHERE periods.id = p_period_id
  ), possible_points AS (
    SELECT
      participants.id AS period_student_id,
      rule_total.points_per_saturday
        * COUNT(saturdays.id)::INTEGER AS possible_points
    FROM public.class_scoring_period_students AS participants
    JOIN public.class_scoring_periods AS periods
      ON periods.id = participants.period_id
    JOIN public.academic_terms AS terms
      ON terms.id = periods.term_id
    CROSS JOIN rule_total
    LEFT JOIN public.academic_term_saturdays AS saturdays
      ON saturdays.term_id = terms.id
     AND (participants.joined_on IS NULL OR saturdays.saturday_date >= participants.joined_on)
     AND (participants.left_on IS NULL OR saturdays.saturday_date < participants.left_on)
    WHERE participants.period_id = p_period_id
      AND participants.status <> 'excluded'
    GROUP BY participants.id, rule_total.points_per_saturday
  ), ranked AS (
    SELECT
      participant_totals.*,
      possible_points.possible_points,
      RANK() OVER (ORDER BY participant_totals.total_points DESC)::INTEGER AS rank
    FROM participant_totals
    JOIN possible_points
      ON possible_points.period_student_id = participant_totals.period_student_id
  )
  INSERT INTO public.class_scoring_period_results (
    revision_id,
    period_student_id,
    student_id,
    student_name_snapshot,
    rank,
    total_points,
    recorded_saturdays,
    possible_points,
    details
  )
  SELECT
    v_revision_id,
    ranked.period_student_id,
    ranked.student_id,
    ranked.student_name_snapshot,
    ranked.rank,
    ranked.total_points,
    ranked.recorded_saturdays,
    ranked.possible_points,
    jsonb_build_object('snapshot_kind', p_status)
  FROM ranked;

  UPDATE public.class_scoring_period_result_revisions AS revisions
  SET
    summary = jsonb_build_object(
      'participant_count', snapshot.participant_count,
      'total_points', snapshot.total_points
    ),
    data_hash = snapshot.data_hash
  FROM (
    SELECT
      COUNT(*)::INTEGER AS participant_count,
      COALESCE(SUM(results.total_points), 0)::INTEGER AS total_points,
      md5(COALESCE(
        string_agg(
          concat_ws(
            '|',
            results.period_student_id::TEXT,
            results.rank::TEXT,
            results.total_points::TEXT,
            results.recorded_saturdays::TEXT,
            results.possible_points::TEXT
          ),
          '||' ORDER BY results.period_student_id
        ),
        ''
      )) AS data_hash
    FROM public.class_scoring_period_results AS results
    WHERE results.revision_id = v_revision_id
  ) AS snapshot
  WHERE revisions.id = v_revision_id;

  RETURN v_revision_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_scoring_period_findings(
  p_period_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_open_blocker_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.class_scoring_periods
    WHERE id = p_period_id
  ) THEN
    RAISE EXCEPTION 'Período de pontuação não encontrado.';
  END IF;

  DROP TABLE IF EXISTS pg_temp._scoring_period_finding_candidates;
  CREATE TEMP TABLE _scoring_period_finding_candidates (
    finding_code TEXT NOT NULL,
    severity TEXT NOT NULL,
    is_blocking BOOLEAN NOT NULL,
    table_name TEXT,
    row_id UUID,
    saturday_date DATE,
    student_id UUID,
    expected_data JSONB NOT NULL,
    actual_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    occurrence_key TEXT NOT NULL,
    evidence_hash TEXT NOT NULL
  ) ON COMMIT DROP;

  WITH score_totals AS (
    SELECT
      scores.day_id,
      scores.student_id,
      COALESCE(SUM(scores.points_earned), 0)::INTEGER AS component_points
    FROM public.attendance_scores AS scores
    JOIN public.attendance_days AS days
      ON days.id = scores.day_id
    WHERE days.period_id = p_period_id
    GROUP BY scores.day_id, scores.student_id
  ), mismatches AS (
    SELECT
      records.id AS record_id,
      records.student_id,
      days.day_date,
      records.total_points AS actual_total,
      (
        COALESCE(score_totals.component_points, 0)
        + COALESCE(records.extra_activity_points, 0)
        - COALESCE(records.discipline_penalty_points, 0)
      )::INTEGER AS expected_total
    FROM public.student_attendance_records AS records
    JOIN public.attendance_days AS days
      ON days.id = records.day_id
    LEFT JOIN score_totals
      ON score_totals.day_id = records.day_id
     AND score_totals.student_id = records.student_id
    WHERE days.period_id = p_period_id
  )
  INSERT INTO pg_temp._scoring_period_finding_candidates (
    finding_code,
    severity,
    is_blocking,
    table_name,
    row_id,
    saturday_date,
    student_id,
    expected_data,
    actual_data,
    metadata,
    occurrence_key,
    evidence_hash
  )
  SELECT
    'record_total_mismatch',
    'error',
    TRUE,
    'student_attendance_records',
    mismatches.record_id,
    mismatches.day_date,
    mismatches.student_id,
    evidence.expected_data,
    evidence.actual_data,
    jsonb_build_object('delta', mismatches.actual_total - mismatches.expected_total),
    mismatches.record_id::TEXT,
    md5(jsonb_build_object(
      'expected', evidence.expected_data,
      'actual', evidence.actual_data
    )::TEXT)
  FROM mismatches
  CROSS JOIN LATERAL (
    SELECT
      jsonb_build_object('total_points', mismatches.expected_total) AS expected_data,
      jsonb_build_object('total_points', mismatches.actual_total) AS actual_data
  ) AS evidence
  WHERE mismatches.actual_total <> mismatches.expected_total;

  INSERT INTO pg_temp._scoring_period_finding_candidates (
    finding_code,
    severity,
    is_blocking,
    table_name,
    row_id,
    saturday_date,
    student_id,
    expected_data,
    actual_data,
    occurrence_key,
    evidence_hash
  )
  SELECT
    'rule_points_differ_from_catalog',
    'warning',
    TRUE,
    'attendance_scores',
    scores.id,
    days.day_date,
    scores.student_id,
    evidence.expected_data,
    evidence.actual_data,
    scores.id::TEXT,
    md5(jsonb_build_object(
      'expected', evidence.expected_data,
      'actual', evidence.actual_data
    )::TEXT)
  FROM public.attendance_scores AS scores
  JOIN public.attendance_days AS days
    ON days.id = scores.day_id
  JOIN public.class_scoring_period_rules AS declared_rules
    ON declared_rules.period_id = p_period_id
   AND declared_rules.source_rule_id = scores.rule_id
   AND declared_rules.variant_kind = 'declared'
  CROSS JOIN LATERAL (
    SELECT
      jsonb_build_object('catalog_points', declared_rules.points) AS expected_data,
      jsonb_build_object('points_earned', scores.points_earned) AS actual_data
  ) AS evidence
  WHERE days.period_id = p_period_id
    AND scores.points_earned <> declared_rules.points;

  INSERT INTO pg_temp._scoring_period_finding_candidates (
    finding_code,
    severity,
    is_blocking,
    table_name,
    row_id,
    saturday_date,
    student_id,
    expected_data,
    actual_data,
    occurrence_key,
    evidence_hash
  )
  SELECT
    'rule_period_link_mismatch',
    'error',
    TRUE,
    'attendance_scores',
    scores.id,
    days.day_date,
    scores.student_id,
    evidence.expected_data,
    evidence.actual_data,
    scores.id::TEXT,
    md5(jsonb_build_object(
      'expected', evidence.expected_data,
      'actual', evidence.actual_data
    )::TEXT)
  FROM public.attendance_scores AS scores
  JOIN public.attendance_days AS days
    ON days.id = scores.day_id
  LEFT JOIN public.class_scoring_period_rules AS period_rules
    ON period_rules.id = scores.period_rule_id
  CROSS JOIN LATERAL (
    SELECT
      jsonb_build_object(
        'period_id', p_period_id,
        'source_rule_id', scores.rule_id,
        'points', scores.points_earned
      ) AS expected_data,
      jsonb_build_object(
        'period_id', period_rules.period_id,
        'source_rule_id', period_rules.source_rule_id,
        'points', period_rules.points,
        'period_rule_id', scores.period_rule_id
      ) AS actual_data
  ) AS evidence
  WHERE days.period_id = p_period_id
    AND (
      period_rules.id IS NULL
      OR period_rules.period_id IS DISTINCT FROM p_period_id
      OR period_rules.source_rule_id IS DISTINCT FROM scores.rule_id
      OR period_rules.points IS DISTINCT FROM scores.points_earned
    );

  WITH saturday_roster AS (
    SELECT
      saturdays.saturday_date,
      COUNT(participants.id)::INTEGER AS expected_count
    FROM public.class_scoring_periods AS periods
    JOIN public.academic_terms AS terms
      ON terms.id = periods.term_id
    JOIN public.academic_term_saturdays AS saturdays
      ON saturdays.term_id = terms.id
    LEFT JOIN public.class_scoring_period_students AS participants
      ON participants.period_id = periods.id
     AND participants.status <> 'excluded'
     AND (participants.joined_on IS NULL OR saturdays.saturday_date >= participants.joined_on)
     AND (participants.left_on IS NULL OR saturdays.saturday_date < participants.left_on)
    WHERE periods.id = p_period_id
    GROUP BY saturdays.saturday_date
  ), saturday_records AS (
    SELECT
      saturdays.saturday_date,
      COUNT(DISTINCT records.student_id)::INTEGER AS record_count
    FROM public.class_scoring_periods AS periods
    JOIN public.academic_terms AS terms
      ON terms.id = periods.term_id
    JOIN public.academic_term_saturdays AS saturdays
      ON saturdays.term_id = terms.id
    LEFT JOIN public.attendance_days AS days
      ON days.period_id = periods.id
     AND days.day_date = saturdays.saturday_date
    LEFT JOIN public.student_attendance_records AS records
      ON records.day_id = days.id
     AND EXISTS (
       SELECT 1
       FROM public.class_scoring_period_students AS participants
       WHERE participants.period_id = periods.id
         AND participants.student_id = records.student_id
         AND participants.status <> 'excluded'
         AND (participants.joined_on IS NULL OR saturdays.saturday_date >= participants.joined_on)
         AND (participants.left_on IS NULL OR saturdays.saturday_date < participants.left_on)
     )
    WHERE periods.id = p_period_id
    GROUP BY saturdays.saturday_date
  ), incomplete AS (
    SELECT
      saturday_roster.saturday_date,
      saturday_roster.expected_count,
      saturday_records.record_count
    FROM saturday_roster
    JOIN saturday_records USING (saturday_date)
    WHERE saturday_roster.expected_count > 0
      AND saturday_records.record_count
        < CEIL(saturday_roster.expected_count * 0.60)::INTEGER
  )
  INSERT INTO pg_temp._scoring_period_finding_candidates (
    finding_code,
    severity,
    is_blocking,
    saturday_date,
    expected_data,
    actual_data,
    metadata,
    occurrence_key,
    evidence_hash
  )
  SELECT
    'saturday_incomplete_records',
    'warning',
    TRUE,
    incomplete.saturday_date,
    evidence.expected_data,
    evidence.actual_data,
    jsonb_build_object('threshold', 'less_than_60_percent_of_valid_roster'),
    incomplete.saturday_date::TEXT,
    md5(jsonb_build_object(
      'expected', evidence.expected_data,
      'actual', evidence.actual_data
    )::TEXT)
  FROM incomplete
  CROSS JOIN LATERAL (
    SELECT
      jsonb_build_object('expected_roster_count', incomplete.expected_count) AS expected_data,
      jsonb_build_object('record_count', incomplete.record_count) AS actual_data
  ) AS evidence;

  INSERT INTO pg_temp._scoring_period_finding_candidates (
    finding_code,
    severity,
    is_blocking,
    table_name,
    expected_data,
    actual_data,
    metadata,
    occurrence_key,
    evidence_hash
  )
  SELECT
    'unattributed_scoring_audit_rows',
    'warning',
    TRUE,
    'scoring_audit_log',
    evidence.expected_data,
    evidence.actual_data,
    jsonb_build_object('resolution', 'accept legacy gap or document external evidence'),
    'operation:' || unattributed.operation,
    md5(jsonb_build_object(
      'expected', evidence.expected_data,
      'actual', evidence.actual_data
    )::TEXT)
  FROM (
    SELECT audit.operation, COUNT(*)::INTEGER AS row_count
    FROM public.attendance_days AS days
    JOIN public.scoring_audit_log AS audit
      ON audit.day_id = days.id
    WHERE days.period_id = p_period_id
      AND audit.actor_user_id IS NULL
      AND audit.request_id IS NULL
      AND audit.actor_name = 'Sistema'
      AND audit.source = 'database'
      AND audit.reason = 'direct scoring table change without RPC reason'
      AND audit.operation IN ('insert', 'update', 'delete')
    GROUP BY audit.operation
  ) AS unattributed
  CROSS JOIN LATERAL (
    SELECT
      jsonb_build_object(
        'actor', 'identified',
        'request_id', 'present',
        'operation', unattributed.operation
      ) AS expected_data,
      jsonb_build_object(
        'operation', unattributed.operation,
        'row_count', unattributed.row_count
      ) AS actual_data
  ) AS evidence
  WHERE unattributed.row_count > 0;

  UPDATE public.class_scoring_period_findings
  SET is_current = FALSE
  WHERE period_id = p_period_id
    AND finding_code IN (
      'record_total_mismatch',
      'rule_points_differ_from_catalog',
      'rule_period_link_mismatch',
      'saturday_incomplete_records',
      'unattributed_scoring_audit_rows'
    );

  INSERT INTO public.class_scoring_period_findings (
    period_id,
    finding_code,
    severity,
    is_blocking,
    status,
    table_name,
    row_id,
    saturday_date,
    student_id,
    expected_data,
    actual_data,
    metadata,
    occurrence_key,
    evidence_hash,
    is_current,
    last_seen_at
  )
  SELECT
    p_period_id,
    candidates.finding_code,
    candidates.severity,
    candidates.is_blocking,
    'open',
    candidates.table_name,
    candidates.row_id,
    candidates.saturday_date,
    candidates.student_id,
    candidates.expected_data,
    candidates.actual_data,
    candidates.metadata,
    candidates.occurrence_key,
    candidates.evidence_hash,
    TRUE,
    NOW()
  FROM pg_temp._scoring_period_finding_candidates AS candidates
  ON CONFLICT (
    period_id,
    finding_code,
    occurrence_key,
    evidence_hash
  ) WHERE occurrence_key IS NOT NULL
      AND evidence_hash IS NOT NULL
  DO UPDATE SET
    severity = EXCLUDED.severity,
    is_blocking = EXCLUDED.is_blocking,
    status = CASE
      WHEN class_scoring_period_findings.status = 'accepted' THEN 'accepted'
      ELSE 'open'
    END,
    table_name = EXCLUDED.table_name,
    row_id = EXCLUDED.row_id,
    saturday_date = EXCLUDED.saturday_date,
    student_id = EXCLUDED.student_id,
    expected_data = EXCLUDED.expected_data,
    actual_data = EXCLUDED.actual_data,
    metadata = EXCLUDED.metadata,
    resolved_at = CASE
      WHEN class_scoring_period_findings.status = 'accepted'
        THEN class_scoring_period_findings.resolved_at
      ELSE NULL
    END,
    resolved_by = CASE
      WHEN class_scoring_period_findings.status = 'accepted'
        THEN class_scoring_period_findings.resolved_by
      ELSE NULL
    END,
    resolution_reason = CASE
      WHEN class_scoring_period_findings.status = 'accepted'
        THEN class_scoring_period_findings.resolution_reason
      ELSE NULL
    END,
    is_current = TRUE,
    last_seen_at = NOW();

  SELECT COUNT(*)::INTEGER
  INTO v_open_blocker_count
  FROM public.class_scoring_period_findings
  WHERE period_id = p_period_id
    AND is_current = TRUE
    AND is_blocking = TRUE
    AND status = 'open';

  RETURN v_open_blocker_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.open_class_scoring_period_impl(
  p_class_id UUID,
  p_term_id UUID,
  p_reason TEXT
)
RETURNS TABLE (
  period_id UUID,
  status TEXT,
  version INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_actor_name TEXT;
  v_period public.class_scoring_periods%ROWTYPE;
  v_term public.academic_terms%ROWTYPE;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF v_reason IS NULL OR CHAR_LENGTH(v_reason) < 10 THEN
    RAISE EXCEPTION 'Informe um motivo da abertura com pelo menos 10 caracteres.';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(profiles.full_name), ''), profiles.email)
  INTO v_actor_name
  FROM public.profiles
  JOIN public.class_members
    ON class_members.user_id = profiles.id
  WHERE profiles.id = v_user_id
    AND profiles.role = 'teacher'
    AND class_members.class_id = p_class_id
    AND class_members.role = 'owner'
    AND class_members.is_active = TRUE;

  IF v_actor_name IS NULL THEN
    RAISE EXCEPTION 'Somente o proprietário da classe pode abrir o trimestre.';
  END IF;

  SELECT *
  INTO v_term
  FROM public.academic_terms
  WHERE id = p_term_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trimestre acadêmico não encontrado.';
  END IF;

  IF v_term.status NOT IN ('planned', 'active') THEN
    RAISE EXCEPTION 'O trimestre não está disponível para abertura.';
  END IF;

  IF private.current_sao_paulo_date() < v_term.start_date
     OR private.current_sao_paulo_date() > v_term.end_date THEN
    RAISE EXCEPTION 'O trimestre só pode ser aberto entre % e %.',
      v_term.start_date,
      v_term.end_date;
  END IF;

  INSERT INTO public.academic_term_saturdays (term_id, week_number, saturday_date)
  SELECT
    v_term.id,
    weeks.week_number,
    v_term.start_date + ((weeks.week_number - 1) * 7)
  FROM generate_series(1, v_term.expected_saturdays) AS weeks(week_number)
  ON CONFLICT (term_id, week_number) DO NOTHING;

  SELECT *
  INTO v_period
  FROM public.class_scoring_periods
  WHERE class_id = p_class_id
    AND term_id = p_term_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_period.status = 'open' THEN
      RETURN QUERY SELECT v_period.id, v_period.status, v_period.version;
      RETURN;
    END IF;

    IF v_period.status <> 'draft' THEN
      RAISE EXCEPTION 'O período já foi fechado ou auditado.';
    END IF;

    UPDATE public.class_scoring_periods
    SET
      status = 'open',
      offering_goal_snapshot = COALESCE((
        SELECT classes.offering_goal
        FROM public.classes
        WHERE classes.id = p_class_id
      ), 0),
      version = class_scoring_periods.version + 1,
      updated_at = NOW()
    WHERE id = v_period.id
    RETURNING * INTO v_period;
  ELSE
    INSERT INTO public.class_scoring_periods (
      class_id,
      term_id,
      status,
      offering_goal_snapshot,
      created_by
    )
    VALUES (
      p_class_id,
      p_term_id,
      'open',
      COALESCE((
        SELECT classes.offering_goal
        FROM public.classes
        WHERE classes.id = p_class_id
      ), 0),
      v_user_id
    )
    RETURNING * INTO v_period;
  END IF;

  INSERT INTO public.class_scoring_period_students (
    period_id,
    class_id,
    student_id,
    student_name_snapshot,
    status,
    source,
    joined_on,
    created_by
  )
  SELECT
    v_period.id,
    p_class_id,
    students.id,
    students.full_name,
    'active',
    'manual',
    GREATEST(v_term.start_date, private.current_sao_paulo_date()),
    v_user_id
  FROM public.students
  WHERE students.class_id = p_class_id
    AND students.is_active = TRUE
  ON CONFLICT DO NOTHING;

  INSERT INTO public.class_scoring_period_rules (
    period_id,
    class_id,
    source_rule_id,
    name,
    category,
    points,
    is_active,
    display_order,
    variant_kind,
    effective_from,
    effective_until,
    created_by
  )
  SELECT
    v_period.id,
    p_class_id,
    rules.id,
    rules.name,
    rules.category,
    rules.points,
    rules.is_active,
    rules.display_order,
    'declared',
    GREATEST(v_term.start_date, private.current_sao_paulo_date()),
    v_term.end_date,
    v_user_id
  FROM public.class_scoring_rules AS rules
  WHERE rules.class_id = p_class_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.class_scoring_period_lifecycle (
    period_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    actor_name,
    reason
  )
  VALUES (
    v_period.id,
    'opened',
    'draft',
    'open',
    v_user_id,
    v_actor_name,
    v_reason
  );

  RETURN QUERY SELECT v_period.id, v_period.status, v_period.version;
END;
$$;

CREATE OR REPLACE FUNCTION private.transition_scoring_period_impl(
  p_period_id UUID,
  p_action TEXT,
  p_reason TEXT
)
RETURNS TABLE (
  period_id UUID,
  status TEXT,
  version INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_actor_name TEXT;
  v_period public.class_scoring_periods%ROWTYPE;
  v_term_end_date DATE;
  v_from_status TEXT;
  v_to_status TEXT;
  v_event_type TEXT;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF v_reason IS NULL OR CHAR_LENGTH(v_reason) < 10 THEN
    RAISE EXCEPTION 'Informe um motivo da alteração com pelo menos 10 caracteres.';
  END IF;

  SELECT *
  INTO v_period
  FROM public.class_scoring_periods
  WHERE id = p_period_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Período de pontuação não encontrado.';
  END IF;

  SELECT terms.end_date
  INTO v_term_end_date
  FROM public.academic_terms AS terms
  WHERE terms.id = v_period.term_id;

  IF NOT private.is_scoring_period_owner(p_period_id) THEN
    RAISE EXCEPTION 'Somente o proprietário da classe pode alterar o ciclo do trimestre.';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(full_name), ''), email, 'Professor não identificado')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = v_user_id;

  v_from_status := v_period.status;

  CASE p_action
    WHEN 'close' THEN
      IF v_period.status <> 'open' THEN
        RAISE EXCEPTION 'Somente um período aberto pode ser fechado.';
      END IF;
      IF private.current_sao_paulo_date() < v_term_end_date THEN
        RAISE EXCEPTION 'O trimestre só pode ser fechado a partir de %.', v_term_end_date;
      END IF;
      PERFORM private.refresh_scoring_period_findings(p_period_id);
      v_to_status := 'closed_pending_audit';
      v_event_type := 'closed';

      UPDATE public.class_scoring_periods
      SET
        status = v_to_status,
        closed_at = NOW(),
        closed_by = v_user_id,
        closed_reason = v_reason,
        version = class_scoring_periods.version + 1,
        updated_at = NOW()
      WHERE id = p_period_id
      RETURNING * INTO v_period;

    WHEN 'begin_audit' THEN
      IF v_period.status <> 'closed_pending_audit' THEN
        RAISE EXCEPTION 'O período precisa estar fechado e pendente de auditoria.';
      END IF;
      PERFORM private.refresh_scoring_period_findings(p_period_id);
      v_to_status := 'audit_in_progress';
      v_event_type := 'audit_started';

      UPDATE public.class_scoring_periods
      SET
        status = v_to_status,
        audit_started_at = NOW(),
        audit_started_by = v_user_id,
        version = class_scoring_periods.version + 1,
        updated_at = NOW()
      WHERE id = p_period_id
      RETURNING * INTO v_period;

    WHEN 'approve_audit' THEN
      IF v_period.status <> 'audit_in_progress' THEN
        RAISE EXCEPTION 'O período precisa estar em auditoria antes da aprovação.';
      END IF;

      PERFORM private.refresh_scoring_period_findings(p_period_id);

      IF EXISTS (
        SELECT 1
        FROM public.class_scoring_period_findings AS findings
        WHERE findings.period_id = p_period_id
          AND findings.is_blocking = TRUE
          AND findings.is_current = TRUE
          AND findings.status = 'open'
      ) THEN
        RAISE EXCEPTION 'Resolva ou aceite os achados bloqueantes antes de aprovar a auditoria.';
      END IF;

      v_to_status := 'audited_locked';
      v_event_type := 'audit_approved';

      UPDATE public.class_scoring_periods
      SET
        status = v_to_status,
        audited_at = NOW(),
        audited_by = v_user_id,
        audit_reason = v_reason,
        locked_at = NOW(),
        locked_by = v_user_id,
        version = class_scoring_periods.version + 1,
        updated_at = NOW()
      WHERE id = p_period_id
      RETURNING * INTO v_period;

      PERFORM private.create_scoring_period_result_revision(
        p_period_id,
        'final',
        v_reason,
        v_user_id
      );

    WHEN 'reopen' THEN
      IF v_period.status <> 'audited_locked' THEN
        RAISE EXCEPTION 'Somente um período auditado e bloqueado pode ser reaberto.';
      END IF;
      v_to_status := 'closed_pending_audit';
      v_event_type := 'reopened';

      UPDATE public.class_scoring_periods
      SET
        status = v_to_status,
        locked_at = NULL,
        locked_by = NULL,
        reopen_count = class_scoring_periods.reopen_count + 1,
        version = class_scoring_periods.version + 1,
        updated_at = NOW()
      WHERE id = p_period_id
      RETURNING * INTO v_period;

    ELSE
      RAISE EXCEPTION 'Transição de período inválida.';
  END CASE;

  INSERT INTO public.class_scoring_period_lifecycle (
    period_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    actor_name,
    reason
  )
  VALUES (
    p_period_id,
    v_event_type,
    v_from_status,
    v_to_status,
    v_user_id,
    COALESCE(v_actor_name, 'Professor não identificado'),
    v_reason
  );

  IF p_action = 'reopen' THEN
    INSERT INTO public.class_scoring_period_annotations (
      period_id,
      annotation_type,
      body,
      actor_user_id,
      actor_name
    )
    VALUES (
      p_period_id,
      'reopen_reason',
      v_reason,
      v_user_id,
      COALESCE(v_actor_name, 'Professor não identificado')
    );
  END IF;

  RETURN QUERY SELECT v_period.id, v_period.status, v_period.version;
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_scoring_period_finding_impl(
  p_finding_id UUID,
  p_resolution_reason TEXT,
  p_accept_as_exception BOOLEAN
)
RETURNS TABLE (
  finding_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_actor_name TEXT;
  v_finding public.class_scoring_period_findings%ROWTYPE;
  v_period_id UUID;
  v_period_status TEXT;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_resolution_reason, '')), '');
  v_status TEXT := CASE WHEN p_accept_as_exception THEN 'accepted' ELSE 'resolved' END;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF v_reason IS NULL OR CHAR_LENGTH(v_reason) < 10 THEN
    RAISE EXCEPTION 'Informe uma justificativa com pelo menos 10 caracteres.';
  END IF;

  SELECT findings.period_id
  INTO v_period_id
  FROM public.class_scoring_period_findings
    AS findings
  WHERE findings.id = p_finding_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achado de auditoria não encontrado.';
  END IF;

  SELECT periods.status
  INTO v_period_status
  FROM public.class_scoring_periods AS periods
  WHERE periods.id = v_period_id
  FOR UPDATE;

  IF v_period_status NOT IN ('closed_pending_audit', 'audit_in_progress') THEN
    RAISE EXCEPTION 'Achados só podem ser decididos durante o fechamento ou a auditoria do trimestre.';
  END IF;

  SELECT *
  INTO v_finding
  FROM public.class_scoring_period_findings
  WHERE id = p_finding_id
    AND period_id = v_period_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achado de auditoria não encontrado.';
  END IF;

  IF v_finding.is_current <> TRUE THEN
    RAISE EXCEPTION 'O achado foi supersedido e está disponível apenas como histórico.';
  END IF;

  IF v_finding.status <> 'open' THEN
    RAISE EXCEPTION 'O achado já possui uma decisão registrada.';
  END IF;

  IF NOT private.is_scoring_period_owner(v_finding.period_id) THEN
    RAISE EXCEPTION 'Somente o proprietário da classe pode resolver ou aceitar um achado de auditoria.';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(full_name), ''), email, 'Professor não identificado')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = v_user_id;

  UPDATE public.class_scoring_period_findings
  SET
    status = v_status,
    resolved_at = NOW(),
    resolved_by = v_user_id,
    resolution_reason = v_reason
  WHERE id = p_finding_id;

  INSERT INTO public.class_scoring_period_annotations (
    period_id,
    finding_id,
    annotation_type,
    body,
    actor_user_id,
    actor_name
  )
  VALUES (
    v_finding.period_id,
    v_finding.id,
    CASE WHEN p_accept_as_exception THEN 'exception' ELSE 'decision' END,
    v_reason,
    v_user_id,
    COALESCE(v_actor_name, 'Professor não identificado')
  );

  RETURN QUERY SELECT v_finding.id, v_status;
END;
$$;

CREATE OR REPLACE FUNCTION private.add_scoring_period_annotation_impl(
  p_period_id UUID,
  p_finding_id UUID,
  p_annotation_type TEXT,
  p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_actor_name TEXT;
  v_annotation_id UUID;
  v_body TEXT := NULLIF(BTRIM(COALESCE(p_body, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT private.is_scoring_period_teacher(p_period_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  IF p_annotation_type NOT IN ('note', 'decision', 'exception', 'reopen_reason') THEN
    RAISE EXCEPTION 'Tipo de anotação inválido.';
  END IF;

  IF v_body IS NULL THEN
    RAISE EXCEPTION 'Informe o conteúdo da anotação.';
  END IF;

  IF p_annotation_type IN ('decision', 'exception', 'reopen_reason')
     AND CHAR_LENGTH(v_body) < 10 THEN
    RAISE EXCEPTION 'Informe uma justificativa com pelo menos 10 caracteres.';
  END IF;

  IF p_finding_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.class_scoring_period_findings
    WHERE id = p_finding_id
      AND period_id = p_period_id
  ) THEN
    RAISE EXCEPTION 'O achado não pertence ao período informado.';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(full_name), ''), email, 'Professor não identificado')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = v_user_id;

  INSERT INTO public.class_scoring_period_annotations (
    period_id,
    finding_id,
    annotation_type,
    body,
    actor_user_id,
    actor_name
  )
  VALUES (
    p_period_id,
    p_finding_id,
    p_annotation_type,
    v_body,
    v_user_id,
    COALESCE(v_actor_name, 'Professor não identificado')
  )
  RETURNING id INTO v_annotation_id;

  RETURN v_annotation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_class_scoring_period(
  p_class_id UUID,
  p_term_id UUID,
  p_reason TEXT
)
RETURNS TABLE (period_id UUID, status TEXT, version INTEGER)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT *
  FROM private.open_class_scoring_period_impl(p_class_id, p_term_id, p_reason);
$$;

CREATE OR REPLACE FUNCTION public.close_scoring_period(
  p_period_id UUID,
  p_reason TEXT
)
RETURNS TABLE (period_id UUID, status TEXT, version INTEGER)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT * FROM private.transition_scoring_period_impl(p_period_id, 'close', p_reason);
$$;

CREATE OR REPLACE FUNCTION public.begin_scoring_period_audit(
  p_period_id UUID,
  p_reason TEXT
)
RETURNS TABLE (period_id UUID, status TEXT, version INTEGER)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT * FROM private.transition_scoring_period_impl(p_period_id, 'begin_audit', p_reason);
$$;

CREATE OR REPLACE FUNCTION public.approve_scoring_period_audit(
  p_period_id UUID,
  p_reason TEXT
)
RETURNS TABLE (period_id UUID, status TEXT, version INTEGER)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT * FROM private.transition_scoring_period_impl(p_period_id, 'approve_audit', p_reason);
$$;

CREATE OR REPLACE FUNCTION public.reopen_scoring_period(
  p_period_id UUID,
  p_reason TEXT
)
RETURNS TABLE (period_id UUID, status TEXT, version INTEGER)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT * FROM private.transition_scoring_period_impl(p_period_id, 'reopen', p_reason);
$$;

CREATE OR REPLACE FUNCTION public.resolve_scoring_period_finding(
  p_finding_id UUID,
  p_resolution_reason TEXT,
  p_accept_as_exception BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (finding_id UUID, status TEXT)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT *
  FROM private.resolve_scoring_period_finding_impl(
    p_finding_id,
    p_resolution_reason,
    p_accept_as_exception
  );
$$;

CREATE OR REPLACE FUNCTION public.add_scoring_period_annotation(
  p_period_id UUID,
  p_finding_id UUID,
  p_annotation_type TEXT,
  p_body TEXT
)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.add_scoring_period_annotation_impl(
    p_period_id,
    p_finding_id,
    p_annotation_type,
    p_body
  );
$$;

-- ---------------------------------------------------------------------------
-- Period-aware attendance scoring. p_rule_ids accepts period-rule IDs and,
-- for the legacy wrapper, source class-rule IDs. New selections normalize to
-- declared rules. A legacy_observed variant is accepted only when that exact
-- period-rule is already stored for the same student and Saturday.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.save_student_attendance_record_v2_impl(
  p_class_id UUID,
  p_day_date DATE,
  p_student_id UUID,
  p_rule_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_extra_activity_points INTEGER DEFAULT 0,
  p_discipline_events JSONB DEFAULT '[]'::JSONB,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  record_id UUID,
  total_points INTEGER,
  period_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_teacher_name TEXT;
  v_period_id UUID;
  v_period_status TEXT;
  v_period_match_count INTEGER;
  v_day_id UUID;
  v_day_period_id UUID;
  v_existing_record_id UUID;
  v_existing_total_points INTEGER;
  v_existing_extra_points INTEGER;
  v_existing_penalty_points INTEGER;
  v_existing_component_signature TEXT;
  v_submitted_component_signature TEXT;
  v_components_unchanged BOOLEAN := FALSE;
  v_inputs_unchanged BOOLEAN := FALSE;
  v_write_total_points INTEGER;
  v_record_id UUID;
  v_total_points INTEGER;
  v_unique_rule_ids UUID[];
  v_requested_rule_count INTEGER := 0;
  v_matched_rule_count INTEGER := 0;
  v_base_points INTEGER := 0;
  v_extra_points INTEGER := GREATEST(0, COALESCE(p_extra_activity_points, 0));
  v_penalty_points INTEGER := 0;
  v_max_extra_points CONSTANT INTEGER := 20;
  v_latest_discipline_reason TEXT;
  v_latest_discipline_applied_by UUID;
  v_latest_discipline_applied_by_name TEXT;
  v_change_reason TEXT := NULLIF(BTRIM(COALESCE(p_change_reason, '')), '');
  v_request_id UUID := gen_random_uuid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(profiles.full_name), ''), profiles.email, 'Professor não identificado')
  INTO v_teacher_name
  FROM public.profiles
  JOIN public.class_members
    ON class_members.user_id = profiles.id
  WHERE profiles.id = v_user_id
    AND profiles.role = 'teacher'
    AND class_members.class_id = p_class_id
    AND class_members.is_active = TRUE;

  IF v_teacher_name IS NULL THEN
    RAISE EXCEPTION 'Professor não pertence à classe informada.';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_period_match_count
  FROM public.class_scoring_periods AS periods
  JOIN public.academic_terms AS terms
    ON terms.id = periods.term_id
  JOIN public.academic_term_saturdays AS saturdays
    ON saturdays.term_id = terms.id
   AND saturdays.saturday_date = p_day_date
  WHERE periods.class_id = p_class_id
    AND p_day_date BETWEEN terms.start_date AND terms.end_date;

  IF v_period_match_count = 0 THEN
    RAISE EXCEPTION 'A data não pertence a um trimestre configurado para a classe.';
  END IF;

  IF v_period_match_count > 1 THEN
    RAISE EXCEPTION 'A data pertence a mais de um trimestre da classe.';
  END IF;

  SELECT periods.id, periods.status
  INTO v_period_id, v_period_status
  FROM public.class_scoring_periods AS periods
  JOIN public.academic_terms AS terms
    ON terms.id = periods.term_id
  JOIN public.academic_term_saturdays AS saturdays
    ON saturdays.term_id = terms.id
   AND saturdays.saturday_date = p_day_date
  WHERE periods.class_id = p_class_id
    AND p_day_date BETWEEN terms.start_date AND terms.end_date
  FOR UPDATE OF periods;

  IF v_period_status NOT IN ('open', 'closed_pending_audit', 'audit_in_progress') THEN
    IF v_period_status = 'audited_locked' THEN
      RAISE EXCEPTION 'O trimestre foi auditado e está bloqueado para alterações.';
    END IF;
    RAISE EXCEPTION 'O trimestre ainda não está aberto para lançamentos.';
  END IF;

  IF v_period_status IN ('closed_pending_audit', 'audit_in_progress')
     AND (
       v_change_reason IS NULL
       OR CHAR_LENGTH(v_change_reason) < 10
       OR LOWER(v_change_reason) IN (
         LOWER('Pontuação salva sem motivo informado.'),
         LOWER('Lançamento regular da pontuação semanal.')
       )
     ) THEN
    RAISE EXCEPTION 'Informe um motivo específico para corrigir a pontuação de um trimestre fechado.';
  END IF;

  v_change_reason := COALESCE(
    v_change_reason,
    'Lançamento regular da pontuação semanal.'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_scoring_period_students AS participants
    WHERE participants.period_id = v_period_id
      AND participants.student_id = p_student_id
      AND participants.status <> 'excluded'
      AND (
        participants.joined_on IS NULL
        OR p_day_date >= participants.joined_on
      )
      AND (
        participants.left_on IS NULL
        OR p_day_date < participants.left_on
      )
  ) THEN
    RAISE EXCEPTION 'Aluno não pertence ao roster do trimestre na data informada.';
  END IF;

  IF v_extra_points > v_max_extra_points THEN
    RAISE EXCEPTION 'Pontuação extra acima do limite permitido.';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT submitted_rule_id), ARRAY[]::UUID[])
  INTO v_unique_rule_ids
  FROM unnest(COALESCE(p_rule_ids, ARRAY[]::UUID[])) AS submitted_rule_id
  WHERE submitted_rule_id IS NOT NULL;

  v_requested_rule_count := COALESCE(array_length(v_unique_rule_ids, 1), 0);

  DROP TABLE IF EXISTS pg_temp._selected_scoring_period_rules;

  CREATE TEMP TABLE _selected_scoring_period_rules ON COMMIT DROP AS
  SELECT DISTINCT
    selected.period_rule_id,
    selected.source_rule_id,
    selected.points,
    selected.display_order,
    selected.name
  FROM unnest(v_unique_rule_ids) AS submitted(submitted_rule_id)
  CROSS JOIN LATERAL (
    SELECT
      period_rules.id AS period_rule_id,
      period_rules.source_rule_id,
      period_rules.points,
      period_rules.display_order,
      period_rules.name
    FROM public.class_scoring_period_rules AS period_rules
    WHERE period_rules.period_id = v_period_id
      AND (
        (
          period_rules.variant_kind = 'declared'
          AND period_rules.is_active = TRUE
          AND (
            period_rules.id = submitted.submitted_rule_id
            OR period_rules.source_rule_id = submitted.submitted_rule_id
          )
        )
        OR (
          period_rules.variant_kind = 'legacy_observed'
          AND (
            period_rules.id = submitted.submitted_rule_id
            OR period_rules.source_rule_id = submitted.submitted_rule_id
          )
          AND EXISTS (
            SELECT 1
            FROM public.attendance_scores AS existing_scores
            JOIN public.attendance_days AS existing_days
              ON existing_days.id = existing_scores.day_id
            WHERE existing_scores.period_rule_id = period_rules.id
              AND existing_scores.student_id = p_student_id
              AND existing_days.class_id = p_class_id
              AND existing_days.day_date = p_day_date
          )
        )
      )
    ORDER BY
      CASE
        WHEN period_rules.variant_kind = 'legacy_observed' THEN 0
        WHEN period_rules.id = submitted.submitted_rule_id THEN 1
        ELSE 2
      END
    LIMIT 1
  ) AS selected;

  SELECT COUNT(*)::INTEGER, COALESCE(SUM(points), 0)::INTEGER
  INTO v_matched_rule_count, v_base_points
  FROM pg_temp._selected_scoring_period_rules;

  IF v_matched_rule_count <> v_requested_rule_count THEN
    RAISE EXCEPTION 'Critério de pontuação inválido ou duplicado para este trimestre.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp._selected_scoring_period_rules
    WHERE source_rule_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Critério do trimestre perdeu o vínculo com a regra de origem.';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM pg_temp._selected_scoring_period_rules
  ) <> (
    SELECT COUNT(DISTINCT source_rule_id)
    FROM pg_temp._selected_scoring_period_rules
  ) THEN
    RAISE EXCEPTION 'Selecione apenas uma variante de cada critério de pontuação.';
  END IF;

  IF p_discipline_events IS NULL THEN
    p_discipline_events := '[]'::JSONB;
  END IF;

  IF jsonb_typeof(p_discipline_events) <> 'array' THEN
    RAISE EXCEPTION 'Eventos de indisciplina inválidos.';
  END IF;

  DROP TABLE IF EXISTS pg_temp._submitted_scoring_discipline_events;

  CREATE TEMP TABLE _submitted_scoring_discipline_events ON COMMIT DROP AS
  SELECT
    CASE
      WHEN NULLIF(BTRIM(event->>'id'), '') IS NULL THEN NULL::UUID
      ELSE (event->>'id')::UUID
    END AS id,
    GREATEST(
      1,
      CASE
        WHEN COALESCE(event->>'points', '') ~ '^-?[0-9]+$' THEN (event->>'points')::INTEGER
        ELSE 1
      END
    ) AS points,
    BTRIM(COALESCE(event->>'reason', '')) AS reason,
    ordinality::INTEGER AS ordinality
  FROM jsonb_array_elements(p_discipline_events) WITH ORDINALITY AS parsed(event, ordinality);

  IF EXISTS (
    SELECT 1
    FROM pg_temp._submitted_scoring_discipline_events
    WHERE reason = ''
  ) THEN
    RAISE EXCEPTION 'Informe o motivo do desconto por indisciplina.';
  END IF;

  SELECT COALESCE(SUM(points), 0)::INTEGER
  INTO v_penalty_points
  FROM pg_temp._submitted_scoring_discipline_events;

  IF v_penalty_points > (v_base_points + v_extra_points) THEN
    RAISE EXCEPTION 'Os eventos de indisciplina excedem a pontuação disponível do aluno.';
  END IF;

  SELECT days.id, days.period_id
  INTO v_day_id, v_day_period_id
  FROM public.attendance_days AS days
  WHERE days.class_id = p_class_id
    AND days.day_date = p_day_date
  FOR UPDATE;

  IF v_day_id IS NULL THEN
    INSERT INTO public.attendance_days (class_id, day_date, period_id)
    VALUES (p_class_id, p_day_date, v_period_id)
    ON CONFLICT (class_id, day_date) DO NOTHING
    RETURNING attendance_days.id, attendance_days.period_id
    INTO v_day_id, v_day_period_id;

    IF v_day_id IS NULL THEN
      SELECT days.id, days.period_id
      INTO v_day_id, v_day_period_id
      FROM public.attendance_days AS days
      WHERE days.class_id = p_class_id
        AND days.day_date = p_day_date
      FOR UPDATE;
    END IF;
  END IF;

  IF v_day_period_id IS NULL THEN
    UPDATE public.attendance_days
    SET period_id = v_period_id
    WHERE id = v_day_id
    RETURNING attendance_days.period_id INTO v_day_period_id;
  END IF;

  IF v_day_period_id <> v_period_id THEN
    RAISE EXCEPTION 'O sábado já pertence a outro trimestre da classe.';
  END IF;

  SELECT
    records.id,
    records.total_points,
    records.extra_activity_points,
    records.discipline_penalty_points
  INTO
    v_existing_record_id,
    v_existing_total_points,
    v_existing_extra_points,
    v_existing_penalty_points
  FROM public.student_attendance_records
    AS records
  WHERE records.day_id = v_day_id
    AND records.student_id = p_student_id;

  SELECT md5(COALESCE(string_agg(
    CONCAT_WS(
      ':',
      COALESCE(scores.period_rule_id::TEXT, 'unlinked'),
      scores.rule_id::TEXT,
      scores.points_earned::TEXT
    ),
    '|' ORDER BY scores.rule_id, scores.period_rule_id, scores.points_earned
  ), ''))
  INTO v_existing_component_signature
  FROM public.attendance_scores AS scores
  WHERE scores.day_id = v_day_id
    AND scores.student_id = p_student_id;

  SELECT md5(COALESCE(string_agg(
    CONCAT_WS(
      ':',
      selected.period_rule_id::TEXT,
      selected.source_rule_id::TEXT,
      selected.points::TEXT
    ),
    '|' ORDER BY selected.source_rule_id, selected.period_rule_id, selected.points
  ), ''))
  INTO v_submitted_component_signature
  FROM pg_temp._selected_scoring_period_rules AS selected;

  v_components_unchanged := v_existing_record_id IS NOT NULL
    AND v_existing_component_signature = v_submitted_component_signature;

  v_inputs_unchanged := v_components_unchanged
    AND v_existing_extra_points = v_extra_points
    AND v_existing_penalty_points = v_penalty_points
  ;

  v_write_total_points := CASE
    WHEN v_inputs_unchanged THEN v_existing_total_points
    ELSE v_base_points + v_extra_points - v_penalty_points
  END;

  IF EXISTS (
    SELECT 1
    FROM pg_temp._submitted_scoring_discipline_events AS submitted
    WHERE submitted.id IS NOT NULL
      AND (
        v_existing_record_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM public.attendance_discipline_events AS existing
          WHERE existing.id = submitted.id
            AND existing.record_id = v_existing_record_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Evento de indisciplina inválido para este registro.';
  END IF;

  SELECT
    submitted.reason,
    COALESCE(existing.applied_by, v_user_id),
    COALESCE(NULLIF(BTRIM(existing.applied_by_name), ''), v_teacher_name)
  INTO
    v_latest_discipline_reason,
    v_latest_discipline_applied_by,
    v_latest_discipline_applied_by_name
  FROM pg_temp._submitted_scoring_discipline_events AS submitted
  LEFT JOIN public.attendance_discipline_events AS existing
    ON existing.id = submitted.id
   AND existing.record_id = v_existing_record_id
  ORDER BY submitted.ordinality DESC
  LIMIT 1;

  PERFORM set_config('app.scoring_change_reason', v_change_reason, TRUE);
  PERFORM set_config('app.scoring_change_source', 'save_student_attendance_record_v2', TRUE);
  PERFORM set_config('app.scoring_change_request_id', v_request_id::TEXT, TRUE);
  PERFORM set_config(
    'app.scoring_change_metadata',
    jsonb_build_object(
      'period_id', v_period_id,
      'class_id', p_class_id,
      'day_date', p_day_date,
      'student_id', p_student_id,
      'is_update', v_existing_record_id IS NOT NULL,
      'preserved_existing_total', v_inputs_unchanged
    )::TEXT,
    TRUE
  );

  INSERT INTO public.student_attendance_records (
    day_id,
    class_id,
    student_id,
    total_points,
    extra_activity_points,
    discipline_penalty_points,
    discipline_penalty_reason,
    discipline_penalty_applied_by,
    discipline_penalty_applied_by_name,
    saved_by
  )
  VALUES (
    v_day_id,
    p_class_id,
    p_student_id,
    v_write_total_points,
    v_extra_points,
    v_penalty_points,
    v_latest_discipline_reason,
    v_latest_discipline_applied_by,
    v_latest_discipline_applied_by_name,
    v_user_id
  )
  ON CONFLICT (day_id, student_id) DO UPDATE SET
    class_id = EXCLUDED.class_id,
    total_points = EXCLUDED.total_points,
    extra_activity_points = EXCLUDED.extra_activity_points,
    discipline_penalty_points = EXCLUDED.discipline_penalty_points,
    discipline_penalty_reason = EXCLUDED.discipline_penalty_reason,
    discipline_penalty_applied_by = EXCLUDED.discipline_penalty_applied_by,
    discipline_penalty_applied_by_name = EXCLUDED.discipline_penalty_applied_by_name,
    saved_by = EXCLUDED.saved_by,
    saved_at = NOW(),
    updated_at = NOW()
  RETURNING id, student_attendance_records.total_points
  INTO v_record_id, v_total_points;

  -- Apply a component diff instead of delete/reinsert. Unchanged score IDs stay
  -- stable, so audit findings that point to those rows remain valid and a
  -- reason/extra-only correction does not create false score audit events.
  DELETE FROM public.attendance_scores AS existing
  WHERE existing.day_id = v_day_id
    AND existing.student_id = p_student_id
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp._selected_scoring_period_rules AS selected
      WHERE selected.source_rule_id = existing.rule_id
    );

  UPDATE public.attendance_scores AS existing
  SET
    class_id = p_class_id,
    period_rule_id = selected.period_rule_id,
    points_earned = selected.points
  FROM pg_temp._selected_scoring_period_rules AS selected
  WHERE existing.day_id = v_day_id
    AND existing.student_id = p_student_id
    AND existing.rule_id = selected.source_rule_id
    AND (
      existing.class_id IS DISTINCT FROM p_class_id
      OR existing.period_rule_id IS DISTINCT FROM selected.period_rule_id
      OR existing.points_earned IS DISTINCT FROM selected.points
    );

  INSERT INTO public.attendance_scores (
    day_id,
    class_id,
    student_id,
    rule_id,
    period_rule_id,
    points_earned
  )
  SELECT
    v_day_id,
    p_class_id,
    p_student_id,
    selected.source_rule_id,
    selected.period_rule_id,
    selected.points
  FROM pg_temp._selected_scoring_period_rules AS selected
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.attendance_scores AS existing
    WHERE existing.day_id = v_day_id
      AND existing.student_id = p_student_id
      AND existing.rule_id = selected.source_rule_id
  )
  ORDER BY selected.display_order, selected.name, selected.period_rule_id;

  DELETE FROM public.attendance_discipline_events AS existing
  WHERE existing.record_id = v_record_id
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp._submitted_scoring_discipline_events AS submitted
      WHERE submitted.id = existing.id
    );

  UPDATE public.attendance_discipline_events AS existing
  SET
    day_id = v_day_id,
    class_id = p_class_id,
    student_id = p_student_id,
    points = submitted.points,
    reason = submitted.reason,
    applied_by = COALESCE(existing.applied_by, v_user_id),
    applied_by_name = COALESCE(NULLIF(BTRIM(existing.applied_by_name), ''), v_teacher_name)
  FROM pg_temp._submitted_scoring_discipline_events AS submitted
  WHERE submitted.id = existing.id
    AND existing.record_id = v_record_id;

  INSERT INTO public.attendance_discipline_events (
    record_id,
    day_id,
    class_id,
    student_id,
    points,
    reason,
    applied_by,
    applied_by_name
  )
  SELECT
    v_record_id,
    v_day_id,
    p_class_id,
    p_student_id,
    submitted.points,
    submitted.reason,
    v_user_id,
    v_teacher_name
  FROM pg_temp._submitted_scoring_discipline_events AS submitted
  WHERE submitted.id IS NULL;

  RETURN QUERY SELECT v_record_id, v_total_points, v_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_student_attendance_record_v2(
  p_class_id UUID,
  p_day_date DATE,
  p_student_id UUID,
  p_rule_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_extra_activity_points INTEGER DEFAULT 0,
  p_discipline_events JSONB DEFAULT '[]'::JSONB,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  record_id UUID,
  total_points INTEGER,
  period_id UUID
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT *
  FROM private.save_student_attendance_record_v2_impl(
    p_class_id,
    p_day_date,
    p_student_id,
    p_rule_ids,
    p_extra_activity_points,
    p_discipline_events,
    p_change_reason
  );
$$;

-- Backwards-compatible signature used by the current application. All writes
-- now pass through the period-aware implementation and its lock checks.
CREATE OR REPLACE FUNCTION public.save_student_attendance_record(
  p_class_id UUID,
  p_day_date DATE,
  p_student_id UUID,
  p_rule_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_extra_activity_points INTEGER DEFAULT 0,
  p_discipline_events JSONB DEFAULT '[]'::JSONB,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  record_id UUID,
  total_points INTEGER
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT saved.record_id, saved.total_points
  FROM private.save_student_attendance_record_v2_impl(
    p_class_id,
    p_day_date,
    p_student_id,
    p_rule_ids,
    p_extra_activity_points,
    p_discipline_events,
    p_change_reason
  ) AS saved;
$$;

CREATE OR REPLACE FUNCTION private.save_attendance_day_offering_impl(
  p_class_id UUID,
  p_day_date DATE,
  p_amount NUMERIC,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  day_id UUID,
  period_id UUID,
  amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_period_id UUID;
  v_period_status TEXT;
  v_period_match_count INTEGER;
  v_day_id UUID;
  v_day_period_id UUID;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_change_reason, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Informe um valor de oferta válido.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_members
    JOIN public.profiles
      ON profiles.id = class_members.user_id
    WHERE class_members.class_id = p_class_id
      AND class_members.user_id = v_user_id
      AND class_members.is_active = TRUE
      AND profiles.role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'Professor não pertence à classe informada.';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_period_match_count
  FROM public.class_scoring_periods AS periods
  JOIN public.academic_terms AS terms
    ON terms.id = periods.term_id
  JOIN public.academic_term_saturdays AS saturdays
    ON saturdays.term_id = terms.id
   AND saturdays.saturday_date = p_day_date
  WHERE periods.class_id = p_class_id
    AND p_day_date BETWEEN terms.start_date AND terms.end_date;

  IF v_period_match_count <> 1 THEN
    RAISE EXCEPTION 'A data não resolve um único trimestre da classe.';
  END IF;

  SELECT periods.id, periods.status
  INTO v_period_id, v_period_status
  FROM public.class_scoring_periods AS periods
  JOIN public.academic_terms AS terms
    ON terms.id = periods.term_id
  JOIN public.academic_term_saturdays AS saturdays
    ON saturdays.term_id = terms.id
   AND saturdays.saturday_date = p_day_date
  WHERE periods.class_id = p_class_id
    AND p_day_date BETWEEN terms.start_date AND terms.end_date
  FOR UPDATE OF periods;

  IF v_period_status = 'audited_locked' THEN
    RAISE EXCEPTION 'O trimestre foi auditado e está bloqueado para alterações.';
  END IF;

  IF v_period_status = 'draft' THEN
    RAISE EXCEPTION 'O trimestre ainda não está aberto para lançamentos.';
  END IF;

  IF v_period_status IN ('closed_pending_audit', 'audit_in_progress')
     AND (
       v_reason IS NULL
       OR CHAR_LENGTH(v_reason) < 10
       OR LOWER(v_reason) = LOWER('Lançamento regular da oferta semanal.')
     ) THEN
    RAISE EXCEPTION 'Informe o motivo da correção de oferta em período fechado.';
  END IF;

  v_reason := COALESCE(v_reason, 'Lançamento regular da oferta semanal.');
  PERFORM set_config('app.scoring_change_reason', v_reason, TRUE);
  PERFORM set_config('app.scoring_change_source', 'save_attendance_day_offering', TRUE);

  SELECT days.id, days.period_id
  INTO v_day_id, v_day_period_id
  FROM public.attendance_days AS days
  WHERE days.class_id = p_class_id
    AND days.day_date = p_day_date
  FOR UPDATE;

  IF v_day_id IS NULL THEN
    INSERT INTO public.attendance_days (
      class_id,
      day_date,
      period_id,
      total_offering
    )
    VALUES (
      p_class_id,
      p_day_date,
      v_period_id,
      p_amount
    )
    ON CONFLICT (class_id, day_date) DO NOTHING
    RETURNING id, attendance_days.period_id
    INTO v_day_id, v_day_period_id;

    IF v_day_id IS NULL THEN
      SELECT days.id, days.period_id
      INTO v_day_id, v_day_period_id
      FROM public.attendance_days AS days
      WHERE days.class_id = p_class_id
        AND days.day_date = p_day_date
      FOR UPDATE;
    END IF;
  END IF;

  IF v_day_period_id IS NULL THEN
    UPDATE public.attendance_days
    SET period_id = v_period_id
    WHERE id = v_day_id
    RETURNING attendance_days.period_id INTO v_day_period_id;
  END IF;

  IF v_day_period_id <> v_period_id THEN
    RAISE EXCEPTION 'O sábado já pertence a outro trimestre da classe.';
  END IF;

  UPDATE public.attendance_days
  SET total_offering = p_amount
  WHERE id = v_day_id;

  INSERT INTO public.class_scoring_period_annotations (
    period_id,
    annotation_type,
    body,
    actor_user_id,
    actor_name
  )
  SELECT
    v_period_id,
    'note',
    v_reason,
    v_user_id,
    COALESCE(NULLIF(BTRIM(profiles.full_name), ''), profiles.email, 'Professor não identificado')
  FROM public.profiles
  WHERE profiles.id = v_user_id;

  RETURN QUERY SELECT v_day_id, v_period_id, p_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_attendance_day_offering(
  p_class_id UUID,
  p_day_date DATE,
  p_amount NUMERIC,
  p_change_reason TEXT DEFAULT NULL
)
RETURNS TABLE (day_id UUID, period_id UUID, amount NUMERIC)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT *
  FROM private.save_attendance_day_offering_impl(
    p_class_id,
    p_day_date,
    p_amount,
    p_change_reason
  );
$$;

-- ---------------------------------------------------------------------------
-- Guardian read RPCs resolve the open period first and otherwise the most
-- recent period containing the student. Existing signatures remain compatible
-- while explicit *_for_period variants avoid PostgREST overload ambiguity.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.resolve_guardian_scoring_period(
  p_student_id UUID,
  p_period_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_period_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.guardian_students
    WHERE guardian_id = auth.uid()
      AND student_id = p_student_id
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_period_id IS NOT NULL THEN
    SELECT periods.id
    INTO v_period_id
    FROM public.class_scoring_periods AS periods
    JOIN public.class_scoring_period_students AS participants
      ON participants.period_id = periods.id
    WHERE periods.id = p_period_id
      AND participants.student_id = p_student_id
      AND participants.status <> 'excluded';
  ELSE
    SELECT periods.id
    INTO v_period_id
    FROM public.class_scoring_periods AS periods
    JOIN public.academic_terms AS terms
      ON terms.id = periods.term_id
    JOIN public.class_scoring_period_students AS participants
      ON participants.period_id = periods.id
    LEFT JOIN public.students
      ON students.id = participants.student_id
    WHERE participants.student_id = p_student_id
      AND participants.status <> 'excluded'
    ORDER BY
      CASE
        WHEN participants.status = 'active'
          AND private.current_sao_paulo_date()
            BETWEEN terms.start_date AND terms.end_date
          AND (
            participants.joined_on IS NULL
            OR participants.joined_on <= private.current_sao_paulo_date()
          )
          AND (
            participants.left_on IS NULL
            OR participants.left_on > private.current_sao_paulo_date()
          ) THEN 0
        ELSE 1
      END,
      CASE WHEN periods.class_id = students.class_id THEN 0 ELSE 1 END,
      CASE WHEN periods.status = 'open' THEN 0 ELSE 1 END,
      terms.start_date DESC,
      periods.id
    LIMIT 1;
  END IF;

  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'Período do aluno não encontrado.';
  END IF;

  RETURN v_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_guardian_student_progress_impl(
  p_student_id UUID,
  p_period_id UUID DEFAULT NULL
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  class_id UUID,
  class_name TEXT,
  day_date DATE,
  student_points INTEGER,
  class_average NUMERIC(10,2),
  class_highest INTEGER,
  class_size BIGINT,
  period_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_period_id UUID;
BEGIN
  v_period_id := private.resolve_guardian_scoring_period(p_student_id, p_period_id);

  RETURN QUERY
  WITH student_days AS (
    SELECT
      records.student_id,
      records.total_points,
      records.class_id,
      days.id AS day_id,
      days.day_date
    FROM public.student_attendance_records AS records
    JOIN public.attendance_days AS days
      ON days.id = records.day_id
    WHERE records.student_id = p_student_id
      AND days.period_id = v_period_id
  ), day_stats AS (
    SELECT
      student_days.day_id,
      AVG(records.total_points)::NUMERIC(10,2) AS class_average,
      MAX(records.total_points) AS class_highest,
      COUNT(records.student_id) AS class_size
    FROM student_days
    JOIN public.student_attendance_records AS records
      ON records.day_id = student_days.day_id
     AND records.class_id = student_days.class_id
    GROUP BY student_days.day_id
  )
  SELECT
    participants.student_id,
    participants.student_name_snapshot,
    student_days.class_id,
    classes.name,
    student_days.day_date,
    student_days.total_points,
    day_stats.class_average,
    day_stats.class_highest,
    day_stats.class_size,
    v_period_id
  FROM student_days
  JOIN public.class_scoring_period_students AS participants
    ON participants.period_id = v_period_id
   AND participants.student_id = student_days.student_id
  LEFT JOIN public.classes
    ON classes.id = student_days.class_id
  JOIN day_stats
    ON day_stats.day_id = student_days.day_id
  ORDER BY student_days.day_date ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_guardian_student_progress(p_student_id UUID)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  class_id UUID,
  class_name TEXT,
  day_date DATE,
  student_points INTEGER,
  class_average NUMERIC(10,2),
  class_highest INTEGER,
  class_size BIGINT
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, private
AS $$
  SELECT
    progress.student_id,
    progress.student_name,
    progress.class_id,
    progress.class_name,
    progress.day_date,
    progress.student_points,
    progress.class_average,
    progress.class_highest,
    progress.class_size
  FROM private.get_guardian_student_progress_impl(p_student_id, NULL) AS progress;
$$;

CREATE OR REPLACE FUNCTION public.get_guardian_student_progress_for_period(
  p_student_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  class_id UUID,
  class_name TEXT,
  day_date DATE,
  student_points INTEGER,
  class_average NUMERIC(10,2),
  class_highest INTEGER,
  class_size BIGINT,
  period_id UUID
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, private
AS $$
  SELECT *
  FROM private.get_guardian_student_progress_impl(p_student_id, p_period_id);
$$;

CREATE OR REPLACE FUNCTION private.get_guardian_class_offering_summary_impl(
  p_student_id UUID,
  p_period_id UUID DEFAULT NULL
)
RETURNS TABLE (
  class_id UUID,
  class_name TEXT,
  offering_goal NUMERIC,
  accumulated_offering NUMERIC,
  trimester_goal NUMERIC,
  period_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_period_id UUID;
BEGIN
  v_period_id := private.resolve_guardian_scoring_period(p_student_id, p_period_id);

  RETURN QUERY
  SELECT
    classes.id,
    classes.name,
    periods.offering_goal_snapshot,
    COALESCE(SUM(days.total_offering), 0),
    periods.offering_goal_snapshot * terms.expected_saturdays,
    periods.id
  FROM public.class_scoring_periods AS periods
  JOIN public.academic_terms AS terms
    ON terms.id = periods.term_id
  JOIN public.classes
    ON classes.id = periods.class_id
  LEFT JOIN public.attendance_days AS days
    ON days.period_id = periods.id
  WHERE periods.id = v_period_id
  GROUP BY
    classes.id,
    classes.name,
    periods.offering_goal_snapshot,
    terms.expected_saturdays,
    periods.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_guardian_class_offering_summary(p_student_id UUID)
RETURNS TABLE (
  class_id UUID,
  class_name TEXT,
  offering_goal NUMERIC,
  accumulated_offering NUMERIC,
  trimester_goal NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, private
AS $$
  SELECT
    summary.class_id,
    summary.class_name,
    summary.offering_goal,
    summary.accumulated_offering,
    summary.trimester_goal
  FROM private.get_guardian_class_offering_summary_impl(p_student_id, NULL) AS summary;
$$;

CREATE OR REPLACE FUNCTION public.get_guardian_class_offering_summary_for_period(
  p_student_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  class_id UUID,
  class_name TEXT,
  offering_goal NUMERIC,
  accumulated_offering NUMERIC,
  trimester_goal NUMERIC,
  period_id UUID
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, private
AS $$
  SELECT *
  FROM private.get_guardian_class_offering_summary_impl(p_student_id, p_period_id);
$$;

-- ---------------------------------------------------------------------------
-- Keep the mutable roster of an open period aligned with the canonical
-- students table. Historical periods are intentionally never selected here.
-- left_on is an exclusive boundary; a same-day join/leave therefore represents
-- an empty membership interval without deleting the period snapshot.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.bootstrap_class_scoring_periods()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active <> TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_active = TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.class_scoring_periods (
    class_id,
    term_id,
    status,
    offering_goal_snapshot,
    created_by
  )
  SELECT
    NEW.id,
    terms.id,
    'draft',
    0,
    auth.uid()
  FROM public.academic_terms AS terms
  WHERE terms.status IN ('planned', 'active')
    AND terms.end_date >= private.current_sao_paulo_date()
  ON CONFLICT (class_id, term_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_class_scoring_periods
  ON public.classes;
CREATE TRIGGER bootstrap_class_scoring_periods
  AFTER INSERT OR UPDATE OF is_active
  ON public.classes
  FOR EACH ROW EXECUTE FUNCTION private.bootstrap_class_scoring_periods();

-- Guardian registration is intentionally routed through
-- register_guardian_student(), which inserts an unassigned student and creates
-- a pending enrollment request. Neutralize older policy drift that allowed a
-- guardian to insert directly into an active class.
DROP POLICY IF EXISTS "students_insert_guardian" ON public.students;

CREATE OR REPLACE FUNCTION private.sync_open_scoring_period_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_name TEXT;
  v_reason TEXT := NULLIF(
    BTRIM(COALESCE(current_setting('app.scoring_roster_change_reason', TRUE), '')),
    ''
  );
  v_skip_target BOOLEAN := COALESCE(
    NULLIF(current_setting('app.scoring_roster_skip_target_period', TRUE), '')::BOOLEAN,
    FALSE
  );
  v_forced_target_period_id UUID := NULLIF(
    current_setting('app.scoring_roster_target_period_id', TRUE),
    ''
  )::UUID;
  v_source_period_id UUID;
  v_source_term_id UUID;
  v_source_start_date DATE;
  v_target_period_id UUID;
  v_target_start_date DATE;
  v_target_end_date DATE;
  v_is_leaving BOOLEAN := FALSE;
  v_is_entering BOOLEAN := FALSE;
  v_membership_class_id UUID;
  v_is_privileged_backend BOOLEAN := COALESCE(
    current_setting('request.jwt.claim.role', TRUE) = 'service_role',
    FALSE
  ) OR (
    session_user IN ('postgres', 'supabase_admin')
    AND NULLIF(current_setting('request.jwt.claim.role', TRUE), '') IS NULL
  );
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.class_id IS NOT NULL
       AND NOT v_is_privileged_backend
       AND NOT EXISTS (
         SELECT 1
         FROM public.class_members
         JOIN public.profiles
           ON profiles.id = class_members.user_id
         WHERE class_members.class_id = NEW.class_id
           AND class_members.user_id = v_actor_id
           AND class_members.is_active = TRUE
           AND profiles.role = 'teacher'
       ) THEN
      RAISE EXCEPTION 'Somente um professor da turma pode cadastrar o aluno diretamente nela.';
    END IF;

    v_is_entering := NEW.is_active = TRUE AND NEW.class_id IS NOT NULL;
  ELSE
    IF (
      NEW.class_id IS DISTINCT FROM OLD.class_id
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
    ) AND NOT v_is_privileged_backend THEN
      IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Somente um professor autorizado pode alterar turma ou situação do aluno.';
      END IF;

      IF OLD.class_id IS NOT NULL
         AND NEW.class_id IS NOT NULL
         AND NEW.class_id IS DISTINCT FROM OLD.class_id THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.class_members AS source_members
          JOIN public.class_members AS target_members
            ON target_members.user_id = source_members.user_id
          JOIN public.profiles
            ON profiles.id = source_members.user_id
          WHERE source_members.class_id = OLD.class_id
            AND target_members.class_id = NEW.class_id
            AND source_members.user_id = v_actor_id
            AND source_members.role = 'owner'
            AND target_members.role = 'owner'
            AND source_members.is_active = TRUE
            AND target_members.is_active = TRUE
            AND profiles.role = 'teacher'
        ) THEN
          RAISE EXCEPTION 'Somente o proprietário das duas turmas pode transferir o aluno.';
        END IF;
      ELSE
        v_membership_class_id := COALESCE(NEW.class_id, OLD.class_id);

        IF v_membership_class_id IS NULL THEN
          RAISE EXCEPTION 'Aluno sem turma só pode ter a situação alterada pelo fluxo administrativo.';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM public.class_members
          JOIN public.profiles
            ON profiles.id = class_members.user_id
          WHERE class_members.class_id = v_membership_class_id
            AND class_members.user_id = v_actor_id
            AND class_members.is_active = TRUE
            AND profiles.role = 'teacher'
        ) THEN
          RAISE EXCEPTION 'Somente um professor da turma pode alterar a situação do aluno.';
        END IF;
      END IF;
    END IF;

    v_is_leaving := OLD.is_active = TRUE
      AND OLD.class_id IS NOT NULL
      AND (
        NEW.is_active = FALSE
        OR NEW.class_id IS DISTINCT FROM OLD.class_id
      );
    v_is_entering := NEW.is_active = TRUE
      AND NEW.class_id IS NOT NULL
      AND (
        OLD.is_active = FALSE
        OR NEW.class_id IS DISTINCT FROM OLD.class_id
      );
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(profiles.full_name), ''), profiles.email, 'Sistema')
  INTO v_actor_name
  FROM public.profiles
  WHERE profiles.id = v_actor_id;

  v_actor_name := COALESCE(v_actor_name, 'Sistema');
  v_reason := COALESCE(
    v_reason,
    'Sincronização automática a partir do cadastro de alunos.'
  );

  IF v_is_leaving
     AND v_is_entering
     AND NEW.class_id IS DISTINCT FROM OLD.class_id THEN
    SELECT periods.id, periods.term_id
    INTO v_source_period_id, v_source_term_id
    FROM public.class_scoring_periods AS periods
    WHERE periods.class_id = OLD.class_id
      AND periods.status = 'open'
    FOR UPDATE;

    IF v_source_period_id IS NOT NULL THEN
      SELECT periods.id
      INTO v_target_period_id
      FROM public.class_scoring_periods AS periods
      WHERE periods.class_id = NEW.class_id
        AND periods.status = 'open'
        AND periods.term_id = v_source_term_id
      FOR UPDATE;

      IF v_target_period_id IS NULL THEN
        RAISE EXCEPTION 'A turma de destino precisa ter um período aberto no mesmo trimestre da origem.';
      END IF;

      v_forced_target_period_id := v_target_period_id;
    END IF;
  END IF;

  IF v_is_leaving THEN
    SELECT periods.id, terms.start_date
    INTO v_source_period_id, v_source_start_date
    FROM public.class_scoring_periods AS periods
    JOIN public.academic_terms AS terms
      ON terms.id = periods.term_id
    WHERE periods.class_id = OLD.class_id
      AND periods.status = 'open'
    FOR UPDATE OF periods;

    IF v_source_period_id IS NOT NULL THEN
      INSERT INTO public.class_scoring_period_students (
        period_id,
        class_id,
        student_id,
        student_name_snapshot,
        status,
        source,
        joined_on,
        left_on,
        created_by
      )
      VALUES (
        v_source_period_id,
        OLD.class_id,
        OLD.id,
        OLD.full_name,
        'inactive',
        'manual',
        v_source_start_date,
        GREATEST(v_source_start_date, private.current_sao_paulo_date()),
        v_actor_id
      )
      ON CONFLICT (period_id, student_id) WHERE student_id IS NOT NULL
      DO UPDATE SET
        student_name_snapshot = EXCLUDED.student_name_snapshot,
        status = 'inactive',
        left_on = GREATEST(
          COALESCE(
            class_scoring_period_students.joined_on,
            private.current_sao_paulo_date()
          ),
          private.current_sao_paulo_date()
        );

      INSERT INTO public.class_scoring_period_annotations (
        period_id,
        annotation_type,
        body,
        actor_user_id,
        actor_name
      )
      VALUES (
        v_source_period_id,
        'note',
        FORMAT(
          'Aluno %s (%s) saiu do roster ativo em %s (limite exclusivo). Motivo: %s',
          OLD.full_name,
          OLD.id,
          private.current_sao_paulo_date(),
          v_reason
        ),
        v_actor_id,
        v_actor_name
      );
    END IF;
  END IF;

  IF v_is_entering AND NOT v_skip_target THEN
    SELECT periods.id, terms.start_date, terms.end_date
    INTO v_target_period_id, v_target_start_date, v_target_end_date
    FROM public.class_scoring_periods AS periods
    JOIN public.academic_terms AS terms
      ON terms.id = periods.term_id
    WHERE periods.class_id = NEW.class_id
      AND periods.status = 'open'
      AND (
        v_forced_target_period_id IS NULL
        OR periods.id = v_forced_target_period_id
      )
    FOR UPDATE OF periods;

    IF v_target_period_id IS NOT NULL THEN
      INSERT INTO public.class_scoring_period_students (
        period_id,
        class_id,
        student_id,
        student_name_snapshot,
        status,
        source,
        joined_on,
        left_on,
        created_by
      )
      VALUES (
        v_target_period_id,
        NEW.class_id,
        NEW.id,
        NEW.full_name,
        'active',
        'manual',
        LEAST(
          v_target_end_date,
          GREATEST(v_target_start_date, private.current_sao_paulo_date())
        ),
        NULL,
        v_actor_id
      )
      ON CONFLICT (period_id, student_id) WHERE student_id IS NOT NULL
      DO UPDATE SET
        student_name_snapshot = EXCLUDED.student_name_snapshot,
        status = 'active',
        joined_on = EXCLUDED.joined_on,
        left_on = NULL;

      INSERT INTO public.class_scoring_period_annotations (
        period_id,
        annotation_type,
        body,
        actor_user_id,
        actor_name
      )
      VALUES (
        v_target_period_id,
        'note',
        FORMAT(
          'Aluno %s (%s) entrou no roster ativo em %s. Motivo: %s',
          NEW.full_name,
          NEW.id,
          LEAST(
            v_target_end_date,
            GREATEST(v_target_start_date, private.current_sao_paulo_date())
          ),
          v_reason
        ),
        v_actor_id,
        v_actor_name
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.full_name IS DISTINCT FROM OLD.full_name
     AND NEW.class_id IS NOT NULL
     AND NEW.is_active = TRUE THEN
    PERFORM 1
    FROM public.class_scoring_periods AS periods
    WHERE periods.class_id = NEW.class_id
      AND periods.status = 'open'
    ORDER BY periods.id
    FOR UPDATE;

    UPDATE public.class_scoring_period_students AS participants
    SET student_name_snapshot = NEW.full_name
    FROM public.class_scoring_periods AS periods
    WHERE participants.period_id = periods.id
      AND periods.class_id = NEW.class_id
      AND periods.status = 'open'
      AND participants.student_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_open_scoring_period_student
  ON public.students;
CREATE TRIGGER sync_open_scoring_period_student
  AFTER INSERT OR UPDATE OF class_id, is_active, full_name
  ON public.students
  FOR EACH ROW EXECUTE FUNCTION private.sync_open_scoring_period_student();

CREATE OR REPLACE FUNCTION private.move_active_students_to_class_impl(
  p_source_class_id UUID,
  p_target_class_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  v_source_period_id UUID;
  v_source_term_id UUID;
  v_target_period_id UUID;
  v_moved_count INTEGER := 0;
  v_previous_reason TEXT := current_setting('app.scoring_roster_change_reason', TRUE);
  v_previous_target_period_id TEXT := current_setting(
    'app.scoring_roster_target_period_id',
    TRUE
  );
  v_previous_skip_target TEXT := current_setting(
    'app.scoring_roster_skip_target_period',
    TRUE
  );
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_source_class_id IS NULL OR p_target_class_id IS NULL THEN
    RAISE EXCEPTION 'Informe as turmas de origem e destino.';
  END IF;

  IF p_source_class_id = p_target_class_id THEN
    RAISE EXCEPTION 'As turmas de origem e destino devem ser diferentes.';
  END IF;

  IF v_reason IS NULL OR CHAR_LENGTH(v_reason) < 10 THEN
    RAISE EXCEPTION 'Informe um motivo da transferência com pelo menos 10 caracteres.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_members
    JOIN public.profiles
      ON profiles.id = class_members.user_id
    WHERE class_members.class_id = p_source_class_id
      AND class_members.user_id = v_user_id
      AND class_members.role = 'owner'
      AND class_members.is_active = TRUE
      AND profiles.role = 'teacher'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.class_members
    JOIN public.profiles
      ON profiles.id = class_members.user_id
    WHERE class_members.class_id = p_target_class_id
      AND class_members.user_id = v_user_id
      AND class_members.role = 'owner'
      AND class_members.is_active = TRUE
      AND profiles.role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'Somente o proprietário das duas turmas pode transferir os alunos.';
  END IF;

  SELECT periods.id, periods.term_id
  INTO v_source_period_id, v_source_term_id
  FROM public.class_scoring_periods AS periods
  WHERE periods.class_id = p_source_class_id
    AND periods.status = 'open'
  FOR UPDATE;

  SELECT periods.id
  INTO v_target_period_id
  FROM public.class_scoring_periods AS periods
  WHERE periods.class_id = p_target_class_id
    AND periods.status = 'open'
    AND (
      v_source_term_id IS NULL
      OR periods.term_id = v_source_term_id
    )
  FOR UPDATE;

  IF v_source_period_id IS NOT NULL AND v_target_period_id IS NULL THEN
    RAISE EXCEPTION 'A turma de destino precisa ter um período aberto no mesmo trimestre da origem.';
  END IF;

  PERFORM set_config('app.scoring_roster_change_reason', v_reason, TRUE);
  PERFORM set_config(
    'app.scoring_roster_target_period_id',
    COALESCE(v_target_period_id::TEXT, ''),
    TRUE
  );
  PERFORM set_config(
    'app.scoring_roster_skip_target_period',
    CASE WHEN v_target_period_id IS NULL THEN 'true' ELSE 'false' END,
    TRUE
  );

  UPDATE public.students
  SET class_id = p_target_class_id
  WHERE class_id = p_source_class_id
    AND is_active = TRUE;

  GET DIAGNOSTICS v_moved_count = ROW_COUNT;

  PERFORM set_config(
    'app.scoring_roster_change_reason',
    COALESCE(v_previous_reason, ''),
    TRUE
  );
  PERFORM set_config(
    'app.scoring_roster_target_period_id',
    COALESCE(v_previous_target_period_id, ''),
    TRUE
  );
  PERFORM set_config(
    'app.scoring_roster_skip_target_period',
    COALESCE(v_previous_skip_target, ''),
    TRUE
  );

  RETURN v_moved_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_active_students_to_class(
  p_source_class_id UUID,
  p_target_class_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.move_active_students_to_class_impl(
    p_source_class_id,
    p_target_class_id,
    p_reason
  );
$$;

-- ---------------------------------------------------------------------------
-- Cross-table integrity, execute grants and schema-cache refresh
-- ---------------------------------------------------------------------------

ALTER TABLE public.class_scoring_period_rules
  ADD CONSTRAINT class_scoring_period_rules_id_class_key
  UNIQUE (id, class_id);

ALTER TABLE public.attendance_days
  ADD CONSTRAINT attendance_days_period_class_fkey
  FOREIGN KEY (period_id, class_id)
  REFERENCES public.class_scoring_periods(id, class_id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.attendance_scores
  ADD CONSTRAINT attendance_scores_period_rule_class_fkey
  FOREIGN KEY (period_rule_id, class_id)
  REFERENCES public.class_scoring_period_rules(id, class_id)
  ON DELETE RESTRICT
  NOT VALID;

CREATE OR REPLACE FUNCTION private.enforce_attendance_score_period_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_period_id UUID;
  v_rule_period_id UUID;
BEGIN
  IF NEW.period_rule_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT period_id
  INTO v_day_period_id
  FROM public.attendance_days
  WHERE id = NEW.day_id;

  SELECT period_id
  INTO v_rule_period_id
  FROM public.class_scoring_period_rules
  WHERE id = NEW.period_rule_id;

  IF v_day_period_id IS NULL OR v_rule_period_id IS NULL OR v_day_period_id <> v_rule_period_id THEN
    RAISE EXCEPTION 'A regra de pontuação não pertence ao trimestre do sábado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_attendance_score_period_link
  ON public.attendance_scores;
CREATE TRIGGER enforce_attendance_score_period_link
  BEFORE INSERT OR UPDATE OF day_id, period_rule_id, class_id
  ON public.attendance_scores
  FOR EACH ROW EXECUTE FUNCTION private.enforce_attendance_score_period_link();

CREATE OR REPLACE FUNCTION private.enforce_attendance_day_period_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id UUID;
  v_match_count INTEGER;
BEGIN
  -- During the staged rollout, the legacy app may still insert a day without
  -- period_id. Resolve a unique configured Saturday automatically so those
  -- writes already belong to the new history model. Truly unassigned legacy
  -- dates (for example 2026-04-04) remain nullable.
  IF NEW.period_id IS NULL THEN
    SELECT COUNT(*)::INTEGER
    INTO v_match_count
    FROM public.class_scoring_periods AS periods
    JOIN public.academic_terms AS terms
      ON terms.id = periods.term_id
    JOIN public.academic_term_saturdays AS saturdays
      ON saturdays.term_id = terms.id
     AND saturdays.saturday_date = NEW.day_date
    WHERE periods.class_id = NEW.class_id
      AND NEW.day_date BETWEEN terms.start_date AND terms.end_date;

    IF v_match_count = 1 THEN
      SELECT periods.id
      INTO v_period_id
      FROM public.class_scoring_periods AS periods
      JOIN public.academic_terms AS terms
        ON terms.id = periods.term_id
      JOIN public.academic_term_saturdays AS saturdays
        ON saturdays.term_id = terms.id
       AND saturdays.saturday_date = NEW.day_date
      WHERE periods.class_id = NEW.class_id
        AND NEW.day_date BETWEEN terms.start_date AND terms.end_date;

      NEW.period_id := v_period_id;
    ELSIF v_match_count > 1 THEN
      RAISE EXCEPTION 'O sábado resolve mais de um trimestre para a classe.';
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Every non-null link must be exact even for BYPASSRLS/service-role writes.
  IF NOT EXISTS (
    SELECT 1
    FROM public.class_scoring_periods AS periods
    JOIN public.academic_terms AS terms
      ON terms.id = periods.term_id
    JOIN public.academic_term_saturdays AS saturdays
      ON saturdays.term_id = terms.id
     AND saturdays.saturday_date = NEW.day_date
    WHERE periods.id = NEW.period_id
      AND periods.class_id = NEW.class_id
      AND NEW.day_date BETWEEN terms.start_date AND terms.end_date
  ) THEN
    RAISE EXCEPTION 'O sábado não pertence ao trimestre informado para a classe.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_attendance_day_period_link
  ON public.attendance_days;
CREATE TRIGGER enforce_attendance_day_period_link
  BEFORE INSERT OR UPDATE OF period_id, class_id, day_date
  ON public.attendance_days
  FOR EACH ROW EXECUTE FUNCTION private.enforce_attendance_day_period_link();

CREATE OR REPLACE FUNCTION private.enforce_closed_period_offering_reason()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status TEXT;
  v_reason TEXT := NULLIF(
    BTRIM(COALESCE(current_setting('app.scoring_change_reason', TRUE), '')),
    ''
  );
BEGIN
  IF NEW.total_offering IS NOT DISTINCT FROM OLD.total_offering THEN
    RETURN NEW;
  END IF;

  SELECT periods.status
  INTO v_period_status
  FROM public.class_scoring_periods AS periods
  WHERE periods.id = COALESCE(NEW.period_id, OLD.period_id);

  IF v_period_status IN ('closed_pending_audit', 'audit_in_progress')
     AND (
       v_reason IS NULL
       OR CHAR_LENGTH(v_reason) < 10
       OR LOWER(v_reason) = LOWER('Lançamento regular da oferta semanal.')
     ) THEN
    RAISE EXCEPTION 'Informe um motivo específico para corrigir a oferta de um trimestre fechado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_closed_period_offering_reason
  ON public.attendance_days;
CREATE TRIGGER enforce_closed_period_offering_reason
  BEFORE UPDATE OF total_offering
  ON public.attendance_days
  FOR EACH ROW EXECUTE FUNCTION private.enforce_closed_period_offering_reason();

CREATE OR REPLACE FUNCTION private.scoring_row_period_ids(
  p_table_name TEXT,
  p_row JSONB
)
RETURNS TABLE (period_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_row IS NULL THEN
    RETURN;
  END IF;

  IF p_table_name = 'attendance_days' THEN
    RETURN QUERY
    SELECT periods.id
    FROM public.class_scoring_periods AS periods
    JOIN public.academic_terms AS terms
      ON terms.id = periods.term_id
    WHERE periods.class_id = NULLIF(p_row->>'class_id', '')::UUID
      AND (
        periods.id = NULLIF(p_row->>'period_id', '')::UUID
        OR NULLIF(p_row->>'day_date', '')::DATE
          BETWEEN terms.start_date AND terms.end_date
      );
  ELSE
    RETURN QUERY
    SELECT days.period_id
    FROM public.attendance_days AS days
    WHERE days.id = NULLIF(p_row->>'day_id', '')::UUID
      AND days.period_id IS NOT NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.scoring_rows_period_are_locked(
  p_table_name TEXT,
  p_old_row JSONB,
  p_new_row JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_period_id UUID;
  v_status TEXT;
  v_locked BOOLEAN := FALSE;
BEGIN
  FOR v_period_id IN
    SELECT DISTINCT candidate_periods.period_id
    FROM (
      SELECT period_id
      FROM private.scoring_row_period_ids(p_table_name, p_old_row)
      UNION ALL
      SELECT period_id
      FROM private.scoring_row_period_ids(p_table_name, p_new_row)
    ) AS candidate_periods
    WHERE candidate_periods.period_id IS NOT NULL
    ORDER BY candidate_periods.period_id
  LOOP
    SELECT periods.status
    INTO v_status
    FROM public.class_scoring_periods AS periods
    WHERE periods.id = v_period_id
    FOR UPDATE;

    v_locked := v_locked OR v_status = 'audited_locked';
  END LOOP;

  RETURN v_locked;
END;
$$;

CREATE OR REPLACE FUNCTION private.prevent_locked_scoring_fact_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.scoring_rows_period_are_locked(
    TG_TABLE_NAME,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  ) THEN
    RAISE EXCEPTION 'O trimestre foi auditado e está bloqueado para alterações.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS prevent_locked_attendance_days_mutation
  ON public.attendance_days;
CREATE TRIGGER prevent_locked_attendance_days_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.attendance_days
  FOR EACH ROW EXECUTE FUNCTION private.prevent_locked_scoring_fact_mutation();

DROP TRIGGER IF EXISTS prevent_locked_attendance_records_mutation
  ON public.student_attendance_records;
CREATE TRIGGER prevent_locked_attendance_records_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.student_attendance_records
  FOR EACH ROW EXECUTE FUNCTION private.prevent_locked_scoring_fact_mutation();

DROP TRIGGER IF EXISTS prevent_locked_attendance_scores_mutation
  ON public.attendance_scores;
CREATE TRIGGER prevent_locked_attendance_scores_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.attendance_scores
  FOR EACH ROW EXECUTE FUNCTION private.prevent_locked_scoring_fact_mutation();

DROP TRIGGER IF EXISTS prevent_locked_discipline_events_mutation
  ON public.attendance_discipline_events;
CREATE TRIGGER prevent_locked_discipline_events_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.attendance_discipline_events
  FOR EACH ROW EXECUTE FUNCTION private.prevent_locked_scoring_fact_mutation();

-- Destructive cascades are incompatible with an auditable historical period.
-- Existing facts now block deletion of their source rule, student, day or
-- parent record; product flows use soft-deactivation instead.
ALTER TABLE public.attendance_scores
  DROP CONSTRAINT attendance_scores_rule_id_fkey;
ALTER TABLE public.attendance_scores
  ADD CONSTRAINT attendance_scores_rule_id_fkey
  FOREIGN KEY (rule_id)
  REFERENCES public.class_scoring_rules(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.attendance_scores
  DROP CONSTRAINT attendance_scores_student_id_fkey;
ALTER TABLE public.attendance_scores
  ADD CONSTRAINT attendance_scores_student_id_fkey
  FOREIGN KEY (student_id)
  REFERENCES public.students(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.attendance_scores
  DROP CONSTRAINT attendance_scores_day_id_fkey;
ALTER TABLE public.attendance_scores
  ADD CONSTRAINT attendance_scores_day_id_fkey
  FOREIGN KEY (day_id)
  REFERENCES public.attendance_days(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.student_attendance_records
  DROP CONSTRAINT student_attendance_records_student_id_fkey;
ALTER TABLE public.student_attendance_records
  ADD CONSTRAINT student_attendance_records_student_id_fkey
  FOREIGN KEY (student_id)
  REFERENCES public.students(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.student_attendance_records
  DROP CONSTRAINT student_attendance_records_day_id_fkey;
ALTER TABLE public.student_attendance_records
  ADD CONSTRAINT student_attendance_records_day_id_fkey
  FOREIGN KEY (day_id)
  REFERENCES public.attendance_days(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.attendance_discipline_events
  DROP CONSTRAINT attendance_discipline_events_student_id_fkey;
ALTER TABLE public.attendance_discipline_events
  ADD CONSTRAINT attendance_discipline_events_student_id_fkey
  FOREIGN KEY (student_id)
  REFERENCES public.students(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.attendance_discipline_events
  DROP CONSTRAINT attendance_discipline_events_day_id_fkey;
ALTER TABLE public.attendance_discipline_events
  ADD CONSTRAINT attendance_discipline_events_day_id_fkey
  FOREIGN KEY (day_id)
  REFERENCES public.attendance_days(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.attendance_discipline_events
  DROP CONSTRAINT attendance_discipline_events_record_id_fkey;
ALTER TABLE public.attendance_discipline_events
  ADD CONSTRAINT attendance_discipline_events_record_id_fkey
  FOREIGN KEY (record_id)
  REFERENCES public.student_attendance_records(id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.attendance_days
  VALIDATE CONSTRAINT attendance_days_period_fkey;
ALTER TABLE public.attendance_days
  VALIDATE CONSTRAINT attendance_days_period_class_fkey;
ALTER TABLE public.attendance_scores
  VALIDATE CONSTRAINT attendance_scores_period_rule_fkey;
ALTER TABLE public.attendance_scores
  VALIDATE CONSTRAINT attendance_scores_period_rule_class_fkey;
ALTER TABLE public.scoring_audit_log
  VALIDATE CONSTRAINT scoring_audit_log_period_fkey;
ALTER TABLE public.attendance_scores
  VALIDATE CONSTRAINT attendance_scores_rule_id_fkey;
ALTER TABLE public.attendance_scores
  VALIDATE CONSTRAINT attendance_scores_student_id_fkey;
ALTER TABLE public.attendance_scores
  VALIDATE CONSTRAINT attendance_scores_day_id_fkey;
ALTER TABLE public.student_attendance_records
  VALIDATE CONSTRAINT student_attendance_records_student_id_fkey;
ALTER TABLE public.student_attendance_records
  VALIDATE CONSTRAINT student_attendance_records_day_id_fkey;
ALTER TABLE public.attendance_discipline_events
  VALIDATE CONSTRAINT attendance_discipline_events_student_id_fkey;
ALTER TABLE public.attendance_discipline_events
  VALIDATE CONSTRAINT attendance_discipline_events_day_id_fkey;
ALTER TABLE public.attendance_discipline_events
  VALIDATE CONSTRAINT attendance_discipline_events_record_id_fkey;

REVOKE ALL ON FUNCTION private.create_scoring_period_result_revision(UUID, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.refresh_scoring_period_findings(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.open_class_scoring_period_impl(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.transition_scoring_period_impl(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.resolve_scoring_period_finding_impl(UUID, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.add_scoring_period_annotation_impl(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.save_student_attendance_record_v2_impl(UUID, DATE, UUID, UUID[], INTEGER, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.save_attendance_day_offering_impl(UUID, DATE, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.resolve_guardian_scoring_period(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.get_guardian_student_progress_impl(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.get_guardian_class_offering_summary_impl(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.move_active_students_to_class_impl(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.open_class_scoring_period_impl(UUID, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.transition_scoring_period_impl(UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.resolve_scoring_period_finding_impl(UUID, TEXT, BOOLEAN)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.add_scoring_period_annotation_impl(UUID, UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.save_student_attendance_record_v2_impl(UUID, DATE, UUID, UUID[], INTEGER, JSONB, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.save_attendance_day_offering_impl(UUID, DATE, NUMERIC, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_guardian_student_progress_impl(UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_guardian_class_offering_summary_impl(UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.move_active_students_to_class_impl(UUID, UUID, TEXT)
  TO authenticated;

-- The previous private implementation does not understand period membership or
-- audited locks. Remove its direct execution path while preserving the public
-- legacy wrapper above.
REVOKE ALL ON FUNCTION private.save_student_attendance_record_impl(UUID, DATE, UUID, UUID[], INTEGER, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.open_class_scoring_period(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.close_scoring_period(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.begin_scoring_period_audit(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.approve_scoring_period_audit(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reopen_scoring_period(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.resolve_scoring_period_finding(UUID, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.add_scoring_period_annotation(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_student_attendance_record_v2(UUID, DATE, UUID, UUID[], INTEGER, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_student_attendance_record(UUID, DATE, UUID, UUID[], INTEGER, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_attendance_day_offering(UUID, DATE, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_guardian_student_progress(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_guardian_student_progress_for_period(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_guardian_class_offering_summary(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_guardian_class_offering_summary_for_period(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.move_active_students_to_class(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.open_class_scoring_period(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_scoring_period(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_scoring_period_audit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_scoring_period_audit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_scoring_period(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_scoring_period_finding(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_scoring_period_annotation(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_attendance_record_v2(UUID, DATE, UUID, UUID[], INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_attendance_record(UUID, DATE, UUID, UUID[], INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_attendance_day_offering(UUID, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_guardian_student_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_guardian_student_progress_for_period(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_guardian_class_offering_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_guardian_class_offering_summary_for_period(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_active_students_to_class(UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION private.log_scoring_audit()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.prevent_scoring_period_append_only_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.enforce_attendance_score_period_link()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.enforce_attendance_day_period_link()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.enforce_closed_period_offering_reason()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.prevent_scoring_audit_log_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.scoring_row_period_ids(TEXT, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.scoring_rows_period_are_locked(TEXT, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.prevent_locked_scoring_fact_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.sync_open_scoring_period_student()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.bootstrap_class_scoring_periods()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.current_sao_paulo_date()
  FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
