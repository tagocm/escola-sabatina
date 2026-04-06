-- ============================================================
-- Escola Sabatina – Classes RPC Migration
-- ============================================================

CREATE OR REPLACE FUNCTION create_class(p_name TEXT, p_is_active BOOLEAN DEFAULT TRUE)
RETURNS UUID AS $$
DECLARE
  v_class_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO classes (name, is_active)
  VALUES (p_name, p_is_active)
  RETURNING id INTO v_class_id;

  INSERT INTO class_members (class_id, user_id, role, is_active)
  VALUES (v_class_id, v_user_id, 'owner', TRUE);

  RETURN v_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
