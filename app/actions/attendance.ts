"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import { isScoringAuditContractMissing } from "@/lib/scoring/audit-contract";
import type { AttendanceDisciplineEvent } from "@/lib/types/attendance";
import type { SupabaseClient, User } from "@supabase/supabase-js";
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

interface NormalizedDisciplineEventInput {
  id?: string;
  points: number;
  reason: string;
}

interface DirectScoringSaveInput {
  supabase: SupabaseClient;
  user: User;
  classId: string;
  date: string;
  studentId: string;
  ruleIds: string[];
  extraActivityPoints: number;
  disciplineEvents: NormalizedDisciplineEventInput[];
}

const DEFAULT_SCORING_CHANGE_REASON = "Pontuação salva sem motivo informado.";
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

async function finishSavedAttendanceRecord(
  supabase: SupabaseClient,
  recordId: string,
  studentId: string,
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

async function saveStudentAttendanceRecordDirectly({
  supabase,
  user,
  classId,
  date,
  studentId,
  ruleIds,
  extraActivityPoints,
  disciplineEvents,
}: DirectScoringSaveInput) {
  const { data: classMember, error: classMemberError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("class_id", classId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (classMemberError || !classMember) {
    return { error: "Professor não pertence à classe informada." };
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("class_id", classId)
    .maybeSingle();

  if (studentError || !student) {
    return { error: "Aluno não pertence à classe informada." };
  }

  const { data: dayResult, error: dayError } = await supabase
    .from("attendance_days")
    .select("id")
    .eq("class_id", classId)
    .eq("day_date", date)
    .maybeSingle();

  let day = dayResult;

  if (!day && (!dayError || dayError.code === "PGRST116")) {
    const { data: newDay, error: createDayError } = await supabase
      .from("attendance_days")
      .insert({ class_id: classId, day_date: date })
      .select("id")
      .single();

    if (createDayError) return { error: "Não foi possível iniciar o sábado da frequência." };
    day = newDay;
  } else if (dayError) {
    return { error: "Não foi possível carregar o dia da frequência." };
  }

  if (!day?.id) return { error: "Dia de presença não inicializado." };

  const { data: ruleRows, error: rulesError } = ruleIds.length > 0
    ? await supabase
        .from("class_scoring_rules")
        .select("id, points")
        .eq("class_id", classId)
        .in("id", ruleIds)
    : { data: [], error: null };

  if (rulesError) return { error: "Não foi possível carregar os critérios de pontuação." };
  if ((ruleRows || []).length !== ruleIds.length) {
    return { error: "Critério de pontuação inválido para esta classe." };
  }

  const basePoints = (ruleRows || []).reduce(
    (sum, rule) => sum + Number(rule.points || 0),
    0,
  );
  const penaltyPoints = disciplineEvents.reduce((sum, event) => sum + event.points, 0);

  if (penaltyPoints > basePoints + extraActivityPoints) {
    return { error: "Os eventos de indisciplina excedem a pontuação disponível do aluno." };
  }

  const { data: teacherProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const currentTeacherName = String(
    teacherProfile?.full_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "Professor não identificado",
  ).trim();

  const { data: existingRecord } = await supabase
    .from("student_attendance_records")
    .select(`
      id,
      discipline_penalty_points,
      discipline_penalty_reason,
      discipline_penalty_applied_by,
      discipline_penalty_applied_by_name
    `)
    .eq("day_id", day.id)
    .eq("student_id", studentId)
    .maybeSingle();

  const { data: existingEventRows, error: existingEventsError } = existingRecord?.id
    ? await supabase
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
        .eq("record_id", existingRecord.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
    : { data: [], error: null };

  if (existingEventsError) {
    return { error: "Não foi possível carregar os eventos de indisciplina." };
  }

  const existingEventMap = new Map(
    (existingEventRows || []).map((event) => [event.id, event] as const),
  );
  const latestSubmittedEvent = disciplineEvents.at(-1);
  const latestExistingEvent = latestSubmittedEvent?.id
    ? existingEventMap.get(latestSubmittedEvent.id)
    : null;
  const disciplinePenaltyAppliedBy = latestSubmittedEvent
    ? (latestExistingEvent?.applied_by || user.id)
    : null;
  const disciplinePenaltyAppliedByName = latestSubmittedEvent
    ? String(latestExistingEvent?.applied_by_name || currentTeacherName).trim()
    : null;
  const disciplinePenaltyReason = latestSubmittedEvent?.reason || null;
  const totalPoints = basePoints + extraActivityPoints - penaltyPoints;

  const { data: savedRecord, error: recordSaveError } = await supabase
    .from("student_attendance_records")
    .upsert({
      day_id: day.id,
      class_id: classId,
      student_id: studentId,
      extra_activity_points: extraActivityPoints,
      discipline_penalty_points: penaltyPoints,
      discipline_penalty_reason: disciplinePenaltyReason,
      discipline_penalty_applied_by: disciplinePenaltyAppliedBy,
      discipline_penalty_applied_by_name: disciplinePenaltyAppliedByName,
      total_points: totalPoints,
      saved_by: user.id,
    }, { onConflict: "day_id,student_id" })
    .select("id")
    .single();

  if (recordSaveError || !savedRecord?.id) {
    return { error: "Não foi possível salvar o registro do aluno." };
  }

  const { error: deleteScoresError } = await supabase
    .from("attendance_scores")
    .delete()
    .eq("day_id", day.id)
    .eq("student_id", studentId);

  if (deleteScoresError) return { error: "Não foi possível atualizar as pontuações do aluno." };

  const scoresToInsert = (ruleRows || []).map((rule) => ({
    day_id: day.id,
    class_id: classId,
    student_id: studentId,
    rule_id: rule.id,
    points_earned: Number(rule.points || 0),
  }));

  if (scoresToInsert.length > 0) {
    const { error: scoresError } = await supabase
      .from("attendance_scores")
      .insert(scoresToInsert);

    if (scoresError) return { error: "Não foi possível salvar as pontuações do aluno." };
  }

  const keptExistingIds = new Set(
    disciplineEvents
      .map((event) => event.id)
      .filter((eventId): eventId is string => Boolean(eventId && existingEventMap.has(eventId))),
  );
  const deletedEventIds = (existingEventRows || [])
    .map((event) => event.id)
    .filter((eventId) => !keptExistingIds.has(eventId));

  if (deletedEventIds.length > 0) {
    const { error: deleteEventsError } = await supabase
      .from("attendance_discipline_events")
      .delete()
      .in("id", deletedEventIds);

    if (deleteEventsError) return { error: "Não foi possível atualizar os eventos de indisciplina." };
  }

  const existingEventsPayload = disciplineEvents.flatMap((event) => {
    if (!event.id) return [];

    const existingEvent = existingEventMap.get(event.id);
    if (!existingEvent) return [];

    return [{
      id: existingEvent.id,
      record_id: savedRecord.id,
      day_id: day.id,
      class_id: classId,
      student_id: studentId,
      points: event.points,
      reason: event.reason,
      applied_by: existingEvent.applied_by || user.id,
      applied_by_name: String(existingEvent.applied_by_name || currentTeacherName).trim(),
    }];
  });

  if (existingEventsPayload.length > 0) {
    const { error: upsertEventsError } = await supabase
      .from("attendance_discipline_events")
      .upsert(existingEventsPayload, { onConflict: "id" });

    if (upsertEventsError) return { error: "Não foi possível atualizar os eventos de indisciplina." };
  }

  const newEventsPayload = disciplineEvents
    .filter((event) => !event.id || !existingEventMap.has(event.id))
    .map((event) => ({
      record_id: savedRecord.id,
      day_id: day.id,
      class_id: classId,
      student_id: studentId,
      points: event.points,
      reason: event.reason,
      applied_by: user.id,
      applied_by_name: currentTeacherName,
    }));

  if (newEventsPayload.length > 0) {
    const { error: insertEventsError } = await supabase
      .from("attendance_discipline_events")
      .insert(newEventsPayload);

    if (insertEventsError) return { error: "Não foi possível registrar os eventos de indisciplina." };
  }

  return finishSavedAttendanceRecord(supabase, savedRecord.id, studentId);
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

  const { supabase, user } = auth;

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
  const normalizedChangeReason = String(changeReason || "").trim() || DEFAULT_SCORING_CHANGE_REASON;

  const normalizedSubmittedEvents = Array.isArray(disciplineEvents)
    ? disciplineEvents
        .filter(Boolean)
        .map((event) => ({
          id: typeof event.id === "string" && event.id.trim() ? event.id.trim() : undefined,
          points: Number.isFinite(event.points) ? Math.max(1, Math.trunc(event.points)) : 1,
          reason: String(event.reason || "").trim() || DEFAULT_DISCIPLINE_EVENT_REASON,
        }))
    : [];

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
      return saveStudentAttendanceRecordDirectly({
        supabase,
        user,
        classId,
        date,
        studentId,
        ruleIds: normalizedRuleIds,
        extraActivityPoints: safeExtraActivityPoints,
        disciplineEvents: normalizedSubmittedEvents,
      });
    }

    const safeMessages = [
      "Acesso não autorizado.",
      "Aluno não pertence à classe informada.",
      "Critério de pontuação inválido para esta classe.",
      "Evento de indisciplina inválido para este registro.",
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

  return finishSavedAttendanceRecord(supabase, savedRecord.record_id, studentId);
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
