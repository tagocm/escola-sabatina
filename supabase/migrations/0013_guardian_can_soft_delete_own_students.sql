CREATE POLICY "students_update_guardian"
  ON students FOR UPDATE
  USING (is_student_guardian(id))
  WITH CHECK (is_student_guardian(id));
