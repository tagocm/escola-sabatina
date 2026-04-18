-- ============================================================
-- Fix IDOR vulnerability in guardian_students
-- Remove insecure direct insert policies and provide a secure RPC
-- ============================================================

-- 1. Drop the vulnerable policies
DROP POLICY IF EXISTS "guardian_students_insert_own" ON guardian_students;
DROP POLICY IF EXISTS "students_insert_guardian" ON students;

-- 2. Create a secure SECURITY DEFINER RPC to handle the atomic creation
CREATE OR REPLACE FUNCTION public.register_guardian_student(
  p_id UUID,
  p_full_name TEXT,
  p_birth_date DATE,
  p_sex TEXT,
  p_guardian_name TEXT,
  p_whatsapp TEXT,
  p_photo_url TEXT,
  p_class_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_guardian() THEN
    RAISE EXCEPTION 'Only guardians can register dependents';
  END IF;

  -- Verifica se o student id já não existe para impedir currução/roubo de referências
  IF EXISTS (SELECT 1 FROM students WHERE id = p_id) THEN
    RAISE EXCEPTION 'Student ID collision. Student already exists.';
  END IF;

  -- 1. Insere o aluno
  INSERT INTO public.students (
    id,
    full_name,
    birth_date,
    sex,
    guardian_name,
    whatsapp,
    photo_url,
    class_id,
    is_active
  ) VALUES (
    p_id,
    p_full_name,
    p_birth_date,
    p_sex,
    p_guardian_name,
    p_whatsapp,
    p_photo_url,
    p_class_id,
    true
  );

  -- 2. Insere o link protegendo a posse (guardian_id forçado pro autor)
  INSERT INTO public.guardian_students (guardian_id, student_id)
  VALUES (v_user_id, p_id);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
