CREATE TABLE IF NOT EXISTS class_responsibility_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES class_responsibility_templates(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  participant_count_override INTEGER NOT NULL CHECK (participant_count_override > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_class_responsibility_occurrences_class_date
  ON class_responsibility_occurrences(class_id, scheduled_date);

ALTER TABLE class_responsibility_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "responsibility_occurrences_manage_teachers"
  ON class_responsibility_occurrences FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM class_members
      WHERE class_members.class_id = class_responsibility_occurrences.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM class_members
      WHERE class_members.class_id = class_responsibility_occurrences.class_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
    )
  );

CREATE TRIGGER class_responsibility_occurrences_updated_at
  BEFORE UPDATE ON class_responsibility_occurrences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
