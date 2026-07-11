"use server";

import { getClassScoringPeriodContext } from "@/app/actions/scoring-periods";
import { requireTeacherAction } from "@/lib/auth/guards";
import type { AttendanceDisciplineEvent } from "@/lib/types/attendance";
import type { SupabaseClient } from "@supabase/supabase-js";
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

const DEFAULT_OPEN_PERIOD_CHANGE_REASON = "Lançamento regular da pontuação semanal.";
const DEFAULT_DISCIPLINE_EVENT_REASON = "Desconto registrado sem motivo informado.";

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

function revalidateAttendancePaths(studentId?: string) {
  revalidatePath("/relatorios/lancamento");
  revalidatePath("/relatorios/pontuacao");
  revalidatePath("/relatorios/pontuacao/auditoria");
  revalidatePath("/relatorios/ofertas");
  revalidatePath("/responsavel");
  revalidatePath("/responsavel/filhos");

  if (studentId) {
    revalidatePath(`/responsavel/filhos/${studentId}`);
    revalidatePath(`/responsavel/filhos/${studentId}/acompanhe`);
  }
}

async function finishSavedAttendanceRecord(
  supabase: SupabaseClient,
  recordId: string,
  studentId: string,
  totalPoints: number,
) {
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
    .eq("record_id", recordId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (savedEventsError) {
    return { error: "Não foi possível recarregar os eventos de indisciplina." };
  }

  const savedDisciplineEvents = (savedEventRows || []).map((event) =>
    mapDisciplineEventRow(event as DisciplineEventRow),
  );
  const latestSavedEvent = savedDisciplineEvents.at(-1);

  revalidateAttendancePaths(studentId);

  return {
    success: true,
    disciplinePenaltyAppliedByName: latestSavedEvent?.appliedByName || "",
    disciplineEvents: savedDisciplineEvents,
    totalPoints,
  };
}

export async function getAttendanceContext(
  classId: string,
  date: string,
  periodId?: string | null,
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;
  const { selectedPeriod } = await getClassScoringPeriodContext(classId, {
    periodId,
    date,
  });

  if (!selectedPeriod || (periodId && selectedPeriod.id !== periodId)) {
    return { error: "Período de pontuação não encontrado para esta classe." };
  }

  if (!selectedPeriod.schedule.includes(date)) {
    return { error: "A data selecionada não pertence ao calendário deste período." };
  }

  const { data: day, error: dayError } = await supabase
    .from("attendance_days")
    .select("*")
    .eq("class_id", classId)
    .eq("period_id", selectedPeriod.id)
    .eq("day_date", date)
    .maybeSingle();

  if (dayError) return { error: "Não foi possível carregar o sábado da frequência." };

  if (!day) {
    return {
      period: selectedPeriod,
      day: null,
      scores: [],
      records: [],
    };
  }

  const [scoresResult, recordsResult] = await Promise.all([
    supabase
      .from("attendance_scores")
      .select("*")
      .eq("day_id", day.id),
    supabase
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
      .eq("day_id", day.id),
  ]);

  if (scoresResult.error) {
    return { error: "Não foi possível carregar as pontuações do sábado." };
  }

  if (recordsResult.error) {
    return { error: "Não foi possível carregar os registros do sábado." };
  }

  return {
    period: selectedPeriod,
    day,
    scores: scoresResult.data || [],
    records: recordsResult.data || [],
  };
}

export async function saveStudentAttendanceRecord(
  classId: string,
  date: string,
  studentId: string,
  ruleIds: string[],
  extraActivityPoints = 0,
  disciplineEvents: AttendanceDisciplineEvent[] = [],
  changeReason = "",
  periodId?: string | null,
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;
  const { selectedPeriod } = await getClassScoringPeriodContext(classId, {
    periodId,
    date,
  });

  if (!selectedPeriod || (periodId && selectedPeriod.id !== periodId)) {
    return { error: "Período de pontuação não encontrado para esta classe." };
  }

  if (!selectedPeriod.schedule.includes(date)) {
    return { error: "A data selecionada não pertence ao calendário deste período." };
  }

  if (!selectedPeriod.canWrite) {
    return { error: "Este período está bloqueado para alterações." };
  }

  const submittedReason = String(changeReason || "").trim();
  if (selectedPeriod.requiresChangeReason && submittedReason.length < 10) {
    return { error: "Informe o motivo da correção neste período encerrado." };
  }

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
  const normalizedSubmittedEvents = Array.isArray(disciplineEvents)
    ? disciplineEvents
        .filter(Boolean)
        .map((event) => ({
          id: typeof event.id === "string" && event.id.trim() ? event.id.trim() : undefined,
          points: Number.isFinite(event.points) ? Math.max(1, Math.trunc(event.points)) : 1,
          reason: String(event.reason || "").trim() || DEFAULT_DISCIPLINE_EVENT_REASON,
        }))
    : [];
  const normalizedChangeReason = submittedReason || DEFAULT_OPEN_PERIOD_CHANGE_REASON;

  const { data: savedRows, error: recordError } = await supabase.rpc(
    "save_student_attendance_record_v2",
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
    const safeMessages = [
      "Acesso não autorizado.",
      "Aluno não pertence ao período informado.",
      "A data selecionada não pertence ao calendário deste período.",
      "Critério de pontuação inválido para este período.",
      "Evento de indisciplina inválido para este registro.",
      "Os eventos de indisciplina excedem a pontuação disponível do aluno.",
      "Pontuação extra acima do limite permitido.",
      "Professor não pertence à classe informada.",
      "Este período está bloqueado para alterações.",
      "Informe um motivo para corrigir um período encerrado.",
    ];
    const knownMessage = safeMessages.find((message) => recordError.message.includes(message));

    return { error: knownMessage || "Não foi possível salvar o registro do aluno." };
  }

  const savedRecord = Array.isArray(savedRows) ? savedRows[0] : null;
  if (!savedRecord?.record_id || savedRecord.period_id !== selectedPeriod.id) {
    return { error: "Não foi possível confirmar o período do registro salvo." };
  }

  return finishSavedAttendanceRecord(
    supabase,
    savedRecord.record_id,
    studentId,
    Number(savedRecord.total_points || 0),
  );
}

export async function updateOfferingAction(
  classId: string,
  date: string,
  amount: number,
  changeReason = "",
  periodId?: string | null,
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;
  const { selectedPeriod } = await getClassScoringPeriodContext(classId, {
    periodId,
    date,
  });

  if (!selectedPeriod || (periodId && selectedPeriod.id !== periodId)) {
    return { error: "Período de pontuação não encontrado para esta classe." };
  }

  if (!selectedPeriod.schedule.includes(date)) {
    return { error: "A data selecionada não pertence ao calendário deste período." };
  }

  if (!selectedPeriod.canWrite) {
    return { error: "Este período está bloqueado para alterações." };
  }

  const normalizedReason = String(changeReason || "").trim();
  if (selectedPeriod.requiresChangeReason && normalizedReason.length < 10) {
    return { error: "Informe o motivo da correção neste período encerrado." };
  }

  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const { data: savedRows, error } = await supabase.rpc("save_attendance_day_offering", {
    p_class_id: classId,
    p_day_date: date,
    p_amount: safeAmount,
    p_change_reason: normalizedReason || "Lançamento regular da oferta semanal.",
  });

  if (error) return { error: "Não foi possível salvar a oferta." };

  const savedOffering = Array.isArray(savedRows) ? savedRows[0] : null;
  if (!savedOffering?.day_id || savedOffering.period_id !== selectedPeriod.id) {
    return { error: "Não foi possível confirmar o período da oferta salva." };
  }

  revalidateAttendancePaths();
  return { success: true };
}
