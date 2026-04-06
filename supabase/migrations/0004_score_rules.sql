-- ============================================================
-- TABLE: class_scoring_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS class_scoring_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('frequencia', 'participacao', 'espiritual', 'atividade')),
  points         INTEGER NOT NULL DEFAULT 1,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  display_order  INTEGER NOT NULL DEFAULT 0,
  rule_type      TEXT NOT NULL DEFAULT 'boolean', -- futurista, por enquanto apenas boolean
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_scoring_rules_class_id ON class_scoring_rules(class_id);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_order    ON class_scoring_rules(display_order);

-- RLS (Row Level Security)
ALTER TABLE class_scoring_rules ENABLE ROW LEVEL SECURITY;

-- Coordenadores podem gerenciar regras de suas classes
CREATE POLICY "rules_manage_coordinators"
  ON class_scoring_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_members.class_id = class_scoring_rules.class_id
      AND class_members.user_id = auth.uid()
      AND class_members.is_active = TRUE
    )
  );

-- Trigger for updated_at
CREATE TRIGGER scoring_rules_updated_at
  BEFORE UPDATE ON class_scoring_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
