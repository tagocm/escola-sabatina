-- ============================================================
-- Security hardening for roles, guardian enrollment, and photos
-- ============================================================

-- SECURITY DEFINER helpers should not depend on a caller-controlled search_path.
CREATE OR REPLACE FUNCTION public.is_class_member(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_members
    WHERE class_id = p_class_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_guardian()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'guardian'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student_guardian(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.guardian_students
    WHERE guardian_id = auth.uid()
      AND student_id = p_student_id
  );
$$;

-- Public/no-invite signups must never become teachers from user-controlled metadata.
-- Teacher accounts are created only when a valid invite token is redeemed during signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  v_role TEXT := 'guardian';
  v_whatsapp TEXT := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'whatsapp', '')), '');
  v_sex TEXT := CASE
    WHEN LOWER(COALESCE(NEW.raw_user_meta_data->>'sex', '')) IN ('masculino', 'feminino')
      THEN LOWER(NEW.raw_user_meta_data->>'sex')
    ELSE NULL
  END;
  v_birth_date DATE := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'birth_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (NEW.raw_user_meta_data->>'birth_date')::date
    ELSE NULL
  END;
  v_invite_token TEXT := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');
  v_invite RECORD;
  v_last_class_id UUID := NULL;
BEGIN
  IF v_invite_token IS NOT NULL THEN
    SELECT *
    INTO v_invite
    FROM public.class_invites
    WHERE token = v_invite_token
      AND is_active = TRUE
      AND used_at IS NULL
      AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invite invalid, expired or already used';
    END IF;

    IF v_invite.email IS NOT NULL AND LOWER(v_invite.email) <> LOWER(NEW.email) THEN
      RAISE EXCEPTION 'Invite not valid for this email';
    END IF;

    v_last_class_id := v_invite.class_id;
    v_role := 'teacher';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    whatsapp,
    sex,
    birth_date,
    last_class_id
  )
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    v_role,
    v_whatsapp,
    v_sex,
    v_birth_date,
    v_last_class_id
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    role = CASE
      WHEN v_invite_token IS NOT NULL THEN 'teacher'
      ELSE profiles.role
    END,
    whatsapp = COALESCE(EXCLUDED.whatsapp, profiles.whatsapp),
    sex = COALESCE(EXCLUDED.sex, profiles.sex),
    birth_date = COALESCE(EXCLUDED.birth_date, profiles.birth_date),
    last_class_id = COALESCE(EXCLUDED.last_class_id, profiles.last_class_id);

  IF v_invite_token IS NOT NULL THEN
    INSERT INTO public.class_members (class_id, user_id, role, is_active)
    VALUES (v_invite.class_id, NEW.id, 'teacher', TRUE)
    ON CONFLICT (class_id, user_id) DO UPDATE SET is_active = TRUE;

    UPDATE public.class_invites
    SET used_at = NOW(), is_active = FALSE
    WHERE id = v_invite.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Defense in depth: even if column privileges drift later, authenticated users
-- cannot mutate their own identity/authorization fields through profile updates.
CREATE OR REPLACE FUNCTION public.prevent_profile_identity_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id
    AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.role IS DISTINCT FROM OLD.role
    )
  THEN
    RAISE EXCEPTION 'Profile identity fields cannot be changed by the current user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_identity_update ON public.profiles;

CREATE TRIGGER prevent_profile_identity_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_identity_update();

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, sex, birth_date, whatsapp) ON public.profiles TO authenticated;

-- Keep active class selection behind the membership-checked RPC instead of direct profile writes.
CREATE OR REPLACE FUNCTION public.update_last_class(p_class_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_class_member(p_class_id) THEN
    RAISE EXCEPTION 'Not a member of this class';
  END IF;

  UPDATE public.profiles
  SET last_class_id = p_class_id
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.update_last_class(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_last_class(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_student_photo_path_spoofing()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_first_folder TEXT := (storage.foldername(NEW.photo_url))[1];
  v_second_folder TEXT := (storage.foldername(NEW.photo_url))[2];
BEGIN
  IF v_user_id IS NULL OR NEW.photo_url IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.photo_url IS NOT DISTINCT FROM OLD.photo_url THEN
    RETURN NEW;
  END IF;

  IF public.is_guardian() THEN
    IF v_first_folder = 'guardians' AND v_second_folder = v_user_id::TEXT THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Invalid guardian student photo path';
  END IF;

  IF NEW.class_id IS NOT NULL
    AND public.is_class_member(NEW.class_id)
    AND v_first_folder = NEW.class_id::TEXT
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid teacher student photo path';
END;
$$;

DROP TRIGGER IF EXISTS prevent_student_photo_path_spoofing ON public.students;

CREATE TRIGGER prevent_student_photo_path_spoofing
  BEFORE INSERT OR UPDATE OF photo_url ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.prevent_student_photo_path_spoofing();

-- Guardians can request enrollment while creating a child, but they cannot
-- directly assign class_id and bypass teacher approval.
CREATE OR REPLACE FUNCTION public.register_guardian_student(
  p_id UUID,
  p_full_name TEXT,
  p_birth_date DATE,
  p_sex TEXT,
  p_guardian_name TEXT,
  p_whatsapp TEXT,
  p_photo_url TEXT,
  p_class_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_guardian() THEN
    RAISE EXCEPTION 'Only guardians can register dependents';
  END IF;

  IF EXISTS (SELECT 1 FROM public.students WHERE id = p_id) THEN
    RAISE EXCEPTION 'Student ID collision. Student already exists.';
  END IF;

  IF p_photo_url IS NOT NULL
    AND (
      (storage.foldername(p_photo_url))[1] IS DISTINCT FROM 'guardians'
      OR (storage.foldername(p_photo_url))[2] IS DISTINCT FROM v_user_id::TEXT
    )
  THEN
    RAISE EXCEPTION 'Invalid guardian student photo path';
  END IF;

  INSERT INTO public.students (
    id,
    full_name,
    birth_date,
    sex,
    guardian_name,
    whatsapp,
    photo_url,
    class_id,
    is_active
  ) VALUES (
    p_id,
    p_full_name,
    p_birth_date,
    p_sex,
    p_guardian_name,
    p_whatsapp,
    p_photo_url,
    NULL,
    TRUE
  );

  INSERT INTO public.guardian_students (guardian_id, student_id)
  VALUES (v_user_id, p_id);

  IF p_class_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.classes
      WHERE id = p_class_id
        AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Invalid class for enrollment request';
    END IF;

    INSERT INTO public.enrollment_requests (student_id, class_id, requested_by, status)
    VALUES (p_id, p_class_id, v_user_id, 'pending')
    ON CONFLICT (student_id, class_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.register_guardian_student(UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_guardian_student(UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_student_photo(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students
    WHERE students.photo_url = p_object_name
      AND (
        public.is_student_guardian(students.id)
        OR (
          students.class_id IS NOT NULL
          AND public.is_class_member(students.class_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.enrollment_requests
          WHERE enrollment_requests.student_id = students.id
            AND enrollment_requests.status = 'pending'
            AND public.is_class_member(enrollment_requests.class_id)
        )
      )
  );
$$;

DROP POLICY IF EXISTS "storage_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "storage_select_student_photo_scoped" ON storage.objects;

CREATE POLICY "storage_select_student_photo_scoped"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-photos'
    AND auth.role() = 'authenticated'
    AND public.can_access_student_photo(name)
  );
