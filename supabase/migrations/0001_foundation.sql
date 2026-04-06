-- ============================================================
-- Escola Sabatina – Foundation Migration (Phase 1)
-- ============================================================

-- ============================================================
-- HELPER: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-insert profile when a user is created via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TABLE: classes
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABLE: class_members
-- ============================================================
CREATE TABLE IF NOT EXISTS class_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'teacher'
               CHECK (role IN ('owner', 'teacher')),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, user_id)
);

CREATE TRIGGER class_members_updated_at
  BEFORE UPDATE ON class_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_class_members_user_id  ON class_members(user_id);
CREATE INDEX IF NOT EXISTS idx_class_members_class_id ON class_members(class_id);

-- ============================================================
-- TABLE: students
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  photo_url      TEXT,
  full_name      TEXT NOT NULL,
  birth_date     DATE,
  sex            TEXT CHECK (sex IN ('masculino', 'feminino')),
  guardian_name  TEXT,
  whatsapp       TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_students_class_id  ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE students      ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an active member of a given class?
CREATE OR REPLACE FUNCTION is_class_member(p_class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM class_members
    WHERE class_id = p_class_id
      AND user_id  = auth.uid()
      AND is_active = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- classes: any member can read; any member can update
CREATE POLICY "classes_select_member"
  ON classes FOR SELECT USING (is_class_member(id));

CREATE POLICY "classes_update_member"
  ON classes FOR UPDATE
  USING (is_class_member(id))
  WITH CHECK (is_class_member(id));

-- class_members: users see only their own memberships
CREATE POLICY "class_members_select_own"
  ON class_members FOR SELECT USING (user_id = auth.uid());

-- students: full CRUD for active class members
CREATE POLICY "students_select_member"
  ON students FOR SELECT USING (is_class_member(class_id));

CREATE POLICY "students_insert_member"
  ON students FOR INSERT WITH CHECK (is_class_member(class_id));

CREATE POLICY "students_update_member"
  ON students FOR UPDATE
  USING (is_class_member(class_id))
  WITH CHECK (is_class_member(class_id));

CREATE POLICY "students_delete_member"
  ON students FOR DELETE USING (is_class_member(class_id));

-- ============================================================
-- STORAGE: student-photos (public bucket, auth-only writes)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  TRUE,       -- public read via CDN URL; write restricted by policy
  5242880,    -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users may upload/update/delete photos
CREATE POLICY "storage_insert_auth"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'student-photos' AND auth.role() = 'authenticated');

CREATE POLICY "storage_update_auth"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'student-photos' AND auth.role() = 'authenticated');

CREATE POLICY "storage_delete_auth"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'student-photos' AND auth.role() = 'authenticated');
