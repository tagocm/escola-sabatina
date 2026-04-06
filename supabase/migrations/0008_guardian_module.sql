-- ============================================================
-- Escola Sabatina – Guardian Module Migration
-- ============================================================

-- ============================================================
-- 1. Add role column to profiles
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'teacher'
    CHECK (role IN ('teacher', 'guardian'));

-- ============================================================
-- 2. Make students.class_id NULLABLE
--    Guardians create children before enrollment approval
-- ============================================================
ALTER TABLE students ALTER COLUMN class_id DROP NOT NULL;

-- ============================================================
-- 3. TABLE: guardian_students
--    Links a guardian (profile) to their children (students)
-- ============================================================
CREATE TABLE IF NOT EXISTS guardian_students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(guardian_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_students_guardian ON guardian_students(guardian_id);
CREATE INDEX IF NOT EXISTS idx_guardian_students_student  ON guardian_students(student_id);

ALTER TABLE guardian_students ENABLE ROW LEVEL SECURITY;

-- Guardian can only see/manage their own children links
CREATE POLICY "guardian_students_select_own"
  ON guardian_students FOR SELECT
  USING (guardian_id = auth.uid());

CREATE POLICY "guardian_students_insert_own"
  ON guardian_students FOR INSERT
  WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "guardian_students_delete_own"
  ON guardian_students FOR DELETE
  USING (guardian_id = auth.uid());

-- ============================================================
-- 4. TABLE: enrollment_requests
--    Guardian requests to enroll a child in a class
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollment_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  UUID REFERENCES profiles(id),
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_class   ON enrollment_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_student ON enrollment_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_status  ON enrollment_requests(status);

CREATE TRIGGER enrollment_requests_updated_at
  BEFORE UPDATE ON enrollment_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE enrollment_requests ENABLE ROW LEVEL SECURITY;

-- Guardian sees only their own requests
CREATE POLICY "enrollment_requests_select_guardian"
  ON enrollment_requests FOR SELECT
  USING (requested_by = auth.uid());

-- Guardian can create requests for their own children
CREATE POLICY "enrollment_requests_insert_guardian"
  ON enrollment_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM guardian_students
      WHERE guardian_students.guardian_id = auth.uid()
      AND guardian_students.student_id = enrollment_requests.student_id
    )
  );

-- Teachers can see requests targeting their classes
CREATE POLICY "enrollment_requests_select_teacher"
  ON enrollment_requests FOR SELECT
  USING (is_class_member(class_id));

-- Teachers can update (approve/reject) requests for their classes
CREATE POLICY "enrollment_requests_update_teacher"
  ON enrollment_requests FOR UPDATE
  USING (is_class_member(class_id))
  WITH CHECK (is_class_member(class_id));

-- ============================================================
-- 5. Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION is_guardian()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'guardian'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is the user the guardian of a given student?
CREATE OR REPLACE FUNCTION is_student_guardian(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM guardian_students
    WHERE guardian_id = auth.uid()
    AND student_id = p_student_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 6. Revised RLS for classes: allow guardians to READ (search)
-- ============================================================
-- Allow guardians to select active classes (for enrollment search)
CREATE POLICY "classes_select_guardian"
  ON classes FOR SELECT
  USING (
    is_guardian() AND is_active = TRUE
  );

-- ============================================================
-- 7. Revised RLS for students: allow guardians to manage own children
-- ============================================================
-- Guardian can see their own children (even without class)
CREATE POLICY "students_select_guardian"
  ON students FOR SELECT
  USING (is_student_guardian(id));

-- Guardian can insert students (children) without class
CREATE POLICY "students_insert_guardian"
  ON students FOR INSERT
  WITH CHECK (
    is_guardian()
    AND class_id IS NULL
  );

-- ============================================================
-- 8. Protect create_class RPC against guardians
-- ============================================================
CREATE OR REPLACE FUNCTION create_class(p_name TEXT, p_is_active BOOLEAN DEFAULT TRUE)
RETURNS UUID AS $$
DECLARE
  v_class_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Block guardians from creating classes
  IF is_guardian() THEN
    RAISE EXCEPTION 'Guardians cannot create classes';
  END IF;

  INSERT INTO classes (name, is_active)
  VALUES (p_name, p_is_active)
  RETURNING id INTO v_class_id;

  INSERT INTO class_members (class_id, user_id, role, is_active)
  VALUES (v_class_id, v_user_id, 'owner', TRUE);

  RETURN v_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
