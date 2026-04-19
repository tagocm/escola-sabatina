CREATE TABLE IF NOT EXISTS public.attendance_discipline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.student_attendance_records(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES public.attendance_days(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
  reason TEXT NOT NULL CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL),
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_by_name TEXT NOT NULL CHECK (NULLIF(BTRIM(applied_by_name), '') IS NOT NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_discipline_events_record_id
  ON public.attendance_discipline_events(record_id);

CREATE INDEX IF NOT EXISTS idx_attendance_discipline_events_student_day
  ON public.attendance_discipline_events(student_id, day_id);

CREATE INDEX IF NOT EXISTS idx_attendance_discipline_events_class_id
  ON public.attendance_discipline_events(class_id);

DROP TRIGGER IF EXISTS attendance_discipline_events_updated_at ON public.attendance_discipline_events;

CREATE TRIGGER attendance_discipline_events_updated_at
  BEFORE UPDATE ON public.attendance_discipline_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.attendance_discipline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_discipline_events_manage_coordinators" ON public.attendance_discipline_events;

CREATE POLICY "attendance_discipline_events_manage_coordinators"
  ON public.attendance_discipline_events FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members
      WHERE class_members.class_id = attendance_discipline_events.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  );

INSERT INTO public.attendance_discipline_events (
  record_id,
  day_id,
  class_id,
  student_id,
  points,
  reason,
  applied_by,
  applied_by_name,
  created_at,
  updated_at
)
SELECT
  records.id,
  records.day_id,
  records.class_id,
  records.student_id,
  GREATEST(COALESCE(records.discipline_penalty_points, 0), 1),
  COALESCE(NULLIF(BTRIM(records.discipline_penalty_reason), ''), 'Registro anterior sem motivo informado'),
  records.discipline_penalty_applied_by,
  COALESCE(NULLIF(BTRIM(records.discipline_penalty_applied_by_name), ''), 'Professor não identificado'),
  COALESCE(records.saved_at, NOW()),
  COALESCE(records.saved_at, NOW())
FROM public.student_attendance_records AS records
WHERE COALESCE(records.discipline_penalty_points, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.attendance_discipline_events AS events
    WHERE events.record_id = records.id
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
  ORDER BY mailbox.happened_at DESC, mailbox.message_id DESC
  LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.get_guardian_student_mailbox(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guardian_student_mailbox(UUID) TO authenticated;
