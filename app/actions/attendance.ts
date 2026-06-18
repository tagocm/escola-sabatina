"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import {
  SCORING_AUDIT_NOT_APPLIED_MESSAGE,
  isScoringAuditContractMissing,
} from "@/lib/scoring/audit-contract";
import type { AttendanceDisciplineEvent } from "@/lib/types/attendance";
import { revalidatePath } from "next/cache";

interface DisciplineEventRow {
  id: string;
  points: number | null;
  reason: string | null;
  applied_by: string | null;
  applied_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function mapDisciplineEventRow(row: DisciplineEventRow): AttendanceDisciplineEvent {
  return {
    id: row.id,
    points: Math.max(1, Number(row.points || 1)),
    reason: String(row.reason || "").trim(),
    appliedBy: row.applied_by,
    appliedByName: row.applied_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
      attendance_discipline_events (
        id,
        points,
        reason,
        applied_by,
        applied_by_name,
        created_at,
        updated_at
      ),
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
  extraActivityPoints = 0,
  disciplineEvents: AttendanceDisciplineEvent[] = [],
  changeReason = "",
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;

  const safeExtraActivityPoints = Number.isFinite(extraActivityPoints)
    ? Math.max(0, Math.trunc(extraActivityPoints))
    : 0;
  const normalizedRuleIds = Array.isArray(ruleIds)
    ? Array.from(new Set(
        ruleIds
          .filter((ruleId): ruleId is string => typeof ruleId === "string")
          .map((ruleId) => ruleId.trim())
          .filter(Boolean),
      ))
    : [];
  const normalizedChangeReason = String(changeReason || "").trim();

  const normalizedSubmittedEvents = Array.isArray(disciplineEvents)
    ? disciplineEvents
        .filter(Boolean)
        .map((event) => ({
          id: typeof event.id === "string" && event.id.trim() ? event.id.trim() : undefined,
          points: Number.isFinite(event.points) ? Math.max(1, Math.trunc(event.points)) : 1,
          reason: String(event.reason || "").trim(),
        }))
    : [];

  if (normalizedSubmittedEvents.some((event) => !event.reason)) {
    return { error: "Informe o motivo do desconto por indisciplina." };
  }

  if (!normalizedChangeReason) {
    return { error: "Informe o motivo do lançamento ou correção da pontuação." };
  }

  const { data: savedRows, error: recordError } = await supabase.rpc(
    "save_student_attendance_record",
    {
      p_class_id: classId,
      p_day_date: date,
      p_student_id: studentId,
      p_rule_ids: normalizedRuleIds,
      p_extra_activity_points: safeExtraActivityPoints,
      p_discipline_events: normalizedSubmittedEvents,
      p_change_reason: normalizedChangeReason,
    },
  );

  if (recordError) {
    if (isScoringAuditContractMissing(recordError)) {
      return { error: SCORING_AUDIT_NOT_APPLIED_MESSAGE };
    }

    const safeMessages = [
      "Acesso não autorizado.",
      "Aluno não pertence à classe informada.",
      "Critério de pontuação inválido para esta classe.",
      "Evento de indisciplina inválido para este registro.",
      "Informe o motivo do desconto por indisciplina.",
      "Informe o motivo do lançamento ou correção da pontuação.",
      "Os eventos de indisciplina excedem a pontuação disponível do aluno.",
      "Pontuação extra acima do limite permitido.",
      "Professor não pertence à classe informada.",
    ];
    const knownMessage = safeMessages.find((message) => recordError.message.includes(message));

    return { error: knownMessage || "Não foi possível salvar o registro do aluno." };
  }

  const savedRecord = Array.isArray(savedRows) ? savedRows[0] : null;

  if (!savedRecord?.record_id) {
    return { error: "Não foi possível salvar o registro do aluno." };
  }

  const { data: savedEventRows, error: savedEventsError } = await supabase
    .from("attendance_discipline_events")
    .select(`
      id,
      points,
      reason,
      applied_by,
      applied_by_name,
      created_at,
      updated_at
    `)
    .eq("record_id", savedRecord.record_id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (savedEventsError) {
    return { error: "Não foi possível recarregar os eventos de indisciplina." };
  }

  const savedDisciplineEvents = (savedEventRows || []).map((event) =>
    mapDisciplineEventRow(event as DisciplineEventRow),
  );
  const latestSavedEvent = savedDisciplineEvents.at(-1);

  revalidatePath(`/relatorios/lancamento`);
  revalidatePath(`/relatorios/ofertas`);
  revalidatePath(`/responsavel`);
  revalidatePath(`/responsavel/filhos`);
  revalidatePath(`/responsavel/filhos/${studentId}`);
  revalidatePath(`/responsavel/filhos/${studentId}/acompanhe`);
  return {
    success: true,
    disciplinePenaltyAppliedByName: latestSavedEvent?.appliedByName || "",
    disciplineEvents: savedDisciplineEvents,
  };
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
