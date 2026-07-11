-- Transactionally rolled-back lifecycle contract test for a disposable clone.
-- Run after the main migration and before the post-deploy cutover, never
-- against production. The suite intentionally verifies legacy write
-- compatibility that the cutover later revokes.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition BOOLEAN, p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT COALESCE(p_condition, FALSE) THEN
    RAISE EXCEPTION 'assertion failed: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql TEXT, p_message_pattern TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected error was not raised';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'expected error was not raised'
       OR SQLERRM NOT LIKE p_message_pattern THEN
      RAISE;
    END IF;
END;
$$;

INSERT INTO auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'authenticated', 'authenticated', 'owner@example.test', '{}', '{}', NOW(), NOW()
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    'authenticated', 'authenticated', 'guardian@example.test', '{}', '{}', NOW(), NOW()
  );

INSERT INTO public.profiles (id, full_name, email, role)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Responsável local', 'owner@example.test', 'teacher'
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    'Responsável familiar', 'guardian@example.test', 'guardian'
  );

-- A dynamic term makes the mid-term opening test independent of wall-clock day.
WITH business_day AS (
  SELECT private.current_sao_paulo_date() AS today
), bounds AS (
  SELECT
    today - (((EXTRACT(ISODOW FROM today)::INTEGER - 6 + 7) % 7) + 7) AS start_date
  FROM business_day
)
INSERT INTO public.academic_terms (
  id, year, term_number, name, start_date, end_date, expected_saturdays, status
)
SELECT
  '60606060-6060-4060-8060-606060606060',
  2099,
  1,
  'Termo dinâmico local',
  bounds.start_date,
  bounds.start_date + 84,
  13,
  'active'
FROM bounds;

INSERT INTO public.academic_term_saturdays (term_id, week_number, saturday_date)
SELECT
  '60606060-6060-4060-8060-606060606060',
  weeks.week_number,
  terms.start_date + ((weeks.week_number - 1) * 7)
FROM public.academic_terms AS terms
CROSS JOIN generate_series(1, 13) AS weeks(week_number)
WHERE terms.id = '60606060-6060-4060-8060-606060606060';

INSERT INTO public.classes (id, name, is_active, offering_goal)
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Turma origem', TRUE, 100),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Turma destino', TRUE, 50),
  ('66666666-6666-4666-8666-666666666666', 'Turma meio do termo', TRUE, 30),
  ('77777777-7777-4777-8777-777777777777', 'Destino ainda draft', TRUE, 20);

INSERT INTO public.class_members (class_id, user_id, role, is_active)
SELECT
  classes.id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'owner',
  TRUE
FROM public.classes
WHERE classes.id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777'
);

INSERT INTO public.students (id, class_id, full_name, is_active)
VALUES
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Aluno histórico', TRUE
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    '66666666-6666-4666-8666-666666666666',
    'Aluno de abertura tardia', TRUE
  );

INSERT INTO public.class_scoring_rules (
  id, class_id, name, category, points, is_active, display_order, rule_type
)
VALUES
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Regra origem', 'participacao', 5, TRUE, 1, 'boolean'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Regra destino', 'participacao', 7, TRUE, 1, 'boolean'
  ),
  (
    '21212121-2121-4121-8121-212121212121',
    '66666666-6666-4666-8666-666666666666',
    'Regra meio do termo', 'participacao', 3, TRUE, 1, 'boolean'
  );

SELECT pg_temp.assert_true(
  (
    SELECT COUNT(*) = 12
    FROM public.class_scoring_periods AS periods
    WHERE periods.class_id IN (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '66666666-6666-4666-8666-666666666666',
      '77777777-7777-4777-8777-777777777777'
    )
      AND periods.status = 'draft'
  ),
  'bootstrap must create Q3, Q4 and the dynamic active term as drafts'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM public.class_scoring_period_students AS participants
    JOIN public.class_scoring_periods AS periods ON periods.id = participants.period_id
    WHERE periods.class_id = '66666666-6666-4666-8666-666666666666'
  ),
  'draft bootstrap must not snapshot students'
);

-- Keep the synthetic term scoped to the two classes used by its dynamic test;
-- real academic terms must not overlap for the same class.
DELETE FROM public.class_scoring_periods
WHERE term_id = '60606060-6060-4060-8060-606060606060'
  AND class_id IN (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  );

-- Historical Q2 fixture plus a target Q2 period used to exercise lifecycle.
INSERT INTO public.class_scoring_periods (
  id, class_id, term_id, status, offering_goal_snapshot, closed_at, closed_reason
)
SELECT
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  terms.id,
  'closed_pending_audit',
  100,
  NOW(),
  'Histórico local'
