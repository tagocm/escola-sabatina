-- ============================================================
-- Guardian progress access
-- Exposes a safe progress timeline for guardians over their own children
-- ============================================================

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_student_guardian(p_student_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  WITH target_student AS (
    SELECT
      students.id,
      students.full_name,
      students.class_id,
      classes.name AS class_name
    FROM students
    LEFT JOIN classes ON classes.id = students.class_id
    WHERE students.id = p_student_id
  ),
  scored_days AS (
    SELECT
      attendance_days.id AS day_id,
      attendance_days.day_date,
      AVG(student_attendance_records.total_points)::NUMERIC(10,2) AS class_average,
      MAX(student_attendance_records.total_points) AS class_highest,
      COUNT(student_attendance_records.student_id) AS class_size
    FROM target_student
    JOIN attendance_days
      ON attendance_days.class_id = target_student.class_id
    JOIN student_attendance_records
      ON student_attendance_records.day_id = attendance_days.id
    GROUP BY attendance_days.id, attendance_days.day_date
  )
  SELECT
    target_student.id,
    target_student.full_name,
    target_student.class_id,
    target_student.class_name,
    scored_days.day_date,
    student_attendance_records.total_points,
    scored_days.class_average,
    scored_days.class_highest,
    scored_days.class_size
  FROM target_student
  JOIN scored_days ON TRUE
  JOIN student_attendance_records
    ON student_attendance_records.day_id = scored_days.day_id
   AND student_attendance_records.student_id = target_student.id
  ORDER BY scored_days.day_date ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guardian_student_progress(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guardian_student_progress(UUID) TO authenticated;
