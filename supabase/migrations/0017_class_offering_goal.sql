ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS offering_goal DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION create_class(
  p_name TEXT,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_offering_goal DECIMAL(10,2) DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_class_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF is_guardian() THEN
    RAISE EXCEPTION 'Guardians cannot create classes';
  END IF;

  INSERT INTO classes (name, is_active, offering_goal)
  VALUES (p_name, p_is_active, COALESCE(p_offering_goal, 0))
  RETURNING id INTO v_class_id;

  INSERT INTO class_members (class_id, user_id, role, is_active)
  VALUES (v_class_id, v_user_id, 'owner', TRUE);

  RETURN v_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
