ALTER TABLE student_attendance_records
  ADD COLUMN IF NOT EXISTS extra_activity_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discipline_penalty_points INTEGER NOT NULL DEFAULT 0;