FROM public.academic_terms AS terms
WHERE terms.year = 2026 AND terms.term_number = 2;

INSERT INTO public.class_scoring_periods (
  id, class_id, term_id, status, offering_goal_snapshot
)
SELECT
  '23232323-2323-4323-8323-232323232323',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  terms.id,
  'draft',
  50
FROM public.academic_terms AS terms
WHERE terms.year = 2026 AND terms.term_number = 2;

INSERT INTO public.class_scoring_period_students (
  id, period_id, class_id, student_id, student_name_snapshot, status, source, joined_on
)
VALUES
  (
    '33333333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'Aluno histórico', 'active', 'historical_record', DATE '2026-04-11'
  ),
  (
    '34343434-3434-4434-8434-343434343434',
    '23232323-2323-4323-8323-232323232323',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'Aluno histórico', 'active', 'historical_record', DATE '2026-04-11'
  );

INSERT INTO public.class_scoring_period_rules (
  id, period_id, class_id, source_rule_id, name, category, points,
  is_active, display_order, variant_kind, effective_from, effective_until
)
VALUES
  (
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'Regra origem', 'participacao', 5, TRUE, 1, 'declared',
    DATE '2026-04-11', DATE '2026-07-04'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'Regra origem legada', 'participacao', 3, FALSE, 1, 'legacy_observed',
    DATE '2026-04-11', DATE '2026-07-04'
  ),
  (
    '45454545-4545-4545-8545-454545454545',
    '23232323-2323-4323-8323-232323232323',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '11111111-1111-4111-8111-111111111111',
    'Regra destino', 'participacao', 7, TRUE, 1, 'declared',
    DATE '2026-04-11', DATE '2026-07-04'
  );

-- Simulate the state at tomorrow's rollover without weakening the date gate.
UPDATE public.class_scoring_periods AS periods
SET
  status = 'open',
  offering_goal_snapshot = CASE
    WHEN periods.class_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' THEN 100
    ELSE 50
  END
FROM public.academic_terms AS terms
WHERE terms.id = periods.term_id
  AND terms.year = 2026
  AND terms.term_number = 3
  AND periods.class_id IN (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  );

INSERT INTO public.class_scoring_period_students (
  period_id, class_id, student_id, student_name_snapshot, status, source, joined_on
)
SELECT
  periods.id,
  periods.class_id,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Aluno histórico',
  'active',
  'manual',
  DATE '2026-07-11'
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms ON terms.id = periods.term_id
WHERE periods.class_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND terms.year = 2026 AND terms.term_number = 3;

INSERT INTO public.class_scoring_period_rules (
  period_id, class_id, source_rule_id, name, category, points,
  is_active, display_order, variant_kind, effective_from, effective_until
)
SELECT
  periods.id,
  periods.class_id,
  rules.id,
  rules.name,
  rules.category,
  rules.points,
  TRUE,
  rules.display_order,
  'declared',
  DATE '2026-07-11',
  DATE '2026-10-03'
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms ON terms.id = periods.term_id
JOIN public.class_scoring_rules AS rules ON rules.class_id = periods.class_id
WHERE periods.class_id IN (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  )
  AND terms.year = 2026 AND terms.term_number = 3;

INSERT INTO public.attendance_days (id, class_id, day_date, period_id)
VALUES (
  '58585858-5858-4858-8858-585858585858',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  DATE '2026-04-11',
  '22222222-2222-4222-8222-222222222222'
);

INSERT INTO public.student_attendance_records (
  id, day_id, class_id, student_id, total_points, extra_activity_points,
  discipline_penalty_points, saved_by
)
VALUES (
  '57575757-5757-4757-8757-575757575757',
  '58585858-5858-4858-8858-585858585858',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  99, 0, 0,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

INSERT INTO public.attendance_scores (
  id, day_id, class_id, student_id, rule_id, period_rule_id, points_earned
)
VALUES (
  '56565656-5656-4656-8656-565656565656',
  '58585858-5858-4858-8858-585858585858',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  '55555555-5555-4555-8555-555555555555',
  3
);

INSERT INTO public.guardian_students (guardian_id, student_id)
VALUES (
  '99999999-9999-4999-8999-999999999999',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
);

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', TRUE);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.open_class_scoring_period(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    (SELECT id FROM public.academic_terms WHERE year = 2026 AND term_number = 4),
    'x'
  )$sql$,
  'Informe um motivo da abertura com pelo menos 10 caracteres%'
);

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.open_class_scoring_period(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    (SELECT id FROM public.academic_terms WHERE year = 2026 AND term_number = 4),
    'Tentativa antecipada'
  )$sql$,
  'O trimestre só pode ser aberto entre%'
);

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.open_class_scoring_period(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    (SELECT id FROM public.academic_terms WHERE year = 2026 AND term_number = 2),
    'Tentativa expirada'
  )$sql$,
  'O trimestre não está disponível%'
);

