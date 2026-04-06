-- ============================================================
-- TABLE: attendance_days
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_days (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_date       DATE NOT NULL,
  total_offering DECIMAL(10, 2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id, day_date)
);

-- ============================================================
-- TABLE: attendance_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id         UUID NOT NULL REFERENCES attendance_days(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  rule_id        UUID NOT NULL REFERENCES class_scoring_rules(id) ON DELETE CASCADE,
  points_earned  INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(day_id, student_id, rule_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_attendance_days_class_id ON attendance_days(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_scores_day_student ON attendance_scores(day_id, student_id);

-- RLS
ALTER TABLE attendance_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_scores ENABLE ROW LEVEL SECURITY;

-- Coordinators manage their class attendance
CREATE POLICY "attendance_manage_coordinators"
  ON attendance_days FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_members.class_id = attendance_days.class_id
      AND class_members.user_id = auth.uid()
      AND class_members.is_active = TRUE
    )
  );

CREATE POLICY "scores_manage_coordinators"
  ON attendance_scores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM attendance_days
      JOIN class_members ON class_members.class_id = attendance_days.class_id
      WHERE attendance_days.id = attendance_scores.day_id
      AND class_members.user_id = auth.uid()
      AND class_members.is_active = TRUE
    )
  );

-- Trigger for attendance_days updated_at
CREATE TRIGGER attendance_days_updated_at
  BEFORE UPDATE ON attendance_days
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
