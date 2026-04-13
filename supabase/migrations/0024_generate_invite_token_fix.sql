-- ============================================================
-- Escola Sabatina – Fix invite token generation on remote DB
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_invite(p_class_id UUID, p_email TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT is_class_member(p_class_id) THEN
    RAISE EXCEPTION 'Not authorized to invite to this class';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO class_invites (class_id, invited_by_user_id, token, email)
  VALUES (p_class_id, auth.uid(), v_token, p_email);

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
