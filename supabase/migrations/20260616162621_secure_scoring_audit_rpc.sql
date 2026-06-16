-- Secure scoring writes behind a database-owned RPC and preserve an audit trail.
-- This migration is intentionally additive for existing data: it does not delete
-- or rewrite prior scoring rows, and it snapshots current scoring state first.

ALTER TABLE public.student_attendance_records
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS student_attendance_records_updated_at ON public.student_attendance_records;

CREATE TRIGGER student_attendance_records_updated_at
  BEFORE UPDATE ON public.student_attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.scoring_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL CHECK (
    table_name IN (
      'student_attendance_records',
      'attendance_scores',
      'attendance_discipline_events'
    )
  ),
  operation TEXT NOT NULL CHECK (operation IN ('baseline', 'insert', 'update', 'delete')),
  row_id UUID NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  day_id UUID REFERENCES public.attendance_days(id) ON DELETE SET NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_id BIGINT NOT NULL DEFAULT txid_current(),
  reason TEXT,
  old_data JSONB,
  new_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_scoring_audit_log_class_changed
  ON public.scoring_audit_log(class_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_scoring_audit_log_student_changed
  ON public.scoring_audit_log(student_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_scoring_audit_log_row
  ON public.scoring_audit_log(table_name, row_id);

INSERT INTO public.scoring_audit_log (
  table_name,
  operation,
  row_id,
  class_id,
  day_id,
  student_id,
  actor_user_id,
  actor_name,
  changed_at,
  reason,
  new_data
)
SELECT
  'student_attendance_records',
  'baseline',
  records.id,
  records.class_id,
  records.day_id,
  records.student_id,
  records.saved_by,
  COALESCE(NULLIF(BTRIM(profiles.full_name), ''), profiles.email, 'Professor não identificado'),
  COALESCE(records.saved_at, records.updated_at, NOW()),
  'snapshot before secure scoring RPC rollout',
  to_jsonb(records)
FROM public.student_attendance_records AS records
LEFT JOIN public.profiles
  ON profiles.id = records.saved_by
WHERE NOT EXISTS (
  SELECT 1
  FROM public.scoring_audit_log AS audit
  WHERE audit.table_name = 'student_attendance_records'
    AND audit.operation = 'baseline'
    AND audit.row_id = records.id
);

INSERT INTO public.scoring_audit_log (
  table_name,
  operation,
  row_id,
  class_id,
  day_id,
  student_id,
  actor_user_id,
  actor_name,
  changed_at,
  reason,
  new_data
)
SELECT
  'attendance_scores',
  'baseline',
  scores.id,
  scores.class_id,
  scores.day_id,
  scores.student_id,
  records.saved_by,
  COALESCE(NULLIF(BTRIM(profiles.full_name), ''), profiles.email, 'Professor não identificado'),
  COALESCE(scores.created_at, records.saved_at, NOW()),
  'snapshot before secure scoring RPC rollout',
  to_jsonb(scores)
FROM public.attendance_scores AS scores
LEFT JOIN public.student_attendance_records AS records
  ON records.day_id = scores.day_id
 AND records.student_id = scores.student_id
LEFT JOIN public.profiles
  ON profiles.id = records.saved_by
WHERE NOT EXISTS (
  SELECT 1
  FROM public.scoring_audit_log AS audit
  WHERE audit.table_name = 'attendance_scores'
    AND audit.operation = 'baseline'
    AND audit.row_id = scores.id
);

INSERT INTO public.scoring_audit_log (
  table_name,
  operation,
  row_id,
  class_id,
  day_id,
  student_id,
  actor_user_id,
  actor_name,
  changed_at,
  reason,
  new_data
)
SELECT
  'attendance_discipline_events',
  'baseline',
  events.id,
  events.class_id,
  events.day_id,
  events.student_id,
  events.applied_by,
  COALESCE(NULLIF(BTRIM(events.applied_by_name), ''), 'Professor não identificado'),
  COALESCE(events.created_at, NOW()),
  'snapshot before secure scoring RPC rollout',
  to_jsonb(events)
FROM public.attendance_discipline_events AS events
WHERE NOT EXISTS (
  SELECT 1
  FROM public.scoring_audit_log AS audit
  WHERE audit.table_name = 'attendance_discipline_events'
    AND audit.operation = 'baseline'
    AND audit.row_id = events.id
);

ALTER TABLE public.scoring_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoring_audit_log_select_teachers" ON public.scoring_audit_log;

CREATE POLICY "scoring_audit_log_select_teachers"
  ON public.scoring_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members
      JOIN public.profiles
        ON profiles.id = class_members.user_id
      WHERE class_members.class_id = scoring_audit_log.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
        AND profiles.role = 'teacher'
    )
  );

