CREATE OR REPLACE FUNCTION public.get_guardian_class_offering_summary(p_student_id UUID)
RETURNS TABLE (
  class_id UUID,
  class_name TEXT,
  offering_goal NUMERIC,
  accumulated_offering NUMERIC,
  trimester_goal NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    classes.id AS class_id,
    classes.name AS class_name,
    COALESCE(classes.offering_goal, 0) AS offering_goal,
    COALESCE(SUM(attendance_days.total_offering), 0) AS accumulated_offering,
    COALESCE(classes.offering_goal, 0) * 13 AS trimester_goal
  FROM guardian_students
  JOIN students
    ON students.id = guardian_students.student_id
  JOIN classes
    ON classes.id = students.class_id
  LEFT JOIN attendance_days
    ON attendance_days.class_id = classes.id
  WHERE guardian_students.guardian_id = auth.uid()
    AND guardian_students.student_id = p_student_id
  GROUP BY classes.id, classes.name, classes.offering_goal;
$$;

GRANT EXECUTE ON FUNCTION public.get_guardian_class_offering_summary(UUID) TO authenticated;
