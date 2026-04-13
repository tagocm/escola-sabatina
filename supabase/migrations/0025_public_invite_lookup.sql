-- ============================================================
-- Escola Sabatina – Public invite lookup for signup page
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_invite_data(p_token TEXT)
RETURNS TABLE (
  token TEXT,
  class_id UUID,
  class_name TEXT,
  invited_by_full_name TEXT,
  email TEXT,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.token,
    ci.class_id,
    c.name AS class_name,
    p.full_name AS invited_by_full_name,
    ci.email,
    ci.expires_at
  FROM public.class_invites ci
  JOIN public.classes c ON c.id = ci.class_id
  LEFT JOIN public.profiles p ON p.id = ci.invited_by_user_id
  WHERE ci.token = p_token
    AND ci.is_active = TRUE
    AND ci.used_at IS NULL
    AND ci.expires_at > NOW()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
