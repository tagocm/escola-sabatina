-- ============================================================
-- Class gallery photos grouped by Sabbath
-- ============================================================

CREATE TABLE IF NOT EXISTS public.class_gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  original_filename TEXT,
  content_type TEXT NOT NULL CHECK (
    content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
  ),
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  tags TEXT[] NOT NULL CHECK (
    cardinality(tags) > 0
    AND tags <@ ARRAY['ofertorio', 'momento_musical', 'carta_missionaria', 'concurso', 'estudo_licao']::TEXT[]
  ),
  caption TEXT,
  uploaded_by UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT class_gallery_photos_storage_path_class_week_check CHECK (
    (storage.foldername(storage_path))[1] = class_id::TEXT
    AND (storage.foldername(storage_path))[2] = week_date::TEXT
  )
);

CREATE INDEX IF NOT EXISTS idx_class_gallery_photos_class_week
  ON public.class_gallery_photos(class_id, week_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_class_gallery_photos_uploaded_by
  ON public.class_gallery_photos(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_class_gallery_photos_tags
  ON public.class_gallery_photos USING GIN (tags);

DROP TRIGGER IF EXISTS class_gallery_photos_updated_at ON public.class_gallery_photos;

CREATE TRIGGER class_gallery_photos_updated_at
  BEFORE UPDATE ON public.class_gallery_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.class_gallery_photos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.class_gallery_photos FROM anon;
GRANT SELECT, INSERT, DELETE ON public.class_gallery_photos TO authenticated;

CREATE OR REPLACE FUNCTION public.is_guardian_of_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.guardian_students
    JOIN public.students
      ON students.id = guardian_students.student_id
    WHERE guardian_students.guardian_id = auth.uid()
      AND students.class_id = p_class_id
      AND students.is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_guardian_of_class(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_guardian_of_class(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_class_gallery_photo(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_gallery_photos
    WHERE class_gallery_photos.storage_path = p_object_name
      AND (
        public.is_class_member(class_gallery_photos.class_id)
        OR public.is_guardian_of_class(class_gallery_photos.class_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_class_gallery_photo(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_class_gallery_photo(TEXT) TO authenticated;

DROP POLICY IF EXISTS "class_gallery_photos_select_teacher" ON public.class_gallery_photos;
DROP POLICY IF EXISTS "class_gallery_photos_select_guardian" ON public.class_gallery_photos;
DROP POLICY IF EXISTS "class_gallery_photos_insert_teacher" ON public.class_gallery_photos;
DROP POLICY IF EXISTS "class_gallery_photos_delete_teacher" ON public.class_gallery_photos;

CREATE POLICY "class_gallery_photos_select_teacher"
  ON public.class_gallery_photos FOR SELECT
  TO authenticated
  USING (public.is_class_member(class_id));

CREATE POLICY "class_gallery_photos_select_guardian"
  ON public.class_gallery_photos FOR SELECT
  TO authenticated
  USING (public.is_guardian_of_class(class_id));

CREATE POLICY "class_gallery_photos_insert_teacher"
  ON public.class_gallery_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_class_member(class_id)
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "class_gallery_photos_delete_teacher"
  ON public.class_gallery_photos FOR DELETE
  TO authenticated
  USING (public.is_class_member(class_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'class-gallery-photos',
  'class-gallery-photos',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "storage_insert_class_gallery_photo_teacher" ON storage.objects;
DROP POLICY IF EXISTS "storage_select_class_gallery_photo_scoped" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_class_gallery_photo_teacher" ON storage.objects;

CREATE POLICY "storage_insert_class_gallery_photo_teacher"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'class-gallery-photos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (storage.foldername(name))[2] ~ '^\d{4}-\d{2}-\d{2}$'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.is_class_member(((storage.foldername(name))[1])::UUID)
      ELSE FALSE
    END
  );

CREATE POLICY "storage_select_class_gallery_photo_scoped"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'class-gallery-photos'
    AND public.can_access_class_gallery_photo(name)
  );

CREATE POLICY "storage_delete_class_gallery_photo_teacher"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'class-gallery-photos'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND CASE
      WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.is_class_member(((storage.foldername(name))[1])::UUID)
      ELSE FALSE
    END
  );