SELECT *
FROM public.open_class_scoring_period(
  '66666666-6666-4666-8666-666666666666',
  '60606060-6060-4060-8060-606060606060',
  'Abertura tardia dinâmica'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.class_scoring_period_students AS participants
    JOIN public.class_scoring_periods AS periods ON periods.id = participants.period_id
    WHERE periods.class_id = '66666666-6666-4666-8666-666666666666'
      AND periods.term_id = '60606060-6060-4060-8060-606060606060'
      AND participants.joined_on = (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE
  ),
  'mid-term open must use the Sao Paulo opening date'
);

SELECT pg_temp.expect_error(
  $sql$SELECT public.move_active_students_to_class(
    '66666666-6666-4666-8666-666666666666',
    '77777777-7777-4777-8777-777777777777',
    'Destino ainda draft'
  )$sql$,
  'A turma de destino precisa ter um período aberto%'
);

SELECT pg_temp.assert_true(
  (SELECT class_id = '66666666-6666-4666-8666-666666666666'
   FROM public.students WHERE id = '88888888-8888-4888-8888-888888888888'),
  'failed transfer must be atomic'
);

INSERT INTO public.students (id, class_id, full_name, is_active)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Novo aluno',
  TRUE
);

UPDATE public.students
SET is_active = FALSE
WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.class_scoring_period_students AS participants
    JOIN public.class_scoring_periods AS periods ON periods.id = participants.period_id
    JOIN public.academic_terms AS terms ON terms.id = periods.term_id
    WHERE participants.student_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
      AND terms.term_number = 3
      AND participants.status = 'inactive'
      AND participants.left_on = DATE '2026-07-11'
  ),
  'creation/inactivation must synchronize only the open roster'
);

SELECT pg_temp.assert_true(
  public.move_active_students_to_class(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Transferência Q3 local'
  ) = 1,
  'one active student must move'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.class_scoring_period_students AS participants
    JOIN public.class_scoring_periods AS periods ON periods.id = participants.period_id
    JOIN public.academic_terms AS terms ON terms.id = periods.term_id
    WHERE participants.student_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      AND periods.class_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      AND terms.term_number = 3
      AND participants.status = 'inactive'
      AND participants.left_on = DATE '2026-07-11'
  ) AND EXISTS (
    SELECT 1
    FROM public.class_scoring_period_students AS participants
    JOIN public.class_scoring_periods AS periods ON periods.id = participants.period_id
    JOIN public.academic_terms AS terms ON terms.id = periods.term_id
    WHERE participants.student_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      AND periods.class_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND terms.term_number = 3
      AND participants.status = 'active'
      AND participants.joined_on = DATE '2026-07-11'
  ) AND EXISTS (
    SELECT 1
    FROM public.class_scoring_period_students
    WHERE period_id = '22222222-2222-4222-8222-222222222222'
      AND student_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      AND status = 'active'
      AND left_on IS NULL
  ),
  'transfer must change Q3 rosters and preserve Q2'
);

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.save_student_attendance_record_v2(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', DATE '2026-04-11',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    ARRAY['ffffffff-ffff-4fff-8fff-ffffffffffff'::UUID], 0, '[]',
    'Lançamento regular da pontuação semanal.'
  )$sql$,
  'Informe um motivo específico%'
);

SELECT *
FROM public.save_student_attendance_record_v2(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', DATE '2026-04-11',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ARRAY['ffffffff-ffff-4fff-8fff-ffffffffffff'::UUID], 0, '[]',
  'Revisão sem mudança de componentes'
);

SELECT pg_temp.assert_true(
  (SELECT total_points = 99 FROM public.student_attendance_records
   WHERE id = '57575757-5757-4757-8757-575757575757')
  AND (SELECT id = '56565656-5656-4656-8656-565656565656'
       AND points_earned = 3
       AND period_rule_id = '55555555-5555-4555-8555-555555555555'
       FROM public.attendance_scores
       WHERE day_id = '58585858-5858-4858-8858-585858585858')
  AND (SELECT COUNT(*) = 1 FROM public.scoring_audit_log
       WHERE table_name = 'attendance_scores'
         AND row_id = '56565656-5656-4656-8656-565656565656'),
  'legacy no-op must preserve total, variant, score id and score audit count'
);

