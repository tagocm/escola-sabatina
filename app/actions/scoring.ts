"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import {
  SCORING_AUDIT_NOT_APPLIED_MESSAGE,
  isScoringAuditContractMissing,
} from "@/lib/scoring/audit-contract";
import {
  SECOND_TRIMESTER_2026_START_DATE,
  buildClassScoringRanking,
} from "@/lib/scoring/ranking";
import {
  buildStudentScoringDetail,
  type StudentScoringAuditLogInput,
  type StudentScoringDetailStudentInput,
} from "@/lib/scoring/student-detail";
import { revalidatePath } from "next/cache";

interface StudentDetailRow {
  id: string;
  full_name: string;
  photo_url: string | null;
  class_id: string | null;
  classes?: {
    id?: string | null;
    name?: string | null;
  } | {
    id?: string | null;
    name?: string | null;
  }[] | null;
}

function getTodayDateInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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
    currentDate: getTodayDateInSaoPaulo(),
  });
}

function mapStudentDetailRow(row: StudentDetailRow): StudentScoringDetailStudentInput {
  const classRow = Array.isArray(row.classes) ? row.classes[0] : row.classes;

  return {
    id: row.id,
    full_name: row.full_name,
    photo_url: row.photo_url,
    class_id: row.class_id,
    class_name: classRow?.name || null,
  };
}

export async function getStudentScoringDetail(classId: string, studentId: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;

  const [
    studentResult,
    studentsResult,
    daysResult,
    rulesResult,
    recordsResult,
    scoresResult,
    disciplineEventsResult,
    auditLogsResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, photo_url, class_id, classes ( id, name )")
      .eq("id", studentId)
      .eq("class_id", classId)
      .maybeSingle(),
    supabase
      .from("students")
      .select("id, full_name, photo_url, class_id, classes ( id, name )")
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
      .select("id, name, category, points, is_active, display_order")
      .eq("class_id", classId)
      .order("display_order", { ascending: true }),
    supabase
      .from("student_attendance_records")
      .select(`
        id,
        student_id,
        day_id,
        total_points,
        extra_activity_points,
        discipline_penalty_points,
        saved_by,
        discipline_penalty_reason,
        discipline_penalty_applied_by_name,
        saved_at
      `)
      .eq("class_id", classId),
    supabase
      .from("attendance_scores")
      .select("student_id, day_id, rule_id, points_earned")
      .eq("class_id", classId),
    supabase
      .from("attendance_discipline_events")
      .select(`
        id,
        record_id,
        day_id,
        student_id,
        points,
        reason,
        applied_by_name,
        created_at,
        updated_at
      `)
      .eq("class_id", classId),
    supabase
      .from("scoring_audit_log")
      .select(`
        id,
        request_id,
        table_name,
        operation,
        row_id,
        day_id,
        student_id,
        actor_user_id,
        actor_name,
        changed_at,
        transaction_id,
        reason,
        source,
        metadata,
        old_data,
        new_data
      `)
      .eq("class_id", classId)
      .eq("student_id", studentId)
      .order("changed_at", { ascending: false })
      .limit(200),
  ]);

  if (studentResult.error) return { error: "Não foi possível carregar o aluno." };
  if (!studentResult.data) return { error: "Aluno não encontrado nesta classe." };
  if (studentsResult.error) return { error: "Não foi possível carregar os alunos da classe." };
  if (daysResult.error) return { error: "Não foi possível carregar os sábados lançados." };
  if (rulesResult.error) return { error: "Não foi possível carregar os critérios de pontuação." };
  if (recordsResult.error) return { error: "Não foi possível carregar os registros de pontuação." };
  if (scoresResult.error) return { error: "Não foi possível carregar a composição dos pontos." };
  if (disciplineEventsResult.error) return { error: "Não foi possível carregar os eventos de indisciplina." };
  if (auditLogsResult.error) {
    return {
      error: isScoringAuditContractMissing(auditLogsResult.error)
        ? SCORING_AUDIT_NOT_APPLIED_MESSAGE
        : "Não foi possível carregar o log de auditoria da pontuação.",
    };
  }

  const teacherIds = Array.from(new Set(
    (recordsResult.data || [])
      .map((record) => record.saved_by)
      .filter((teacherId): teacherId is string => Boolean(teacherId)),
  ));
  const profilesResult = teacherIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    return { error: "Não foi possível carregar os responsáveis pelos lançamentos." };
  }

  const teacherNameById = new Map(
    (profilesResult.data || []).map((profile) => [
      profile.id,
      String(profile.full_name || "Professor não identificado"),
    ] as const),
  );
  const student = mapStudentDetailRow(studentResult.data as StudentDetailRow);
  const students = (studentsResult.data || []).map((row) =>
    mapStudentDetailRow(row as StudentDetailRow),
  );
  const records = (recordsResult.data || []).map((record) => ({
    ...record,
    saved_by_name: record.saved_by
      ? teacherNameById.get(record.saved_by) || "Professor não identificado"
      : "Professor não identificado",
  }));
  const detail = buildStudentScoringDetail({
    student,
    students,
    days: daysResult.data || [],
    rules: rulesResult.data || [],
    records,
    scores: scoresResult.data || [],
    disciplineEvents: disciplineEventsResult.data || [],
    auditLogs: (auditLogsResult.data || []) as StudentScoringAuditLogInput[],
    trimesterStartDate: SECOND_TRIMESTER_2026_START_DATE,
    currentDate: getTodayDateInSaoPaulo(),
  });

  if (!detail) return { error: "Aluno não encontrado no ranking ativo da classe." };
  return detail;
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
