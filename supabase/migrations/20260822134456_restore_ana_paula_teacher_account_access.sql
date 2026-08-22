-- Restore Ana Paula Lopes's teacher account to normal application access.
-- The temporary hold infrastructure remains available, but no Auth identity is
-- currently suspended. No account is matched by name, email, or family link.

CREATE OR REPLACE FUNCTION private.is_teacher_account_access_suspended()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT FALSE;
$$;

REVOKE ALL ON FUNCTION private.is_teacher_account_access_suspended() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_teacher_account_access_suspended() TO authenticated;
