CREATE TABLE IF NOT EXISTS public.guardian_mailbox_dismissals (
  guardian_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL CHECK (NULLIF(BTRIM(message_id), '') IS NOT NULL),
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guardian_id, student_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_mailbox_dismissals_student_id
  ON public.guardian_mailbox_dismissals(student_id);

ALTER TABLE public.guardian_mailbox_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardian_mailbox_dismissals_manage_own" ON public.guardian_mailbox_dismissals;

CREATE POLICY "guardian_mailbox_dismissals_manage_own"
  ON public.guardian_mailbox_dismissals
  FOR ALL
  USING (
    guardian_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.guardian_students
      WHERE guardian_students.guardian_id = auth.uid()
        AND guardian_students.student_id = guardian_mailbox_dismissals.student_id
    )
  )
  WITH CHECK (
    guardian_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.guardian_students
      WHERE guardian_students.guardian_id = auth.uid()
        AND guardian_students.student_id = guardian_mailbox_dismissals.student_id
    )
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
  dismissed_messages AS (
    SELECT guardian_mailbox_dismissals.message_id
    FROM public.guardian_mailbox_dismissals
    WHERE guardian_mailbox_dismissals.guardian_id = auth.uid()
      AND guardian_mailbox_dismissals.student_id = p_student_id
  ),
  discipline_messages AS (
    SELECT
      'discipline-event-' || events.id::text AS message_id,
      'indisciplina'::text AS message_type,
      'Ocorrência de indisciplina'::text AS title,
      format(
        'No sábado %s, %s registrou desconto de %s ponto(s) por indisciplina. Motivo: %s.',
        to_char(days.day_date, 'DD/MM/YYYY'),
        COALESCE(NULLIF(BTRIM(events.applied_by_name), ''), 'A coordenação'),
        events.points,
        COALESCE(NULLIF(BTRIM(events.reason), ''), 'Não informado')
      ) AS body,
      COALESCE(events.updated_at, events.created_at, records.saved_at, days.updated_at, days.created_at) AS happened_at
    FROM target_student
    JOIN public.student_attendance_records AS records
      ON records.student_id = target_student.id
    JOIN public.attendance_discipline_events AS events
      ON events.record_id = records.id
    JOIN public.attendance_days AS days
      ON days.id = records.day_id
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
    JOIN public.class_responsibility_assignments AS assignments
      ON assignments.student_id = target_student.id
    JOIN public.class_responsibility_templates AS templates
      ON templates.id = assignments.template_id
    LEFT JOIN public.class_responsibility_occurrences AS occurrences
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
    JOIN public.class_responsibility_assignments AS assignments
      ON assignments.student_id = target_student.id
    JOIN public.class_responsibility_templates AS templates
      ON templates.id = assignments.template_id
    JOIN public.class_responsibility_occurrences AS occurrences
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
  LEFT JOIN dismissed_messages
    ON dismissed_messages.message_id = mailbox.message_id
  WHERE dismissed_messages.message_id IS NULL
  ORDER BY mailbox.happened_at DESC, mailbox.message_id DESC
  LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.get_guardian_student_mailbox(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guardian_student_mailbox(UUID) TO authenticated;
