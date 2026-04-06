UPDATE storage.buckets
SET public = FALSE
WHERE id = 'student-photos';

DROP POLICY IF EXISTS "storage_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "storage_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_auth" ON storage.objects;
DROP POLICY IF EXISTS "storage_select_auth" ON storage.objects;

CREATE POLICY "storage_select_auth"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos' AND auth.role() = 'authenticated');

CREATE POLICY "storage_insert_scoped"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-photos'
    AND auth.role() = 'authenticated'
    AND (
      (
        (storage.foldername(name))[1] = 'guardians'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
      OR (
        COALESCE((storage.foldername(name))[1], '') ~* '^[0-9a-f-]{36}$'
        AND EXISTS (
          SELECT 1
          FROM class_members
          WHERE class_members.class_id = ((storage.foldername(name))[1])::uuid
            AND class_members.user_id = auth.uid()
            AND class_members.is_active = TRUE
        )
      )
    )
  );

CREATE POLICY "storage_update_scoped"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-photos'
    AND auth.role() = 'authenticated'
    AND (
      (
        (storage.foldername(name))[1] = 'guardians'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
      OR (
        COALESCE((storage.foldername(name))[1], '') ~* '^[0-9a-f-]{36}$'
        AND EXISTS (
          SELECT 1
          FROM class_members
          WHERE class_members.class_id = ((storage.foldername(name))[1])::uuid
            AND class_members.user_id = auth.uid()
            AND class_members.is_active = TRUE
        )
      )
    )
  );

CREATE POLICY "storage_delete_scoped"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'student-photos'
    AND auth.role() = 'authenticated'
    AND (
      (
        (storage.foldername(name))[1] = 'guardians'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
      OR (
        COALESCE((storage.foldername(name))[1], '') ~* '^[0-9a-f-]{36}$'
        AND EXISTS (
          SELECT 1
          FROM class_members
          WHERE class_members.class_id = ((storage.foldername(name))[1])::uuid
            AND class_members.user_id = auth.uid()
            AND class_members.is_active = TRUE
        )
      )
    )
  );

UPDATE public.students
SET photo_url = regexp_replace(
  regexp_replace(photo_url, '^https?://[^/]+/storage/v1/object/(?:public|sign)/student-photos/', ''),
  '\\?.*$',
  ''
)
WHERE photo_url ~ '/storage/v1/object/(?:public|sign)/student-photos/';

CREATE OR REPLACE FUNCTION public.generate_invite(p_class_id UUID, p_email TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT is_class_member(p_class_id) THEN
    RAISE EXCEPTION 'Not authorized to invite to this class';
  END IF;

  v_token := encode(gen_random_bytes(16), 'hex');

  INSERT INTO class_invites (class_id, invited_by_user_id, token, email)
  VALUES (p_class_id, auth.uid(), v_token, NULLIF(LOWER(TRIM(p_email)), ''));

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.redeem_invite(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID := auth.uid();
  v_user_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM class_invites
  WHERE token = p_token
    AND is_active = TRUE
    AND used_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite invalid, expired or already used';
  END IF;

  IF v_invite.email IS NOT NULL AND LOWER(v_invite.email) <> v_user_email THEN
    RAISE EXCEPTION 'Invite not valid for this email';
  END IF;

  INSERT INTO class_members (class_id, user_id, role, is_active)
  VALUES (v_invite.class_id, v_user_id, 'teacher', TRUE)
  ON CONFLICT (class_id, user_id) DO UPDATE SET is_active = TRUE;

  UPDATE class_invites
  SET used_at = NOW(), is_active = FALSE
  WHERE id = v_invite.id;

  UPDATE profiles
  SET last_class_id = v_invite.class_id
  WHERE id = v_user_id;

  RETURN v_invite.class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_last_class(p_class_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT is_class_member(p_class_id) THEN
    RAISE EXCEPTION 'Not a member of this class';
  END IF;

  UPDATE profiles
  SET last_class_id = p_class_id
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_class(
  p_name TEXT,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_offering_goal NUMERIC DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_class_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF is_guardian() THEN
    RAISE EXCEPTION 'Guardians cannot create classes';
  END IF;

  INSERT INTO classes (name, is_active, offering_goal)
  VALUES (p_name, p_is_active, COALESCE(p_offering_goal, 0))
  RETURNING id INTO v_class_id;

  INSERT INTO class_members (class_id, user_id, role, is_active)
  VALUES (v_class_id, v_user_id, 'owner', TRUE);

  RETURN v_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
