CREATE POLICY "students_select_historical_attendance_teacher"
  ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM student_attendance_records AS records
      JOIN class_members
        ON class_members.class_id = records.class_id
      WHERE records.student_id = students.id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  );
