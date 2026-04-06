DROP POLICY IF EXISTS "students_insert_guardian" ON students;

CREATE POLICY "students_insert_guardian"
  ON students FOR INSERT
  WITH CHECK (
    is_guardian()
    AND (
      class_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM classes
        WHERE classes.id = students.class_id
          AND classes.is_active = TRUE
      )
    )
  );
