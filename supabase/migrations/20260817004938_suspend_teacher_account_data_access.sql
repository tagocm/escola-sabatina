-- Targeted incident hold: suspend only Ana Paula Lopes's teacher account.
-- The separate guardian account remains unaffected because this policy matches
-- the teacher auth user id, never the person's name, phone number, or email.

CREATE OR REPLACE FUNCTION private.is_teacher_account_access_suspended()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT (SELECT auth.uid()) = '51cc1e11-a35d-4bf3-aa62-78974accb2cb'::UUID;
$$;

REVOKE ALL ON FUNCTION private.is_teacher_account_access_suspended() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_teacher_account_access_suspended() TO authenticated;

-- A restrictive policy is combined with every existing permissive policy, so
-- the held teacher cannot read or write application rows through PostgREST.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles',
    'classes',
    'class_members',
    'students',
    'class_invites',
    'class_scoring_rules',
    'attendance_days',
    'attendance_scores',
    'student_attendance_records',
    'guardian_students',
    'enrollment_requests',
    'class_responsibility_templates',
    'class_responsibility_assignments',
    'class_responsibility_occurrences',
    'class_weekly_bible_verses',
    'attendance_discipline_events',
    'guardian_mailbox_dismissals',
    'scoring_audit_log',
    'class_gallery_photos',
    'academic_terms',
    'academic_term_saturdays',
    'class_scoring_periods',
    'class_scoring_period_students',
    'class_scoring_period_rules',
    'class_scoring_period_lifecycle',
    'class_scoring_period_findings',
    'class_scoring_period_annotations',
    'class_scoring_period_result_revisions',
    'class_scoring_period_results'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS teacher_account_access_hold ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY teacher_account_access_hold ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT private.is_teacher_account_access_suspended()) WITH CHECK (NOT private.is_teacher_account_access_suspended())',
      table_name
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS teacher_account_access_hold ON storage.objects;
CREATE POLICY teacher_account_access_hold
  ON storage.objects AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (NOT private.is_teacher_account_access_suspended())
  WITH CHECK (NOT private.is_teacher_account_access_suspended());

CREATE OR REPLACE FUNCTION private.prevent_teacher_account_data_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF private.is_teacher_account_access_suspended() THEN
    RAISE EXCEPTION 'Conta suspensa para averiguação.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_teacher_account_data_mutation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.prevent_teacher_account_data_mutation() TO authenticated;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles',
    'classes',
    'class_members',
    'students',
    'class_invites',
    'class_scoring_rules',
    'attendance_days',
    'attendance_scores',
    'student_attendance_records',
    'guardian_students',
    'enrollment_requests',
    'class_responsibility_templates',
    'class_responsibility_assignments',
    'class_responsibility_occurrences',
    'class_weekly_bible_verses',
    'attendance_discipline_events',
    'guardian_mailbox_dismissals',
    'scoring_audit_log',
    'class_gallery_photos',
    'academic_terms',
    'academic_term_saturdays',
    'class_scoring_periods',
    'class_scoring_period_students',
    'class_scoring_period_rules',
    'class_scoring_period_lifecycle',
    'class_scoring_period_findings',
    'class_scoring_period_annotations',
    'class_scoring_period_result_revisions',
    'class_scoring_period_results'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS teacher_account_access_hold_trigger ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER teacher_account_access_hold_trigger BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.prevent_teacher_account_data_mutation()',
      table_name
    );
  END LOOP;
END;
$$;

