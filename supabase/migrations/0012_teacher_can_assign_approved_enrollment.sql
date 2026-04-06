-- ============================================================
-- Allow teachers to assign class_id when approving pending requests
-- ============================================================

CREATE POLICY "students_update_pending_request_teacher"
  ON students FOR UPDATE
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
  )
  WITH CHECK (
    is_class_member(class_id)
  );
