CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  v_role TEXT := CASE
    WHEN LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'teacher')) = 'guardian' THEN 'guardian'
    ELSE 'teacher'
  END;
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
    role = COALESCE(EXCLUDED.role, profiles.role),
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
