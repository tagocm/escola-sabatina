-- Extend the existing incident hold to Tiago Martini's exact teacher account.
-- The separate guardian identities remain unaffected because the match uses
-- immutable Auth user ids, never names, email aliases, or family links.

CREATE OR REPLACE FUNCTION private.is_teacher_account_access_suspended()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT (SELECT auth.uid()) = ANY (
    ARRAY[
      '51cc1e11-a35d-4bf3-aa62-78974accb2cb',
      '5b93da5f-9d96-4f58-9d18-5d26d89bf409'
    ]::UUID[]
  );
$$;

REVOKE ALL ON FUNCTION private.is_teacher_account_access_suspended() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_teacher_account_access_suspended() TO authenticated;