SELECT *
FROM public.save_student_attendance_record_v2(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', DATE '2026-04-11',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ARRAY['ffffffff-ffff-4fff-8fff-ffffffffffff'::UUID], 2, '[]',
  'Mudança real de pontos extras'
);

SELECT pg_temp.assert_true(
  (SELECT total_points = 5 FROM public.student_attendance_records
   WHERE id = '57575757-5757-4757-8757-575757575757')
  AND EXISTS (
    SELECT 1 FROM public.attendance_scores
    WHERE id = '56565656-5656-4656-8656-565656565656'
      AND points_earned = 3
  ),
  'real extra change must recalculate total without rewriting components'
);

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.save_student_attendance_record_v2(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', DATE '2026-04-11',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    ARRAY[
      '44444444-4444-4444-8444-444444444444'::UUID,
      '55555555-5555-4555-8555-555555555555'::UUID
    ], 2, '[]', 'Duas variantes'
  )$sql$,
  'Selecione apenas uma variante%'
);

SELECT *
FROM public.save_student_attendance_record_v2(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', DATE '2026-07-11',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ARRAY['11111111-1111-4111-8111-111111111111'::UUID], 0, '[]', NULL
);

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.close_scoring_period(
    (SELECT periods.id FROM public.class_scoring_periods AS periods
     JOIN public.academic_terms AS terms ON terms.id = periods.term_id
     WHERE periods.class_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
       AND terms.term_number = 3),
    'Fechamento antecipado'
  )$sql$,
  'O trimestre só pode ser fechado a partir%'
);

INSERT INTO public.attendance_days (class_id, day_date)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', DATE '2026-07-18');

UPDATE public.attendance_days
SET total_offering = 25
WHERE class_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND day_date = DATE '2026-07-18';

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.attendance_days AS days
    JOIN public.class_scoring_periods AS periods ON periods.id = days.period_id
    JOIN public.academic_terms AS terms ON terms.id = periods.term_id
    WHERE days.class_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      AND days.day_date = DATE '2026-07-18'
      AND days.total_offering = 25
      AND terms.term_number = 3
  ),
  'legacy Q3 day insert must auto-attach and direct offering must remain compatible'
);

SELECT set_config('app.scoring_change_reason', '', TRUE);
SELECT pg_temp.expect_error(
  $sql$UPDATE public.attendance_days SET total_offering = 10
       WHERE id = '58585858-5858-4858-8858-585858585858'$sql$,
  'Informe um motivo específico%'
);

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.save_attendance_day_offering(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', DATE '2026-04-11', 10,
    'Lançamento regular da oferta semanal.'
  )$sql$,
  'Informe o motivo da correção%'
);

