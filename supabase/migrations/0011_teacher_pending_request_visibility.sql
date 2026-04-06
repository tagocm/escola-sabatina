-- ============================================================
-- Allow teachers to inspect pending enrollment request relations
-- ============================================================

CREATE POLICY "students_select_pending_request_teacher"
  ON students FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM enrollment_requests
      JOIN class_members
        ON class_members.class_id = enrollment_requests.class_id
      WHERE enrollment_requests.student_id = students.id
        AND enrollment_requests.status = 'pending'
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  );

CREATE POLICY "profiles_select_pending_request_teacher"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM enrollment_requests
      JOIN class_members
        ON class_members.class_id = enrollment_requests.class_id
      WHERE enrollment_requests.requested_by = profiles.id
        AND enrollment_requests.status = 'pending'
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  );