REVOKE ALL ON public.scoring_audit_log FROM anon, authenticated;
GRANT SELECT ON public.scoring_audit_log TO authenticated;

CREATE OR REPLACE FUNCTION public.log_scoring_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := auth.uid();
  v_actor_name TEXT;
  v_row JSONB := COALESCE(to_jsonb(NEW), to_jsonb(OLD));
  v_operation TEXT := LOWER(TG_OP);
BEGIN
  IF v_actor_user_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(BTRIM(full_name), ''), email, 'Professor não identificado')
    INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_user_id;
  END IF;

  INSERT INTO public.scoring_audit_log (
    table_name,
    operation,
    row_id,
    class_id,
    day_id,
    student_id,
    actor_user_id,
    actor_name,
    reason,
    old_data,
    new_data
  )
  VALUES (
    TG_TABLE_NAME,
    v_operation,
    (v_row->>'id')::UUID,
    NULLIF(v_row->>'class_id', '')::UUID,
    NULLIF(v_row->>'day_id', '')::UUID,
    NULLIF(v_row->>'student_id', '')::UUID,
    v_actor_user_id,
    COALESCE(v_actor_name, 'Sistema'),
    'scoring table change',
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS scoring_audit_student_attendance_records ON public.student_attendance_records;
DROP TRIGGER IF EXISTS scoring_audit_attendance_scores ON public.attendance_scores;
DROP TRIGGER IF EXISTS scoring_audit_attendance_discipline_events ON public.attendance_discipline_events;

CREATE TRIGGER scoring_audit_student_attendance_records
  AFTER INSERT OR UPDATE OR DELETE ON public.student_attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.log_scoring_audit();

CREATE TRIGGER scoring_audit_attendance_scores
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_scores
  FOR EACH ROW EXECUTE FUNCTION public.log_scoring_audit();

CREATE TRIGGER scoring_audit_attendance_discipline_events
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_discipline_events
  FOR EACH ROW EXECUTE FUNCTION public.log_scoring_audit();

DROP POLICY IF EXISTS "scores_manage_coordinators" ON public.attendance_scores;
DROP POLICY IF EXISTS "attendance_records_manage_coordinators" ON public.student_attendance_records;
DROP POLICY IF EXISTS "attendance_discipline_events_manage_coordinators" ON public.attendance_discipline_events;

DROP POLICY IF EXISTS "attendance_scores_select_class_members" ON public.attendance_scores;
DROP POLICY IF EXISTS "attendance_records_select_class_members" ON public.student_attendance_records;
DROP POLICY IF EXISTS "attendance_discipline_events_select_class_members" ON public.attendance_discipline_events;

CREATE POLICY "attendance_scores_select_class_members"
  ON public.attendance_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members
      JOIN public.profiles
        ON profiles.id = class_members.user_id
      WHERE class_members.class_id = attendance_scores.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
        AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "attendance_records_select_class_members"
  ON public.student_attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members
      JOIN public.profiles
        ON profiles.id = class_members.user_id
      WHERE class_members.class_id = student_attendance_records.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
        AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "attendance_discipline_events_select_class_members"
  ON public.attendance_discipline_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members
      JOIN public.profiles
        ON profiles.id = class_members.user_id
      WHERE class_members.class_id = attendance_discipline_events.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
        AND profiles.role = 'teacher'
    )
  );

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.attendance_scores FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.student_attendance_records FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.attendance_discipline_events FROM anon;

REVOKE INSERT, UPDATE, DELETE ON public.attendance_scores FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.student_attendance_records FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_discipline_events FROM authenticated;

GRANT SELECT ON public.attendance_scores TO authenticated;
GRANT SELECT ON public.student_attendance_records TO authenticated;
GRANT SELECT ON public.attendance_discipline_events TO authenticated;