SELECT *
FROM public.save_attendance_day_offering(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', DATE '2026-04-11', 10,
  'Correção de oferta Q2 justificada'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', '', TRUE);

SELECT pg_temp.expect_error(
  $sql$INSERT INTO public.attendance_days (class_id, day_date, period_id)
       SELECT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', DATE '2026-04-18', periods.id
       FROM public.class_scoring_periods AS periods
       JOIN public.academic_terms AS terms ON terms.id = periods.term_id
       WHERE periods.class_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
         AND terms.term_number = 3$sql$,
  'O sábado não pertence%'
);

-- Result denominators follow each student's actual participation interval.
SELECT private.create_scoring_period_result_revision(
  periods.id, 'draft', 'Denominador origem', NULL
)
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms ON terms.id = periods.term_id
WHERE periods.class_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND terms.term_number = 3;

SELECT private.create_scoring_period_result_revision(
  periods.id, 'draft', 'Denominador destino', NULL
)
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms ON terms.id = periods.term_id
WHERE periods.class_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  AND terms.term_number = 3;

SELECT private.create_scoring_period_result_revision(
  periods.id, 'draft', 'Denominador abertura tardia', NULL
)
FROM public.class_scoring_periods AS periods
WHERE periods.class_id = '66666666-6666-4666-8666-666666666666'
  AND periods.term_id = '60606060-6060-4060-8060-606060606060';

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.class_scoring_period_results AS results
    JOIN public.class_scoring_period_result_revisions AS revisions
      ON revisions.id = results.revision_id
    JOIN public.class_scoring_periods AS periods ON periods.id = revisions.period_id
    JOIN public.academic_terms AS terms ON terms.id = periods.term_id
    WHERE results.student_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      AND periods.class_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      AND terms.term_number = 3
      AND results.possible_points = 0
  ) AND EXISTS (
    SELECT 1
    FROM public.class_scoring_period_results AS results
    JOIN public.class_scoring_period_result_revisions AS revisions
      ON revisions.id = results.revision_id
    JOIN public.class_scoring_periods AS periods ON periods.id = revisions.period_id
    JOIN public.academic_terms AS terms ON terms.id = periods.term_id
    WHERE results.student_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      AND periods.class_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND terms.term_number = 3
      AND results.possible_points = 91
  ),
  'transfer denominator must be zero at source and 13 Saturdays at target'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.class_scoring_period_results AS results
    JOIN public.class_scoring_period_result_revisions AS revisions
      ON revisions.id = results.revision_id
    JOIN public.class_scoring_periods AS periods ON periods.id = revisions.period_id
    JOIN public.class_scoring_period_students AS participants
      ON participants.id = results.period_student_id
    WHERE periods.class_id = '66666666-6666-4666-8666-666666666666'
      AND periods.term_id = '60606060-6060-4060-8060-606060606060'
      AND results.possible_points = 3 * (
        SELECT COUNT(*)
        FROM public.academic_term_saturdays AS saturdays
        WHERE saturdays.term_id = periods.term_id
          AND saturdays.saturday_date >= participants.joined_on
          AND (participants.left_on IS NULL OR saturdays.saturday_date < participants.left_on)
      )
  ),
  'mid-term denominator must exclude Saturdays before joined_on'
);

-- Live catalog changes do not mutate the frozen rule contract.
UPDATE public.class_scoring_rules
SET points = 88
WHERE id = '11111111-1111-4111-8111-111111111111';

SELECT private.refresh_scoring_period_findings(periods.id)
FROM public.class_scoring_periods AS periods
JOIN public.academic_terms AS terms ON terms.id = periods.term_id
WHERE periods.class_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  AND terms.term_number = 3;

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM public.class_scoring_period_findings AS findings
    JOIN public.class_scoring_periods AS periods ON periods.id = findings.period_id
    JOIN public.academic_terms AS terms ON terms.id = periods.term_id
    WHERE periods.class_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND terms.term_number = 3
      AND findings.finding_code = 'rule_points_differ_from_catalog'
      AND findings.is_current = TRUE
  ),
  'live catalog edit must not create a historical snapshot finding'
);

-- Guardian default follows the current target participation; explicit source
-- remains available as history.
SELECT set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', TRUE);
SELECT pg_temp.assert_true(
  private.resolve_guardian_scoring_period(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd', NULL
  ) = (
    SELECT periods.id
    FROM public.class_scoring_periods AS periods
    JOIN public.academic_terms AS terms ON terms.id = periods.term_id
    WHERE periods.class_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND terms.term_number = 3
  ),
  'guardian default must resolve the active target roster'
);

