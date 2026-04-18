CREATE TABLE IF NOT EXISTS class_weekly_bible_verses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  verse_text TEXT NOT NULL,
  bible_book TEXT NOT NULL,
  chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
  verse_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, week_date)
);

CREATE INDEX IF NOT EXISTS idx_class_weekly_bible_verses_class_week
  ON class_weekly_bible_verses (class_id, week_date DESC);

CREATE TRIGGER class_weekly_bible_verses_updated_at
  BEFORE UPDATE ON class_weekly_bible_verses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE class_weekly_bible_verses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_bible_verses_select_member"
  ON class_weekly_bible_verses FOR SELECT
  USING (is_class_member(class_id));

CREATE POLICY "weekly_bible_verses_insert_member"
  ON class_weekly_bible_verses FOR INSERT
  WITH CHECK (is_class_member(class_id));

CREATE POLICY "weekly_bible_verses_update_member"
  ON class_weekly_bible_verses FOR UPDATE
  USING (is_class_member(class_id))
  WITH CHECK (is_class_member(class_id));

CREATE POLICY "weekly_bible_verses_delete_member"
  ON class_weekly_bible_verses FOR DELETE
  USING (is_class_member(class_id));
