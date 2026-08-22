-- Restore Tiago Martini's teacher account to normal application access.
-- Ana Paula Lopes's exact teacher identity remains under review; no account is
-- matched by name, email address, or family relationship.

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
