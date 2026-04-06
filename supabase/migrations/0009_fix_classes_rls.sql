-- Fix RLS for classes to ensure all authenticated users can see active classes for enrollment
DROP POLICY IF EXISTS "classes_select_guardian" ON classes;
DROP POLICY IF EXISTS "classes_select_member" ON classes;

CREATE POLICY "classes_select_authenticated"
  ON classes FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);

CREATE POLICY "classes_select_members_all"
  ON classes FOR SELECT
  USING (is_class_member(id));
