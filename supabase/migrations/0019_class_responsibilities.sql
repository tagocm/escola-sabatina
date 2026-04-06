CREATE TABLE IF NOT EXISTS class_responsibility_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  participant_count INTEGER NOT NULL DEFAULT 1 CHECK (participant_count > 0),
  frequency_weeks INTEGER NOT NULL DEFAULT 1 CHECK (frequency_weeks > 0),
  message_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_responsibility_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES class_responsibility_templates(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  slot_index INTEGER NOT NULL DEFAULT 0 CHECK (slot_index >= 0),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, scheduled_date, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_class_responsibility_templates_class_id
  ON class_responsibility_templates(class_id);
CREATE INDEX IF NOT EXISTS idx_class_responsibility_assignments_class_date
  ON class_responsibility_assignments(class_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_class_responsibility_assignments_student
  ON class_responsibility_assignments(student_id);

ALTER TABLE class_responsibility_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_responsibility_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "responsibility_templates_manage_teachers"
  ON class_responsibility_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM class_members
      WHERE class_members.class_id = class_responsibility_templates.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM class_members
      WHERE class_members.class_id = class_responsibility_templates.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  );

CREATE POLICY "responsibility_assignments_manage_teachers"
  ON class_responsibility_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM class_members
      WHERE class_members.class_id = class_responsibility_assignments.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM class_members
      WHERE class_members.class_id = class_responsibility_assignments.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  );

CREATE TRIGGER class_responsibility_templates_updated_at
  BEFORE UPDATE ON class_responsibility_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER class_responsibility_assignments_updated_at
  BEFORE UPDATE ON class_responsibility_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
