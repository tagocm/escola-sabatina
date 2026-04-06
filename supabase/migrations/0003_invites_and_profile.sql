-- ============================================================
-- Escola Sabatina – Invites and Profile Expansion
-- ============================================================

-- Alter profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('masculino', 'feminino')),
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS last_class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

-- Create class_invites table
CREATE TABLE IF NOT EXISTS class_invites (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id            UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  invited_by_user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token               TEXT NOT NULL UNIQUE,
  email               TEXT,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at             TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on class_invites
ALTER TABLE class_invites ENABLE ROW LEVEL SECURITY;

-- Updated at trigger for invites
CREATE TRIGGER class_invites_updated_at
  BEFORE UPDATE ON class_invites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS Policies for class_invites
-- Only active class members can create invites for their classes
CREATE POLICY "class_invites_insert_member"
  ON class_invites FOR INSERT
  WITH CHECK (is_class_member(class_id));

-- Only the inviter or active class members can see invites
CREATE POLICY "class_invites_select_member"
  ON class_invites FOR SELECT
  USING (is_class_member(class_id));

-- RPC: Generate Invite
CREATE OR REPLACE FUNCTION generate_invite(p_class_id UUID, p_email TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Security check: is caller a member?
  IF NOT is_class_member(p_class_id) THEN
    RAISE EXCEPTION 'Not authorized to invite to this class';
  END IF;

  v_token := encode(gen_random_bytes(16), 'hex');

  INSERT INTO class_invites (class_id, invited_by_user_id, token, email)
  VALUES (p_class_id, auth.uid(), v_token, p_email);

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Redeem Invite
-- This function handles the logic of joining the class and marking the invite as used.
-- Should be called AFTER the user has signed up and is authenticated.
CREATE OR REPLACE FUNCTION redeem_invite(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find valid invite
  SELECT * INTO v_invite
  FROM class_invites
  WHERE token = p_token
    AND is_active = TRUE
    AND used_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite invalid, expired or already used';
  END IF;

  -- Join class
  INSERT INTO class_members (class_id, user_id, role, is_active)
  VALUES (v_invite.class_id, v_user_id, 'teacher', TRUE)
  ON CONFLICT (class_id, user_id) DO UPDATE SET is_active = TRUE;

  -- Mark invite as used
  UPDATE class_invites
  SET used_at = NOW(), is_active = FALSE
  WHERE id = v_invite.id;

  -- Update profile's last_class_id
  UPDATE profiles
  SET last_class_id = v_invite.class_id
  WHERE id = v_user_id;

  RETURN v_invite.class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Update Last Class
CREATE OR REPLACE FUNCTION update_last_class(p_class_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT is_class_member(p_class_id) THEN
    RAISE EXCEPTION 'Not a member of this class';
  END IF;

  UPDATE profiles
  SET last_class_id = p_class_id
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
