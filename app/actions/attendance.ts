"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";

export async function getAttendanceContext(classId: string, date: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const { supabase } = auth;

  // 1. Ensure attendance_day exists
  const { data: dayResult, error: dayError } = await supabase
    .from("attendance_days")
    .select("*")
    .eq("class_id", classId)
    .eq("day_date", date)
    .single();

  let day = dayResult;

  const isNotFoundError = dayError && dayError.code === "PGRST116";

  if (!day && (isNotFoundError || !dayError)) {
    const { data: newDay, error: createError } = await supabase
      .from("attendance_days")
      .insert({ class_id: classId, day_date: date })
      .select()
      .single();
    
    if (createError) return { error: "Não foi possível iniciar o sábado da frequência." };
    day = newDay;
  } else if (dayError && !isNotFoundError) {
    return { error: "Não foi possível carregar o dia da frequência." };
  }

  // 2. Fetch all scores for this day
  const { data: scores, error: scoresError } = await supabase
    .from("attendance_scores")
    .select("*")
    .eq("day_id", day!.id);

  if (scoresError) return { error: "Não foi possível carregar as pontuações do sábado." };

  // 3. Fetch all finalized records for this day
  const { data: records, error: recordsError } = await supabase
    .from("student_attendance_records")
    .select(`
      *,
      students (
        id,
        full_name,
        photo_url
      )
    `)
    .eq("day_id", day!.id);

  if (recordsError) return { error: "Não foi possível carregar os registros do sábado." };

  return { day, scores: scores || [], records: records || [] };
}

export async function saveStudentAttendanceRecord(
  classId: string,
  date: string,
  studentId: string,
  ruleIds: string[],
  rulesMetadata: { id: string, points: number }[]
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;

  // 1. Get or create day
  const { data: day } = await supabase
    .from("attendance_days")
    .select("id")
    .eq("class_id", classId)
    .eq("day_date", date)
    .single();

  if (!day) return { error: "Dia de presença não inicializado." };

  // 3. Calculate total points
  const selectedRules = rulesMetadata.filter(r => ruleIds.includes(r.id));
  const totalPoints = selectedRules.reduce((sum, r) => sum + r.points, 0);

  // 4a. Cleanup existing scores for this student on this day
  // Since we are updating, we clear the items and re-insert the new set
  await supabase
    .from("attendance_scores")
    .delete()
    .eq("day_id", day.id)
    .eq("student_id", studentId);

  // 4b. Batch items insert
  const scoresToInsert = selectedRules.map(r => ({
    day_id: day.id,
    class_id: classId,
    student_id: studentId,
    rule_id: r.id,
    points_earned: r.points
  }));

  if (scoresToInsert.length > 0) {
    const { error: scoresError } = await supabase
      .from("attendance_scores")
      .insert(scoresToInsert);
    if (scoresError) return { error: "Não foi possível salvar as pontuações do aluno." };
  }

  // 5. UPSERT the record (Finalize/Update Record)
  const { error: recordError } = await supabase
    .from("student_attendance_records")
    .upsert({
      day_id: day.id,
      class_id: classId,
      student_id: studentId,
      total_points: totalPoints,
      saved_by: user.id
    }, { onConflict: "day_id,student_id" });

  if (recordError) return { error: "Não foi possível salvar o registro do aluno." };

  revalidatePath(`/relatorios/lancamento`);
  revalidatePath(`/relatorios/ofertas`);
  return { success: true };
}

export async function updateOfferingAction(classId: string, date: string, amount: number) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const { error } = await supabase
    .from("attendance_days")
    .update({ total_offering: amount })
    .eq("class_id", classId)
    .eq("day_date", date);

  if (error) return { error: "Não foi possível salvar a oferta." };
  revalidatePath(`/relatorios/lancamento`);
  revalidatePath(`/relatorios/ofertas`);
  return { success: true };
}