SELECT pg_temp.assert_true(
  private.resolve_guardian_scoring_period(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    (SELECT periods.id
     FROM public.class_scoring_periods AS periods
     JOIN public.academic_terms AS terms ON terms.id = periods.term_id
     WHERE periods.class_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
       AND terms.term_number = 3)
  ) IS NOT NULL,
  'guardian explicit source period must remain readable as history'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SELECT pg_temp.expect_error(
  $sql$UPDATE public.students SET is_active = FALSE
       WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'$sql$,
  'Somente um professor%'
);

UPDATE public.students
SET full_name = 'Aluno histórico renomeado'
WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', TRUE);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);

UPDATE public.class_scoring_periods AS periods
SET
  status = 'closed_pending_audit',
  closed_at = NOW(),
  closed_reason = 'Encerramento administrativo da fixture Q3.'
FROM public.academic_terms AS terms
WHERE terms.id = periods.term_id
  AND periods.class_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  AND terms.term_number = 3;

UPDATE public.class_scoring_periods
SET status = 'open'
WHERE id = '23232323-2323-4323-8323-232323232323';

SET LOCAL ROLE authenticated;

-- Populate Q2 target, close it, prove begin_audit cannot be skipped and prove a
-- freshly detected mismatch blocks approval.
SELECT *
FROM public.save_student_attendance_record_v2(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', DATE '2026-04-11',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ARRAY['45454545-4545-4545-8545-454545454545'::UUID], 0, '[]',
  'Carga Q2 alvo'
);

SELECT *
FROM public.close_scoring_period(
  '23232323-2323-4323-8323-232323232323',
  'Fechamento Q2 alvo'
);

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.approve_scoring_period_audit(
    '23232323-2323-4323-8323-232323232323', 'Pular início'
  )$sql$,
  'O período precisa estar em auditoria%'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', '', TRUE);
SELECT set_config('app.scoring_change_reason', '', TRUE);
UPDATE public.student_attendance_records AS records
SET total_points = records.total_points + 10
FROM public.attendance_days AS days
WHERE days.id = records.day_id
  AND days.period_id = '23232323-2323-4323-8323-232323232323';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SELECT *
FROM public.begin_scoring_period_audit(
  '23232323-2323-4323-8323-232323232323',
  'Início da auditoria Q2 alvo'
);

SELECT public.resolve_scoring_period_finding(
  findings.id,
  'Marcado como resolvido sem corrigir para testar refresh',
  FALSE
)
FROM public.class_scoring_period_findings AS findings
WHERE findings.period_id = '23232323-2323-4323-8323-232323232323'
  AND findings.finding_code = 'record_total_mismatch'
  AND findings.is_current = TRUE
  AND findings.status = 'open'
LIMIT 1;

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.approve_scoring_period_audit(
    '23232323-2323-4323-8323-232323232323', 'Ainda inconsistente'
  )$sql$,
  'Resolva ou aceite os achados bloqueantes%'
);

RESET ROLE;
SELECT set_config(
  'app.scoring_change_reason',
  'Correção efetiva do total antes da aprovação',
  TRUE
);
UPDATE public.student_attendance_records AS records
SET total_points = scores.expected_total
FROM (
  SELECT
    records_inner.id,
    (
      COALESCE(SUM(attendance_scores.points_earned), 0)
      + records_inner.extra_activity_points
      - records_inner.discipline_penalty_points
    )::INTEGER AS expected_total
  FROM public.student_attendance_records AS records_inner
  JOIN public.attendance_days AS days ON days.id = records_inner.day_id
  LEFT JOIN public.attendance_scores
    ON attendance_scores.day_id = records_inner.day_id
   AND attendance_scores.student_id = records_inner.student_id
  WHERE days.period_id = '23232323-2323-4323-8323-232323232323'
  GROUP BY records_inner.id
) AS scores
WHERE records.id = scores.id;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);

DO $$
DECLARE
  v_finding_id UUID;
BEGIN
  FOR v_finding_id IN
    SELECT findings.id
    FROM public.class_scoring_period_findings AS findings
    WHERE findings.period_id = '23232323-2323-4323-8323-232323232323'
      AND findings.is_current = TRUE
      AND findings.is_blocking = TRUE
      AND findings.status = 'open'
  LOOP
    PERFORM *
    FROM public.resolve_scoring_period_finding(
      v_finding_id,
      'Exceção aceita apenas na fixture local',
      TRUE
    );
  END LOOP;
END;
$$;

SELECT *
FROM public.approve_scoring_period_audit(
  '23232323-2323-4323-8323-232323232323',
  'Aprovação local após decisões'
);

SELECT pg_temp.expect_error(
  $sql$SELECT * FROM public.resolve_scoring_period_finding(
    (SELECT id FROM public.class_scoring_period_findings
     WHERE period_id = '23232323-2323-4323-8323-232323232323'
     LIMIT 1),
    'Tentativa pós-lock', TRUE
  )$sql$,
  'Achados só podem ser decididos%'
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', TRUE);
SELECT pg_temp.expect_error(
  $sql$UPDATE public.attendance_days SET total_offering = 999
       WHERE period_id = '23232323-2323-4323-8323-232323232323'$sql$,
  'O trimestre foi auditado%'
);

RESET ROLE;

SELECT pg_temp.assert_true(
  has_table_privilege('service_role', 'public.class_scoring_periods', 'SELECT')
  AND NOT has_table_privilege('service_role', 'public.class_scoring_periods', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.class_scoring_period_findings', 'UPDATE')
  AND NOT has_function_privilege(
    'authenticated', 'private.refresh_scoring_period_findings(uuid)', 'EXECUTE'
  ),
  'least-privilege grants must expose reads/RPCs, not internal mutations'
);

SELECT
  'ok' AS local_contract_status,
  'temporal gates, bootstrap, roster, transfer, legacy preservation, findings, denominator, guardian, locks' AS verified;

ROLLBACK;