-- Keep SECURITY DEFINER helpers and write RPCs closed as well; restrictive
-- table policies do not apply inside SECURITY DEFINER functions owned by the
-- database administrator.
CREATE OR REPLACE FUNCTION public.is_class_member(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
  SELECT NOT private.is_teacher_account_access_suspended()
    AND EXISTS (
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
SET search_path = public, private
AS $$
  SELECT NOT private.is_teacher_account_access_suspended()
    AND EXISTS (
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
SET search_path = public, private
AS $$
  SELECT NOT private.is_teacher_account_access_suspended()
    AND EXISTS (
      SELECT 1
      FROM public.guardian_students
      WHERE guardian_id = auth.uid()
        AND student_id = p_student_id
    );
$$;

CREATE OR REPLACE FUNCTION private.is_scoring_period_teacher(p_period_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
  SELECT NOT private.is_teacher_account_access_suspended()
    AND EXISTS (
      SELECT 1
      FROM public.class_scoring_periods AS periods
      JOIN public.class_members
        ON class_members.class_id = periods.class_id
      JOIN public.profiles
        ON profiles.id = class_members.user_id
      WHERE periods.id = p_period_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
        AND profiles.role = 'teacher'
    );
$$;

CREATE OR REPLACE FUNCTION private.is_scoring_period_guardian(p_period_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
  SELECT NOT private.is_teacher_account_access_suspended()
    AND EXISTS (
      SELECT 1
      FROM public.class_scoring_period_students AS participants
      JOIN public.guardian_students
        ON guardian_students.student_id = participants.student_id
      WHERE participants.period_id = p_period_id
        AND guardian_students.guardian_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION private.is_scoring_period_owner(p_period_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
  SELECT NOT private.is_teacher_account_access_suspended()
    AND EXISTS (
      SELECT 1
      FROM public.class_scoring_periods AS periods
      JOIN public.class_members
        ON class_members.class_id = periods.class_id
      JOIN public.profiles
        ON profiles.id = class_members.user_id
      WHERE periods.id = p_period_id
        AND class_members.user_id = auth.uid()
        AND class_members.is_active = TRUE
        AND class_members.role = 'owner'
        AND profiles.role = 'teacher'
    );
$$;

-- RPCs whose authorization is not delegated to one of the helpers above must
-- fail closed for the held teacher as well.
CREATE OR REPLACE FUNCTION public.create_class(
  p_name TEXT,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_offering_goal NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_class_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF private.is_teacher_account_access_suspended() THEN
    RAISE EXCEPTION 'Conta suspensa para averiguação.';
  END IF;

  IF is_guardian() THEN
    RAISE EXCEPTION 'Guardians cannot create classes';
  END IF;

  INSERT INTO public.classes (name, is_active, offering_goal)
  VALUES (p_name, p_is_active, COALESCE(p_offering_goal, 0))
  RETURNING id INTO v_class_id;

  INSERT INTO public.class_members (class_id, user_id, role, is_active)
  VALUES (v_class_id, v_user_id, 'owner', TRUE);

  RETURN v_class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID := auth.uid();
  v_user_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF private.is_teacher_account_access_suspended() THEN
    RAISE EXCEPTION 'Conta suspensa para averiguação.';
  END IF;

  SELECT * INTO v_invite
  FROM public.class_invites
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

  INSERT INTO public.class_members (class_id, user_id, role, is_active)
  VALUES (v_invite.class_id, v_user_id, 'teacher', TRUE)
  ON CONFLICT (class_id, user_id) DO UPDATE SET is_active = TRUE;

  UPDATE public.class_invites
  SET used_at = NOW(), is_active = FALSE
  WHERE id = v_invite.id;

  UPDATE public.profiles
  SET last_class_id = v_invite.class_id
  WHERE id = v_user_id;

  RETURN v_invite.class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_invite_data(p_token TEXT)
RETURNS TABLE (
  token TEXT,
  class_id UUID,
  class_name TEXT,
  invited_by_full_name TEXT,
  email TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF private.is_teacher_account_access_suspended() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ci.token,
    ci.class_id,
    c.name AS class_name,
    p.full_name AS invited_by_full_name,
    ci.email,
    ci.expires_at
  FROM public.class_invites AS ci
  JOIN public.classes AS c ON c.id = ci.class_id
  LEFT JOIN public.profiles AS p ON p.id = ci.invited_by_user_id
  WHERE ci.token = p_token
    AND ci.is_active = TRUE
    AND ci.used_at IS NULL
    AND ci.expires_at > NOW()
  LIMIT 1;
END;
$$;
