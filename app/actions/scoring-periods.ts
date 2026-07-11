"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import { getTodayInSaoPaulo } from "@/lib/calendar/sabbath-period";
import {
  isWritableScoringPeriodStatus,
  type ScoringPeriodStatus,
} from "@/lib/scoring/period-status";
import { revalidatePath } from "next/cache";

interface AcademicTermRow {
  id: string;
  year: number;
  term_number: number;
  name: string;
  start_date: string;
  end_date: string;
  expected_saturdays: number;
  status: string;
}

interface ScoringPeriodRow {
  id: string;
  class_id: string;
  term_id: string;
  status: ScoringPeriodStatus;
  offering_goal_snapshot: number;
  version: number;
  closed_at: string | null;
  audit_started_at: string | null;
  audited_at: string | null;
  locked_at: string | null;
  reopen_count: number;
  academic_terms: AcademicTermRow | AcademicTermRow[] | null;
}

interface PeriodFindingRow {
  id: string;
  period_id: string;
  finding_code: string;
  severity: "info" | "warning" | "error";
  is_blocking: boolean;
  status: "open" | "resolved" | "accepted";
  table_name: string | null;
  row_id: string | null;
  saturday_date: string | null;
  student_id: string | null;
  expected_data: Record<string, unknown> | null;
  actual_data: Record<string, unknown> | null;
  detected_at: string;
  resolution_reason: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ClassScoringPeriod {
  id: string;
  classId: string;
  termId: string;
  label: string;
  status: ScoringPeriodStatus;
  year: number;
  termNumber: number;
  startDate: string;
  endDate: string;
  expectedSaturdays: number;
  offeringGoalSnapshot: number;
  schedule: string[];
  version: number;
  closedAt: string | null;
  auditStartedAt: string | null;
  auditedAt: string | null;
  lockedAt: string | null;
  reopenCount: number;
  findingSummary: {
    open: number;
    openBlocking: number;
    resolved: number;
    accepted: number;
  };
  canWrite: boolean;
  requiresChangeReason: boolean;
}

export interface ScoringPeriodFinding {
  id: string;
  periodId: string;
  code: string;
  severity: "info" | "warning" | "error";
  isBlocking: boolean;
  status: "open" | "resolved" | "accepted";
  tableName: string | null;
  rowId: string | null;
  saturdayDate: string | null;
  studentId: string | null;
  expectedData: Record<string, unknown>;
  actualData: Record<string, unknown>;
  detectedAt: string;
  resolutionReason: string | null;
  metadata: Record<string, unknown>;
}

export interface ScoringPeriodStudent {
  id: string;
  class_id: string;
  full_name: string;
  photo_url: string | null;
  birth_date: string | null;
  sex: "masculino" | "feminino" | null;
  guardian_name: string | null;
  whatsapp: string | null;
}

export interface ScoringPeriodRule {
  id: string;
  sourceRuleId: string | null;
  variantKind: "declared" | "legacy_observed";
  name: string;
  category: "frequencia" | "participacao" | "espiritual" | "atividade";
  points: number;
}

export interface ScoringPeriodOperationalMetrics {
  elapsed: number;
  withRecords: number;
  complete: number;
  expected: number;
  participantCount: number;
}

export interface ScoringPeriodAuditHistoryEntry {
  id: string;
  kind: "lifecycle" | "annotation";
  label: string;
  actorName: string;
  reason: string;
  createdAt: string;
}

function readSingleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function summarizeFindings(rows: PeriodFindingRow[]) {
  return rows.reduce(
    (summary, finding) => {
      if (finding.status === "open") {
        summary.open += 1;
        if (finding.is_blocking) summary.openBlocking += 1;
      } else if (finding.status === "resolved") {
        summary.resolved += 1;
      } else if (finding.status === "accepted") {
        summary.accepted += 1;
      }

      return summary;
    },
    { open: 0, openBlocking: 0, resolved: 0, accepted: 0 },
  );
}

function revalidateScoringPeriodPaths(classId: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/relatorios/lancamento");
  revalidatePath("/relatorios/pontuacao");
  revalidatePath("/relatorios/pontuacao/auditoria");
  revalidatePath("/relatorios/ofertas");
  revalidatePath("/responsavel");
}

export async function getClassScoringPeriods(classId: string): Promise<ClassScoringPeriod[]> {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  const { data: periodRows, error: periodsError } = await supabase
    .from("class_scoring_periods")
    .select(`
      id,
      class_id,
      term_id,
      status,
      offering_goal_snapshot,
      version,
      closed_at,
      audit_started_at,
      audited_at,
      locked_at,
      reopen_count,
      academic_terms!inner (
        id,
        year,
        term_number,
        name,
        start_date,
        end_date,
        expected_saturdays,
        status
      )
    `)
    .eq("class_id", classId);

  if (periodsError || !periodRows) {
    console.error("Error fetching class scoring periods:", periodsError);
    return [];
  }

  const rows = periodRows as unknown as ScoringPeriodRow[];
  const termIds = rows.map((row) => row.term_id);
  const periodIds = rows.map((row) => row.id);
  const [saturdaysResult, findingsResult] = await Promise.all([
    termIds.length > 0
      ? supabase
          .from("academic_term_saturdays")
          .select("term_id, week_number, saturday_date")
          .in("term_id", termIds)
          .order("week_number", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    periodIds.length > 0
      ? supabase
          .from("class_scoring_period_findings")
          .select("id, period_id, finding_code, severity, is_blocking, status")
          .in("period_id", periodIds)
          .eq("is_current", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (saturdaysResult.error) {
    console.error("Error fetching scoring period Saturdays:", saturdaysResult.error);
    return [];
  }

  if (findingsResult.error) {
    console.error("Error fetching scoring period findings:", findingsResult.error);
    return [];
  }

  const scheduleByTermId = new Map<string, string[]>();
  for (const saturday of saturdaysResult.data || []) {
    const schedule = scheduleByTermId.get(saturday.term_id) || [];
    schedule.push(saturday.saturday_date);
    scheduleByTermId.set(saturday.term_id, schedule);
  }

  const findingsByPeriodId = new Map<string, PeriodFindingRow[]>();
  for (const finding of (findingsResult.data || []) as unknown as PeriodFindingRow[]) {
    const findings = findingsByPeriodId.get(finding.period_id) || [];
    findings.push(finding);
    findingsByPeriodId.set(finding.period_id, findings);
  }

  return rows
    .flatMap((row) => {
      const term = readSingleRelation(row.academic_terms);
      if (!term) return [];

      return [{
        id: row.id,
        classId: row.class_id,
        termId: row.term_id,
        label: term.name,
        status: row.status,
        year: term.year,
        termNumber: term.term_number,
        startDate: term.start_date,
        endDate: term.end_date,
        expectedSaturdays: term.expected_saturdays,
        offeringGoalSnapshot: Number(row.offering_goal_snapshot || 0),
        schedule: scheduleByTermId.get(row.term_id) || [],
        version: row.version,
        closedAt: row.closed_at,
        auditStartedAt: row.audit_started_at,
        auditedAt: row.audited_at,
        lockedAt: row.locked_at,
        reopenCount: row.reopen_count,
        findingSummary: summarizeFindings(findingsByPeriodId.get(row.id) || []),
        canWrite: isWritableScoringPeriodStatus(row.status),
        requiresChangeReason: row.status !== "open",
      } satisfies ClassScoringPeriod];
    })
    .sort((left, right) => right.startDate.localeCompare(left.startDate));
}

export async function getClassScoringPeriodContext(
  classId: string,
  options: { periodId?: string | null; date?: string | null } = {},
) {
  const periods = await getClassScoringPeriods(classId);
  const today = getTodayInSaoPaulo();
  const containingPeriod = periods
    .filter((period) => today >= period.startDate && today <= period.endDate)
    .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];
  const latestPastPeriod = periods
    .filter((period) => period.endDate < today)
    .sort((left, right) => right.endDate.localeCompare(left.endDate))[0];
  const nextFuturePeriod = periods
    .filter((period) => period.startDate > today)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
  const selectedPeriod =
    (options.periodId
      ? periods.find((period) => period.id === options.periodId)
      : null)
    || (options.date
      ? periods.find((period) => period.schedule.includes(options.date!))
      : null)
    || containingPeriod
    || periods.find((period) => period.status === "open")
    || latestPastPeriod
    || nextFuturePeriod
    || null;

  return { periods, selectedPeriod };
}

export async function getScoringPeriodFindings(
  classId: string,
  periodId: string,
): Promise<ScoringPeriodFinding[]> {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  const { data: period } = await supabase
    .from("class_scoring_periods")
    .select("id")
    .eq("id", periodId)
    .eq("class_id", classId)
    .maybeSingle();

  if (!period) return [];

  const { data, error } = await supabase
    .from("class_scoring_period_findings")
    .select(`
      id,
      period_id,
      finding_code,
      severity,
      is_blocking,
      status,
      table_name,
      row_id,
      saturday_date,
      student_id,
      expected_data,
      actual_data,
      detected_at,
      resolution_reason,
      metadata
    `)
    .eq("period_id", periodId)
    .eq("is_current", true)
    .order("is_blocking", { ascending: false })
    .order("detected_at", { ascending: true });

  if (error) {
    console.error("Error fetching scoring period findings:", error);
    return [];
  }

  return ((data || []) as unknown as PeriodFindingRow[]).map((finding) => ({
    id: finding.id,
    periodId: finding.period_id,
    code: finding.finding_code,
    severity: finding.severity,
    isBlocking: finding.is_blocking,
    status: finding.status,
    tableName: finding.table_name,
    rowId: finding.row_id,
    saturdayDate: finding.saturday_date,
    studentId: finding.student_id,
    expectedData: finding.expected_data || {},
    actualData: finding.actual_data || {},
    detectedAt: finding.detected_at,
    resolutionReason: finding.resolution_reason,
    metadata: finding.metadata || {},
  }));
}

export async function getScoringPeriodStudents(
  classId: string,
  periodId: string,
  date?: string,
): Promise<ScoringPeriodStudent[]> {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("class_scoring_period_students")
    .select(`
      student_id,
      student_name_snapshot,
      status,
      joined_on,
      left_on,
      students (
        id,
        class_id,
        photo_url,
        birth_date,
        sex,
        guardian_name,
        whatsapp
      )
    `)
    .eq("class_id", classId)
    .eq("period_id", periodId)
    .neq("status", "excluded")
    .order("student_name_snapshot", { ascending: true });

  if (error) {
    console.error("Error fetching scoring period students:", error);
    return [];
  }

  return (data || []).flatMap((participant) => {
    if (
      date
      && (
        (participant.joined_on && participant.joined_on > date)
        || (participant.left_on && participant.left_on <= date)
      )
    ) {
      return [];
    }

    const student = readSingleRelation(participant.students as unknown as {
      id: string;
      class_id: string;
      photo_url: string | null;
      birth_date: string | null;
      sex: string | null;
      guardian_name: string | null;
      whatsapp: string | null;
    } | Array<{
      id: string;
      class_id: string;
      photo_url: string | null;
      birth_date: string | null;
      sex: string | null;
      guardian_name: string | null;
      whatsapp: string | null;
    }> | null);

    if (!participant.student_id) return [];

    return [{
      id: participant.student_id,
      class_id: classId,
      full_name: participant.student_name_snapshot,
      photo_url: student?.photo_url || null,
      birth_date: student?.birth_date || null,
      sex: student?.sex === "feminino"
        ? "feminino"
        : student?.sex === "masculino"
          ? "masculino"
          : null,
      guardian_name: student?.guardian_name || null,
      whatsapp: student?.whatsapp || null,
    } satisfies ScoringPeriodStudent];
  });
}

export async function getScoringPeriodRules(
  classId: string,
  periodId: string,
): Promise<ScoringPeriodRule[]> {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("class_scoring_period_rules")
    .select("id, source_rule_id, name, category, points, is_active, display_order, variant_kind")
    .eq("class_id", classId)
    .eq("period_id", periodId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching scoring period rules:", error);
    return [];
  }

  return (data || [])
    .filter((rule) => rule.variant_kind === "legacy_observed" || rule.is_active === true)
    .map((rule) => ({
    id: rule.id,
    sourceRuleId: rule.source_rule_id,
    variantKind: rule.variant_kind as ScoringPeriodRule["variantKind"],
    name: rule.name,
    category: rule.category as ScoringPeriodRule["category"],
    points: Number(rule.points || 0),
    }));
}

export async function getScoringPeriodOperationalMetrics(
  classId: string,
  periodId: string,
): Promise<ScoringPeriodOperationalMetrics | null> {
  const auth = await requireTeacherAction();
  if ("error" in auth) return null;

  const { supabase } = auth;
  const periods = await getClassScoringPeriods(classId);
  const period = periods.find((entry) => entry.id === periodId);
  if (!period) return null;

  const [daysResult, participantsResult] = await Promise.all([
    supabase
      .from("attendance_days")
      .select("id, day_date")
      .eq("class_id", classId)
      .eq("period_id", periodId),
    supabase
      .from("class_scoring_period_students")
      .select("student_id, joined_on, left_on")
      .eq("class_id", classId)
      .eq("period_id", periodId)
      .neq("status", "excluded")
      .not("student_id", "is", null),
  ]);

  if (daysResult.error || participantsResult.error) return null;

  const dayIds = (daysResult.data || []).map((day) => day.id);
  const { data: recordRows, error: recordsError } = dayIds.length > 0
    ? await supabase
        .from("student_attendance_records")
        .select("day_id, student_id")
        .in("day_id", dayIds)
    : { data: [], error: null };

  if (recordsError) return null;

  const recordedStudentsByDay = new Map<string, Set<string>>();
  for (const record of recordRows || []) {
    const studentIds = recordedStudentsByDay.get(record.day_id) || new Set<string>();
    studentIds.add(record.student_id);
    recordedStudentsByDay.set(record.day_id, studentIds);
  }

  const participants = (participantsResult.data || []).filter((participant) => participant.student_id);
  const today = getTodayInSaoPaulo();
  const activeParticipantIdsOn = (date: string) => new Set(
    participants
      .filter((participant) => (
        (!participant.joined_on || participant.joined_on <= date)
        && (!participant.left_on || participant.left_on > date)
      ))
      .map((participant) => participant.student_id as string),
  );
  const participantCount = activeParticipantIdsOn(today).size;
  const withRecords = [...recordedStudentsByDay.values()]
    .filter((studentIds) => studentIds.size > 0).length;
  const complete = (daysResult.data || []).filter((day) => {
    const expectedStudentIds = activeParticipantIdsOn(day.day_date);
    const recordedStudentIds = recordedStudentsByDay.get(day.id) || new Set<string>();
    return expectedStudentIds.size > 0
      && [...expectedStudentIds].every((studentId) => recordedStudentIds.has(studentId));
  }).length;

  return {
    elapsed: period.schedule.filter((date) => date <= today).length,
    withRecords,
    complete,
    expected: period.expectedSaturdays,
    participantCount,
  };
}

export async function getScoringPeriodAuditHistory(
  classId: string,
  periodId: string,
): Promise<ScoringPeriodAuditHistoryEntry[]> {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;
  const { data: period } = await supabase
    .from("class_scoring_periods")
    .select("id")
    .eq("id", periodId)
    .eq("class_id", classId)
    .maybeSingle();
  if (!period) return [];

  const [lifecycleResult, annotationsResult] = await Promise.all([
    supabase
      .from("class_scoring_period_lifecycle")
      .select("id, event_type, actor_name, reason, created_at")
      .eq("period_id", periodId),
    supabase
      .from("class_scoring_period_annotations")
      .select("id, annotation_type, actor_name, body, created_at")
      .eq("period_id", periodId),
  ]);

  if (lifecycleResult.error || annotationsResult.error) return [];

  return [
    ...(lifecycleResult.data || []).map((entry) => ({
      id: entry.id,
      kind: "lifecycle" as const,
      label: entry.event_type,
      actorName: entry.actor_name,
      reason: entry.reason,
      createdAt: entry.created_at,
    })),
    ...(annotationsResult.data || []).map((entry) => ({
      id: entry.id,
      kind: "annotation" as const,
      label: entry.annotation_type,
      actorName: entry.actor_name,
      reason: entry.body,
      createdAt: entry.created_at,
    })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

type PeriodTransitionRpc =
  | "close_scoring_period"
  | "begin_scoring_period_audit"
  | "approve_scoring_period_audit"
  | "reopen_scoring_period";

async function transitionScoringPeriod(
  rpcName: PeriodTransitionRpc,
  periodId: string,
  formData: FormData,
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const reason = String(formData.get("reason") || "").trim();
  if (reason.length < 10) {
    return { error: "Informe um motivo com pelo menos 10 caracteres." };
  }

  const { data: period } = await supabase
    .from("class_scoring_periods")
    .select(`
      id,
      class_id,
      status,
      academic_terms!inner (
        start_date,
        end_date
      )
    `)
    .eq("id", periodId)
    .maybeSingle();

  if (!period) return { error: "Período não encontrado nesta classe." };

  const term = readSingleRelation(period.academic_terms as unknown as {
    start_date: string;
    end_date: string;
  } | Array<{
    start_date: string;
    end_date: string;
  }> | null);
  const today = getTodayInSaoPaulo();
  if (rpcName === "close_scoring_period" && term && today < term.end_date) {
    return { error: `O período só pode ser encerrado a partir de ${term.end_date}.` };
  }

  const { error } = await supabase.rpc(rpcName, {
    p_period_id: periodId,
    p_reason: reason,
  });

  if (error) {
    const safeMessages = [
      "Somente o proprietário da classe pode alterar o ciclo do trimestre.",
      "Resolva ou aceite os achados bloqueantes antes de aprovar a auditoria.",
      "Transição de período inválida.",
      "Período de pontuação não encontrado.",
      "O trimestre não pode ser aberto antes da data inicial.",
      "O trimestre não pode ser fechado antes da data final.",
    ];
    const knownMessage = safeMessages.find((message) => error.message.includes(message));
    return { error: knownMessage || "Não foi possível atualizar o estado do período." };
  }

  revalidateScoringPeriodPaths(period.class_id);
  return { success: true };
}

export async function closeScoringPeriodAction(periodId: string, formData: FormData) {
  return transitionScoringPeriod("close_scoring_period", periodId, formData);
}

export async function beginScoringPeriodAuditAction(periodId: string, formData: FormData) {
  return transitionScoringPeriod("begin_scoring_period_audit", periodId, formData);
}

export async function approveScoringPeriodAuditAction(periodId: string, formData: FormData) {
  return transitionScoringPeriod("approve_scoring_period_audit", periodId, formData);
}

export async function reopenScoringPeriodAction(periodId: string, formData: FormData) {
  return transitionScoringPeriod("reopen_scoring_period", periodId, formData);
}

export async function resolveScoringPeriodFindingAction(
  periodId: string,
  findingId: string,
  formData: FormData,
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;
  const reason = String(formData.get("reason") || "").trim();
  const acceptAsException = formData.get("resolution") === "accepted";
  if (reason.length < 10) {
    return { error: "Informe uma justificativa com pelo menos 10 caracteres." };
  }

  const { data: period } = await supabase
    .from("class_scoring_periods")
    .select("class_id")
    .eq("id", periodId)
    .maybeSingle();

  if (!period) return { error: "Período não encontrado." };

  const { error } = await supabase.rpc("resolve_scoring_period_finding", {
    p_finding_id: findingId,
    p_resolution_reason: reason,
    p_accept_as_exception: acceptAsException,
  });

  if (error) return { error: "Não foi possível concluir o achado de auditoria." };

  revalidateScoringPeriodPaths(period.class_id);
  return { success: true };
}

export async function addScoringPeriodAnnotationAction(
  periodId: string,
  findingId: string | null,
  formData: FormData,
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;
  const body = String(formData.get("body") || "").trim();
  const annotationType = String(formData.get("annotationType") || "note").trim();
  if (body.length < 5) return { error: "Informe uma anotação mais detalhada." };

  const { data: period } = await supabase
    .from("class_scoring_periods")
    .select("class_id")
    .eq("id", periodId)
    .maybeSingle();

  if (!period) return { error: "Período não encontrado." };

  const { error } = await supabase.rpc("add_scoring_period_annotation", {
    p_period_id: periodId,
    p_finding_id: findingId,
    p_annotation_type: annotationType,
    p_body: body,
  });

  if (error) return { error: "Não foi possível registrar a anotação." };

  revalidateScoringPeriodPaths(period.class_id);
  return { success: true };
}

export async function openClassScoringPeriodAction(
  classId: string,
  termId: string,
  formData: FormData,
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return auth;

  const { supabase } = auth;
  const reason = String(formData.get("reason") || "").trim();
  if (reason.length < 10) {
    return { error: "Informe um motivo com pelo menos 10 caracteres." };
  }

  const { data: term } = await supabase
    .from("academic_terms")
    .select("start_date, end_date, status")
    .eq("id", termId)
    .maybeSingle();

  if (!term) return { error: "Trimestre acadêmico não encontrado." };
  const today = getTodayInSaoPaulo();
  if (today < term.start_date) {
    return { error: `O período só pode ser aberto a partir de ${term.start_date}.` };
  }
  if (today > term.end_date || term.status === "closed") {
    return { error: "Este trimestre acadêmico já terminou e não pode ser aberto retroativamente." };
  }

  const { error } = await supabase.rpc("open_class_scoring_period", {
    p_class_id: classId,
    p_term_id: termId,
    p_reason: reason,
  });

  if (error) return { error: "Não foi possível abrir o período de pontuação." };

  revalidateScoringPeriodPaths(classId);
  return { success: true };
}
