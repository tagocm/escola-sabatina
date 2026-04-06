ALTER TABLE attendance_scores
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

ALTER TABLE student_attendance_records
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

UPDATE attendance_scores
SET class_id = attendance_days.class_id
FROM attendance_days
WHERE attendance_days.id = attendance_scores.day_id
  AND attendance_scores.class_id IS NULL;

UPDATE student_attendance_records
SET class_id = attendance_days.class_id
FROM attendance_days
WHERE attendance_days.id = student_attendance_records.day_id
  AND student_attendance_records.class_id IS NULL;

ALTER TABLE attendance_scores
  ALTER COLUMN class_id SET NOT NULL;

ALTER TABLE student_attendance_records
  ALTER COLUMN class_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_scores_class_id ON attendance_scores(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_class_id ON student_attendance_records(class_id);

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
  WITH student_days AS (
    SELECT
      student_attendance_records.student_id,
      student_attendance_records.total_points,
      student_attendance_records.class_id,
      attendance_days.id AS day_id,
      attendance_days.day_date
    FROM student_attendance_records
    JOIN attendance_days
      ON attendance_days.id = student_attendance_records.day_id
    WHERE student_attendance_records.student_id = p_student_id
  ),
  day_stats AS (
    SELECT
      student_days.day_id,
      AVG(records.total_points)::NUMERIC(10,2) AS class_average,
      MAX(records.total_points) AS class_highest,
      COUNT(records.student_id) AS class_size
    FROM student_days
    JOIN student_attendance_records AS records
      ON records.day_id = student_days.day_id
     AND records.class_id = student_days.class_id
    GROUP BY student_days.day_id
  )
  SELECT
    students.id,
    students.full_name,
    student_days.class_id,
    classes.name AS class_name,
    student_days.day_date,
    student_days.total_points,
    day_stats.class_average,
    day_stats.class_highest,
    day_stats.class_size
  FROM student_days
  JOIN students
    ON students.id = student_days.student_id
  LEFT JOIN classes
    ON classes.id = student_days.class_id
  JOIN day_stats
    ON day_stats.day_id = student_days.day_id
  ORDER BY student_days.day_date ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guardian_student_progress(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guardian_student_progress(UUID) TO authenticated;
