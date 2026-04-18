ALTER TABLE public.student_attendance_records
  ADD COLUMN IF NOT EXISTS discipline_penalty_reason TEXT,
  ADD COLUMN IF NOT EXISTS discipline_penalty_applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discipline_penalty_applied_by_name TEXT;

UPDATE public.student_attendance_records
SET
  discipline_penalty_reason = COALESCE(NULLIF(BTRIM(discipline_penalty_reason), ''), 'Registro anterior sem motivo informado'),
  discipline_penalty_applied_by = COALESCE(discipline_penalty_applied_by, saved_by)
WHERE COALESCE(discipline_penalty_points, 0) > 0;

UPDATE public.student_attendance_records AS records
SET discipline_penalty_applied_by_name = COALESCE(
  NULLIF(BTRIM(records.discipline_penalty_applied_by_name), ''),
  NULLIF(BTRIM(profiles.full_name), ''),
  'Professor não identificado'
)
FROM public.profiles
WHERE COALESCE(records.discipline_penalty_points, 0) > 0
  AND profiles.id = COALESCE(records.discipline_penalty_applied_by, records.saved_by)
  AND NULLIF(BTRIM(COALESCE(records.discipline_penalty_applied_by_name, '')), '') IS NULL;

UPDATE public.student_attendance_records
SET discipline_penalty_applied_by_name = COALESCE(
  NULLIF(BTRIM(discipline_penalty_applied_by_name), ''),
  'Professor não identificado'
)
WHERE COALESCE(discipline_penalty_points, 0) > 0
  AND NULLIF(BTRIM(COALESCE(discipline_penalty_applied_by_name, '')), '') IS NULL;

ALTER TABLE public.student_attendance_records
  DROP CONSTRAINT IF EXISTS student_attendance_records_discipline_reason_required;

ALTER TABLE public.student_attendance_records
  ADD CONSTRAINT student_attendance_records_discipline_reason_required
  CHECK (
    COALESCE(discipline_penalty_points, 0) = 0
    OR NULLIF(BTRIM(COALESCE(discipline_penalty_reason, '')), '') IS NOT NULL
  );

ALTER TABLE public.student_attendance_records
  DROP CONSTRAINT IF EXISTS student_attendance_records_discipline_teacher_required;

ALTER TABLE public.student_attendance_records
  ADD CONSTRAINT student_attendance_records_discipline_teacher_required
  CHECK (
    COALESCE(discipline_penalty_points, 0) = 0
    OR NULLIF(BTRIM(COALESCE(discipline_penalty_applied_by_name, '')), '') IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.get_guardian_student_mailbox(p_student_id UUID)
RETURNS TABLE (
  message_id TEXT,
  message_type TEXT,
  title TEXT,
  body TEXT,
  happened_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH target_student AS (
    SELECT
      students.id,
      students.full_name,
      students.class_id
    FROM guardian_students
    JOIN students
      ON students.id = guardian_students.student_id
    WHERE guardian_students.guardian_id = auth.uid()
      AND guardian_students.student_id = p_student_id
  ),
  discipline_messages AS (
    SELECT
      'discipline-' || records.id::text AS message_id,
      'indisciplina'::text AS message_type,
      'Ocorrência de indisciplina'::text AS title,
      format(
        'No sábado %s, %s registrou desconto de %s ponto(s) por indisciplina. Motivo: %s.',
        to_char(days.day_date, 'DD/MM/YYYY'),
        COALESCE(NULLIF(BTRIM(records.discipline_penalty_applied_by_name), ''), 'A coordenação'),
        records.discipline_penalty_points,
        COALESCE(NULLIF(BTRIM(records.discipline_penalty_reason), ''), 'Não informado')
      ) AS body,
      COALESCE(records.saved_at, days.updated_at, days.created_at) AS happened_at
    FROM target_student
    JOIN student_attendance_records AS records
      ON records.student_id = target_student.id
    JOIN attendance_days AS days
      ON days.id = records.day_id
    WHERE COALESCE(records.discipline_penalty_points, 0) > 0
  ),
  responsibility_assignment_messages AS (
    SELECT
      'assignment-' || assignments.id::text AS message_id,
      'calendario'::text AS message_type,
      'Atualização de calendário'::text AS title,
      format(
        'Responsabilidade agendada: %s em %s.',
        templates.name,
        to_char(assignments.scheduled_date, 'DD/MM/YYYY')
      ) AS body,
      assignments.updated_at AS happened_at
    FROM target_student
    JOIN class_responsibility_assignments AS assignments
      ON assignments.student_id = target_student.id
    JOIN class_responsibility_templates AS templates
      ON templates.id = assignments.template_id
    LEFT JOIN class_responsibility_occurrences AS occurrences
      ON occurrences.class_id = assignments.class_id
     AND occurrences.template_id = assignments.template_id
     AND occurrences.scheduled_date = assignments.scheduled_date
    WHERE COALESCE(occurrences.is_cancelled, FALSE) = FALSE
  ),
  responsibility_cancelled_messages AS (
    SELECT DISTINCT
      'cancelled-' || assignments.id::text || '-' || to_char(occurrences.updated_at, 'YYYYMMDDHH24MISS') AS message_id,
      'calendario'::text AS message_type,
      'Atividade cancelada'::text AS title,
      format(
        '%s de %s foi cancelada pela coordenação.',
        templates.name,
        to_char(assignments.scheduled_date, 'DD/MM/YYYY')
      ) AS body,
      occurrences.updated_at AS happened_at
    FROM target_student
    JOIN class_responsibility_assignments AS assignments
      ON assignments.student_id = target_student.id
    JOIN class_responsibility_templates AS templates
      ON templates.id = assignments.template_id
    JOIN class_responsibility_occurrences AS occurrences
      ON occurrences.class_id = assignments.class_id
     AND occurrences.template_id = assignments.template_id
     AND occurrences.scheduled_date = assignments.scheduled_date
    WHERE occurrences.is_cancelled = TRUE
  )
  SELECT
    mailbox.message_id,
    mailbox.message_type,
    mailbox.title,
    mailbox.body,
    mailbox.happened_at
  FROM (
    SELECT * FROM discipline_messages
    UNION ALL
    SELECT * FROM responsibility_assignment_messages
    UNION ALL
    SELECT * FROM responsibility_cancelled_messages
  ) AS mailbox
  ORDER BY mailbox.happened_at DESC, mailbox.message_id DESC
  LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.get_guardian_student_mailbox(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guardian_student_mailbox(UUID) TO authenticated;