CREATE OR REPLACE FUNCTION public.save_student_attendance_record(
  p_class_id UUID,
  p_day_date DATE,
  p_student_id UUID,
  p_rule_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_extra_activity_points INTEGER DEFAULT 0,
  p_discipline_events JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
  record_id UUID,
  total_points INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_teacher_name TEXT;
  v_day_id UUID;
  v_existing_record_id UUID;
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(full_name), ''), email, 'Professor não identificado')
  INTO v_teacher_name
  FROM public.profiles
  WHERE id = v_user_id
    AND role = 'teacher';

  IF v_teacher_name IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_members
    WHERE class_id = p_class_id
      AND user_id = v_user_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Professor não pertence à classe informada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.students
    WHERE id = p_student_id
      AND class_id = p_class_id
  ) THEN
    RAISE EXCEPTION 'Aluno não pertence à classe informada.';
  END IF;

  IF v_extra_points > v_max_extra_points THEN
    RAISE EXCEPTION 'Pontuação extra acima do limite permitido.';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT submitted_rule_id), ARRAY[]::UUID[])
  INTO v_unique_rule_ids
  FROM unnest(COALESCE(p_rule_ids, ARRAY[]::UUID[])) AS submitted_rule_id
  WHERE submitted_rule_id IS NOT NULL;

  v_requested_rule_count := COALESCE(array_length(v_unique_rule_ids, 1), 0);

  IF v_requested_rule_count > 0 THEN
    SELECT COUNT(*), COALESCE(SUM(points), 0)
    INTO v_matched_rule_count, v_base_points
    FROM public.class_scoring_rules
    WHERE class_id = p_class_id
      AND id = ANY(v_unique_rule_ids);

    IF v_matched_rule_count <> v_requested_rule_count THEN
      RAISE EXCEPTION 'Critério de pontuação inválido para esta classe.';
    END IF;
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

  SELECT COALESCE(SUM(points), 0)
  INTO v_penalty_points
  FROM pg_temp._submitted_scoring_discipline_events;

  IF v_penalty_points > (v_base_points + v_extra_points) THEN
    RAISE EXCEPTION 'Os eventos de indisciplina excedem a pontuação disponível do aluno.';
  END IF;

  SELECT id
  INTO v_day_id
  FROM public.attendance_days
  WHERE class_id = p_class_id
    AND day_date = p_day_date;

  IF v_day_id IS NULL THEN
    INSERT INTO public.attendance_days (class_id, day_date)
    VALUES (p_class_id, p_day_date)
    ON CONFLICT (class_id, day_date) DO NOTHING
    RETURNING id INTO v_day_id;

    IF v_day_id IS NULL THEN
      SELECT id
      INTO v_day_id
      FROM public.attendance_days
      WHERE class_id = p_class_id
        AND day_date = p_day_date;
    END IF;
  END IF;

  SELECT id
  INTO v_existing_record_id
  FROM public.student_attendance_records
  WHERE day_id = v_day_id
    AND student_id = p_student_id;

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
    v_base_points + v_extra_points - v_penalty_points,
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
    updated_at = NOW()
  RETURNING id, total_points INTO v_record_id, v_total_points;

  DELETE FROM public.attendance_scores
  WHERE day_id = v_day_id
    AND student_id = p_student_id;

  IF v_requested_rule_count > 0 THEN
    INSERT INTO public.attendance_scores (
      day_id,
      class_id,
      student_id,
      rule_id,
      points_earned
    )
    SELECT
      v_day_id,
      p_class_id,
      p_student_id,
      rules.id,
      rules.points
    FROM public.class_scoring_rules AS rules
    WHERE rules.class_id = p_class_id
      AND rules.id = ANY(v_unique_rule_ids)
    ORDER BY rules.display_order, rules.name, rules.id;
  END IF;

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

  RETURN QUERY SELECT v_record_id, v_total_points;
END;
$$;

REVOKE ALL ON FUNCTION public.save_student_attendance_record(UUID, DATE, UUID, UUID[], INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_student_attendance_record(UUID, DATE, UUID, UUID[], INTEGER, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_invite(p_class_id UUID, p_email TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
  v_email TEXT := NULLIF(LOWER(BTRIM(COALESCE(p_email, ''))), '');
BEGIN
  IF NOT public.is_class_member(p_class_id) THEN
    RAISE EXCEPTION 'Not authorized to invite to this class';
  END IF;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Teacher invites must be bound to an email';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.class_invites (class_id, invited_by_user_id, token, email)
  VALUES (p_class_id, auth.uid(), v_token, v_email);

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
