-- ============================================================
-- TABLE: student_attendance_records
-- Tracks when a student's record for a specific day is finalized
-- ============================================================
CREATE TABLE IF NOT EXISTS student_attendance_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id         UUID NOT NULL REFERENCES attendance_days(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  total_points   INTEGER NOT NULL DEFAULT 0,
  saved_by       UUID NOT NULL REFERENCES auth.users(id),
  saved_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(day_id, student_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_attendance_records_day_id ON student_attendance_records(day_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON student_attendance_records(student_id);

-- RLS
ALTER TABLE student_attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_records_manage_coordinators"
  ON student_attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM attendance_days
      JOIN class_members ON class_members.class_id = attendance_days.class_id
      WHERE attendance_days.id = student_attendance_records.day_id
      AND class_members.user_id = auth.uid()
      AND class_members.is_active = TRUE
    )
  );
