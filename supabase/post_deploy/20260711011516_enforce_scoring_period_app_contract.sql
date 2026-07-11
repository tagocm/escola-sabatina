-- Promote this file into supabase/migrations only after the period-aware
-- application has been deployed and its production smoke tests have passed.
--
-- The previous application initializes attendance_days during reads and saves
-- offerings with direct table updates. Keeping this contract cutover outside
-- the active migration directory prevents a plain `supabase db push` from
-- applying both rollout stages at once.

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.attendance_days
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.attendance_days TO authenticated;

DROP POLICY IF EXISTS "attendance_manage_coordinators"
  ON public.attendance_days;
DROP POLICY IF EXISTS "attendance_days_select_class_members"
  ON public.attendance_days;

CREATE POLICY attendance_days_select_class_members
  ON public.attendance_days FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members
      JOIN public.profiles
        ON profiles.id = class_members.user_id
      WHERE class_members.class_id = attendance_days.class_id
        AND class_members.user_id = (SELECT auth.uid())
        AND class_members.is_active = TRUE
        AND profiles.role = 'teacher'
    )
  );

NOTIFY pgrst, 'reload schema';
