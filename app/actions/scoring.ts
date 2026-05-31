"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import {
  SECOND_TRIMESTER_2026_START_DATE,
  buildClassScoringRanking,
} from "@/lib/scoring/ranking";
import { revalidatePath } from "next/cache";

export async function getScoringRules(classId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("class_scoring_rules")
    .select("*")
    .eq("class_id", classId)
    .order("display_order", { ascending: true });

  if (error) return [];
  return data;
}

export async function getClassScoringRanking(classId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;

  const [studentsResult, daysResult, rulesResult, recordsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, photo_url")
      .eq("class_id", classId)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("attendance_days")
      .select("id, day_date")
      .eq("class_id", classId)
      .order("day_date", { ascending: true }),
    supabase
      .from("class_scoring_rules")
      .select("points, is_active")
      .eq("class_id", classId),
    supabase
      .from("student_attendance_records")
      .select("student_id, day_id, total_points")
      .eq("class_id", classId),
  ]);

  if (studentsResult.error) return { error: "Não foi possível carregar os alunos da classe." };
  if (daysResult.error) return { error: "Não foi possível carregar os sábados lançados." };
  if (rulesResult.error) return { error: "Não foi possível carregar os critérios de pontuação." };
  if (recordsResult.error) return { error: "Não foi possível carregar os pontos dos alunos." };

  return buildClassScoringRanking({
    students: studentsResult.data || [],
    days: daysResult.data || [],
    rules: rulesResult.data || [],
    records: recordsResult.data || [],
    trimesterStartDate: SECOND_TRIMESTER_2026_START_DATE,
  });
}

export async function upsertScoringRule(classId: string, ruleId: string | undefined, formData: FormData) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  
  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const pointsString = formData.get("points") as string;
  const points = parseInt(pointsString, 10) || 1;
  const displayOrder = parseInt(formData.get("displayOrder") as string, 10) || 0;
  const isActive = formData.get("isActive") === "true";

  if (!name || !category) return { error: "Nome e Categoria são obrigatórios" };

  const ruleData = {
    class_id: classId,
    name,
    category,
    points,
    display_order: displayOrder,
    is_active: isActive,
  };

  if (ruleId) {
    const { error } = await supabase
      .from("class_scoring_rules")
      .update(ruleData)
      .eq("id", ruleId);
    if (error) return { error: "Não foi possível atualizar o critério." };
  } else {
    const { error } = await supabase
      .from("class_scoring_rules")
      .insert(ruleData);
    if (error) return { error: "Não foi possível criar o critério." };
  }

  revalidatePath(`/classes/${classId}`);
  return { success: true };
}

export async function deleteScoringRule(classId: string, ruleId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const { error } = await supabase
    .from("class_scoring_rules")
    .delete()
    .eq("id", ruleId);

  if (error) return { error: "Não foi possível remover o critério." };
  revalidatePath(`/classes/${classId}`);
  return { success: true };
}

export async function loadDefaultRulesAction(classId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;

  const defaultRules = [
    { name: "Presença", category: "frequencia", points: 2, display_order: 1 },
    { name: "Bíblia", category: "espiritual", points: 3, display_order: 2 },
    { name: "Lição", category: "espiritual", points: 1, display_order: 3 },
    { name: "Atividade da lição", category: "atividade", points: 1, display_order: 4 },
    { name: "Verso bíblico", category: "espiritual", points: 10, display_order: 5 },
    { name: "Participação recolher oferta", category: "participacao", points: 1, display_order: 6 },
    { name: "Participação cantar", category: "participacao", points: 2, display_order: 7 },
    { name: "Participação carta missionária", category: "participacao", points: 3, display_order: 8 },
  ];

  const rulesWithClassId = defaultRules.map(rule => ({
    ...rule,
    class_id: classId,
    is_active: true,
  }));

  const { error } = await supabase
    .from("class_scoring_rules")
    .insert(rulesWithClassId);

  if (error) return { error: "Não foi possível carregar os critérios padrão." };

  revalidatePath(`/classes/${classId}`);
  return { success: true };
}

export async function updateScoringRuleOrder(classId: string, ruleId: string, direction: "up" | "down") {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  
  // 1. Get current rules to determine neighbors
  const rules = await getScoringRules(classId);
  const currentIndex = rules.findIndex(r => r.id === ruleId);
  
  if (currentIndex === -1) return { error: "Regra não encontrada" };
  if (direction === "up" && currentIndex === 0) return { success: true };
  if (direction === "down" && currentIndex === rules.length - 1) return { success: true };

  const neighborIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const currentRule = rules[currentIndex];
  const neighborRule = rules[neighborIndex];

  // 2. Swap display_order
  const { error: error1 } = await supabase
    .from("class_scoring_rules")
    .update({ display_order: neighborRule.display_order })
    .eq("id", currentRule.id);

  const { error: error2 } = await supabase
    .from("class_scoring_rules")
    .update({ display_order: currentRule.display_order })
    .eq("id", neighborRule.id);

  if (error1 || error2) return { error: "Erro ao reordenar" };

  revalidatePath(`/classes/${classId}`);
  return { success: true };
}
