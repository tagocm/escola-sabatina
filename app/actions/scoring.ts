"use server";

import { requireTeacherAction } from "@/lib/auth/guards";
import { getTodayInSaoPaulo } from "@/lib/calendar/sabbath-period";
import { isScoringAuditContractMissing } from "@/lib/scoring/audit-contract";
import {
  SECOND_TRIMESTER_2026_START_DATE,
  buildClassScoringRanking,
} from "@/lib/scoring/ranking";
import {
  resolveScoringPeriod,
  type ResolvedScoringPeriod,
} from "@/lib/scoring/periods";
import {
  buildStudentScoringDetail,
  type StudentScoringAuditLogInput,
  type StudentScoringDetailDisciplineEventInput,
  type StudentScoringDetailRecordInput,
  type StudentScoringDetailRuleInput,
  type StudentScoringDetailScoreInput,
  type StudentScoringDetailStudentInput,
} from "@/lib/scoring/student-detail";
import type { SupabaseClient } from "@supabase/supabase-js";
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

interface AcademicTermSaturdayRow {
  id: string;
  week_number: number;
  saturday_date: string;
}

interface AcademicTermRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  expected_saturdays: number;
  status: string;
  academic_term_saturdays?: AcademicTermSaturdayRow[] | null;
}

interface ClassRelationRow {
  id?: string | null;
  name?: string | null;
}

interface ClassScoringPeriodRow {
  id: string;
  class_id: string;
  term_id: string;
  status: string;
  academic_terms?: AcademicTermRow | AcademicTermRow[] | null;
  classes?: ClassRelationRow | ClassRelationRow[] | null;
}

interface PeriodStudentRow {
  id: string;
  student_id: string | null;
  student_name_snapshot: string;
  status: string;
  joined_on: string | null;
  left_on: string | null;
  students?: {
    id?: string | null;
    photo_url?: string | null;
  } | {
    id?: string | null;
    photo_url?: string | null;
  }[] | null;
}

interface PeriodRuleRow extends StudentScoringDetailRuleInput {
  period_id: string;
  class_id: string;
  source_rule_id: string | null;
  effective_from: string | null;
  effective_until: string | null;
}

interface PeriodScoreRow {
  student_id: string;
  day_id: string;
  rule_id: string;
  period_rule_id: string | null;
  points_earned: number | null;
}

interface QueryErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export interface ScoringPeriodReadState {
  periodId: string;
  periodStatus: string;
  termId: string;
  termStatus: string;
}

interface LoadedScoringPeriodContext {
  id: string;
  period: ResolvedScoringPeriod;
  state: ScoringPeriodReadState;
  students: StudentScoringDetailStudentInput[];
  rules: PeriodRuleRow[];
}

type ScoringPeriodContextResult =
  | { kind: "period"; context: LoadedScoringPeriodContext }
  | { kind: "legacy" }
  | { kind: "error"; error: string };

function asSingleRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function isScoringPeriodContractMissing(error: QueryErrorLike | null | undefined) {
  const text = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes("class_scoring_periods")
    || text.includes("academic_terms")
    || text.includes("class_scoring_period_students")
    || text.includes("class_scoring_period_rules")
    || text.includes("period_id")
    || text.includes("period_rule_id")
    || text.includes("pgrst200")
    || text.includes("pgrst204")
    || text.includes("pgrst205")
    || text.includes("42p01")
    || text.includes("42703");
}

function selectDefaultPeriod(rows: ClassScoringPeriodRow[], currentDate: string) {
  const candidates = rows.flatMap((row) => {
    const term = asSingleRelation(row.academic_terms);
    return term ? [{ row, term }] : [];
  });
  const containing = candidates
    .filter(({ term }) => term.start_date <= currentDate && term.end_date >= currentDate)
    .sort((left, right) => {
      const openDelta = Number(right.row.status === "open") - Number(left.row.status === "open");
      return openDelta || right.term.start_date.localeCompare(left.term.start_date);
    })[0];
  if (containing) return containing.row;

  const open = candidates
    .filter(({ row }) => row.status === "open")
    .sort((left, right) => right.term.start_date.localeCompare(left.term.start_date))[0];
  if (open) return open.row;

  const latestPast = candidates
    .filter(({ term }) => term.end_date < currentDate)
    .sort((left, right) => right.term.end_date.localeCompare(left.term.end_date))[0];
  if (latestPast) return latestPast.row;

  return candidates
    .filter(({ term }) => term.start_date > currentDate)
    .sort((left, right) => left.term.start_date.localeCompare(right.term.start_date))[0]
    ?.row || null;
}

function periodLoadFailure(
  error: QueryErrorLike | null | undefined,
  periodId: string | undefined,
  message: string,
): ScoringPeriodContextResult {
  if (!periodId && isScoringPeriodContractMissing(error)) return { kind: "legacy" };
  return { kind: "error", error: message };
}

async function loadScoringPeriodContext(
  supabase: SupabaseClient,
  classId: string,
  periodId?: string,
): Promise<ScoringPeriodContextResult> {
  let periodsQuery = supabase
    .from("class_scoring_periods")
    .select(`
      id,
      class_id,
      term_id,
      status,
      academic_terms (
        id,
        name,
        start_date,
        end_date,
        expected_saturdays,
        status,
        academic_term_saturdays (
          id,
          week_number,
          saturday_date
        )
      ),
      classes (
        id,
        name
      )
    `)
    .eq("class_id", classId);

  if (periodId) periodsQuery = periodsQuery.eq("id", periodId);

  const periodsResult = await periodsQuery;
  if (periodsResult.error) {
    return periodLoadFailure(
      periodsResult.error,
      periodId,
      "Não foi possível carregar o período de pontuação.",
    );
  }

  const periodRows = (periodsResult.data || []) as unknown as ClassScoringPeriodRow[];
  const selectedRow = periodId
    ? periodRows[0] || null
    : selectDefaultPeriod(periodRows, getTodayInSaoPaulo());

  if (!selectedRow) {
    return periodId
      ? { kind: "error", error: "Período de pontuação não encontrado nesta classe." }
      : { kind: "legacy" };
  }

  const term = asSingleRelation(selectedRow.academic_terms);
  if (!term) return { kind: "error", error: "Calendário acadêmico do período não encontrado." };

  const schedule = [...(term.academic_term_saturdays || [])]
    .sort((left, right) => left.week_number - right.week_number)
    .map((row) => row.saturday_date);
  let resolvedPeriod: ResolvedScoringPeriod | null;

  try {
    resolvedPeriod = resolveScoringPeriod({
      period: {
        id: selectedRow.id,
        label: term.name,
        startDate: term.start_date,
        endDate: term.end_date,
        expectedSaturdays: term.expected_saturdays,
        schedule,
      },
    });
  } catch {
    return { kind: "error", error: "Calendário acadêmico do período é inválido." };
  }

  if (!resolvedPeriod) return { kind: "error", error: "Período de pontuação inválido." };

  const [studentsResult, rulesResult] = await Promise.all([
    supabase
      .from("class_scoring_period_students")
      .select(`
        id,
        student_id,
        student_name_snapshot,
        status,
        joined_on,
        left_on,
        students (
          id,
          photo_url
        )
      `)
      .eq("period_id", selectedRow.id)
      .eq("class_id", classId),
    supabase
      .from("class_scoring_period_rules")
      .select(`
        id,
        period_id,
        class_id,
        source_rule_id,
        name,
        category,
        points,
        is_active,
        display_order,
        effective_from,
        effective_until
      `)
      .eq("period_id", selectedRow.id)
      .eq("class_id", classId)
      .order("display_order", { ascending: true }),
  ]);

  if (studentsResult.error) {
    return periodLoadFailure(
      studentsResult.error,
      periodId,
      "Não foi possível carregar os participantes do período.",
    );
  }
  if (rulesResult.error) {
    return periodLoadFailure(
      rulesResult.error,
      periodId,
      "Não foi possível carregar os critérios do período.",
    );
  }

  const classRow = asSingleRelation(selectedRow.classes);
  const students = ((studentsResult.data || []) as unknown as PeriodStudentRow[])
    .filter((row) => (
      row.status !== "excluded"
      && Boolean(row.student_id)
      && (!row.joined_on || row.joined_on <= resolvedPeriod.endDate)
      && (!row.left_on || row.left_on > resolvedPeriod.startDate)
    ))
    .map((row) => {
      const currentStudent = asSingleRelation(row.students);
      return {
        id: row.student_id!,
        full_name: row.student_name_snapshot,
        photo_url: currentStudent?.photo_url || null,
        class_id: classId,
        class_name: classRow?.name || null,
        joined_on: row.joined_on,
        left_on: row.left_on,
      };
    });
  const rules = (rulesResult.data || []) as unknown as PeriodRuleRow[];

  return {
    kind: "period",
    context: {
      id: selectedRow.id,
      period: resolvedPeriod,
      state: {
        periodId: selectedRow.id,
        periodStatus: selectedRow.status,
        termId: term.id,
        termStatus: term.status,
      },
      students,
      rules,
    },
  };
}

async function loadPeriodDays(
  supabase: SupabaseClient,
  classId: string,
  context: LoadedScoringPeriodContext,
) {
  return supabase
    .from("attendance_days")
    .select("id, day_date, period_id")
    .eq("class_id", classId)
    .in("day_date", context.period.schedule)
    .or(`period_id.eq.${context.id},period_id.is.null`)
    .order("day_date", { ascending: true });
}

function mapPeriodScoreRows(
  rows: PeriodScoreRow[],
  context: LoadedScoringPeriodContext,
  dayDateById: Map<string, string>,
) {
  const ruleById = new Map(context.rules.map((rule) => [rule.id, rule] as const));
  const rulesBySourceId = new Map<string, PeriodRuleRow[]>();

  for (const rule of context.rules) {
    if (!rule.source_rule_id) continue;
    rulesBySourceId.set(rule.source_rule_id, [
      ...(rulesBySourceId.get(rule.source_rule_id) || []),
      rule,
    ]);
  }

  return rows.map((row) => {
    const directRule = row.period_rule_id ? ruleById.get(row.period_rule_id) : null;
    const dayDate = dayDateById.get(row.day_id) || null;
    const sourceCandidates = rulesBySourceId.get(row.rule_id) || [];
    const effectiveCandidates = sourceCandidates.filter((rule) => (
      (!dayDate || !rule.effective_from || rule.effective_from <= dayDate)
      && (!dayDate || !rule.effective_until || rule.effective_until >= dayDate)
    ));
    const matchedRule = directRule
      || effectiveCandidates.find((rule) => Number(rule.points) === Number(row.points_earned))
      || effectiveCandidates[0]
      || sourceCandidates[0];

    return {
      student_id: row.student_id,
      day_id: row.day_id,
      rule_id: matchedRule?.id || row.period_rule_id || row.rule_id,
      points_earned: row.points_earned,
    };
  });
}

export async function getScoringRules(classId: string, periodId?: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return [];

  const { supabase } = auth;

  if (periodId) {
    const periodResult = await loadScoringPeriodContext(supabase, classId, periodId);
    if (periodResult.kind !== "period") return [];
    return periodResult.context.rules.filter((rule) => rule.is_active !== false);
  }

  const { data, error } = await supabase
    .from("class_scoring_rules")
    .select("*")
    .eq("class_id", classId)
    .order("display_order", { ascending: true });

  if (error) return [];
  return data;
}

async function getLegacyClassScoringRanking(supabase: SupabaseClient, classId: string) {
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
    currentDate: getTodayInSaoPaulo(),
  });
}

export async function getClassScoringRanking(classId: string, periodId?: string) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;
  const periodResult = await loadScoringPeriodContext(supabase, classId, periodId);
  if (periodResult.kind === "error") return { error: periodResult.error };
  if (periodResult.kind === "legacy") return getLegacyClassScoringRanking(supabase, classId);

  const { context } = periodResult;
  const daysResult = await loadPeriodDays(supabase, classId, context);
  if (daysResult.error) return { error: "Não foi possível carregar os sábados do período." };

  const days = daysResult.data || [];
  const dayIds = days.map((day) => day.id);
  const studentIds = context.students.map((student) => student.id);
  const recordsResult = dayIds.length > 0 && studentIds.length > 0
    ? await supabase
        .from("student_attendance_records")
        .select("student_id, day_id, total_points")
        .eq("class_id", classId)
        .in("day_id", dayIds)
        .in("student_id", studentIds)
    : { data: [], error: null };

  if (recordsResult.error) return { error: "Não foi possível carregar os pontos do período." };

  return {
    ...buildClassScoringRanking({
      students: context.students,
      days,
      rules: context.rules,
      records: recordsResult.data || [],
      period: context.period,
      currentDate: getTodayInSaoPaulo(),
    }),
    periodState: context.state,
  };
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

async function getLegacyStudentScoringDetail(
  supabase: SupabaseClient,
  classId: string,
  studentId: string,
) {
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
    supabase.from("attendance_days").select("id, day_date").eq("class_id", classId).order("day_date"),
    supabase
      .from("class_scoring_rules")
      .select("id, name, category, points, is_active, display_order")
      .eq("class_id", classId)
      .order("display_order", { ascending: true }),
    supabase
      .from("student_attendance_records")
      .select(`
        id, student_id, day_id, total_points, extra_activity_points,
        discipline_penalty_points, saved_by, discipline_penalty_reason,
        discipline_penalty_applied_by_name, saved_at
      `)
      .eq("class_id", classId),
    supabase
      .from("attendance_scores")
      .select("student_id, day_id, rule_id, points_earned")
      .eq("class_id", classId),
    supabase
      .from("attendance_discipline_events")
      .select(`
        id, record_id, day_id, student_id, points, reason,
        applied_by_name, created_at, updated_at
      `)
      .eq("class_id", classId),
    supabase
      .from("scoring_audit_log")
      .select(`
        id, request_id, table_name, operation, row_id, day_id, student_id,
        actor_user_id, actor_name, changed_at, transaction_id, reason,
        source, metadata, old_data, new_data
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
  if (auditLogsResult.error && !isScoringAuditContractMissing(auditLogsResult.error)) {
    return { error: "Não foi possível carregar o log de auditoria da pontuação." };
  }

  return finishStudentScoringDetail({
    supabase,
    student: mapStudentDetailRow(studentResult.data as StudentDetailRow),
    students: (studentsResult.data || []).map((row) => mapStudentDetailRow(row as StudentDetailRow)),
    days: daysResult.data || [],
    rules: rulesResult.data || [],
    records: recordsResult.data || [],
    scores: scoresResult.data || [],
    disciplineEvents: disciplineEventsResult.data || [],
    auditLogs: (auditLogsResult.error ? [] : auditLogsResult.data || []),
    period: null,
  });
}

interface FinishStudentScoringDetailInput {
  supabase: SupabaseClient;
  student: StudentScoringDetailStudentInput;
  students: StudentScoringDetailStudentInput[];
  days: Array<{ id: string; day_date: string }>;
  rules: StudentScoringDetailRuleInput[];
  records: StudentScoringDetailRecordInput[];
  scores: StudentScoringDetailScoreInput[];
  disciplineEvents: StudentScoringDetailDisciplineEventInput[];
  auditLogs: StudentScoringAuditLogInput[];
  period: LoadedScoringPeriodContext | null;
}

async function finishStudentScoringDetail({
  supabase,
  student,
  students,
  days,
  rules,
  records,
  scores,
  disciplineEvents,
  auditLogs,
  period,
}: FinishStudentScoringDetailInput) {
  const teacherIds = Array.from(new Set(
    records
      .map((record) => record.saved_by)
      .filter((teacherId): teacherId is string => Boolean(teacherId)),
  ));
  const profilesResult = teacherIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds)
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
  const recordsWithTeacher = records.map((record) => ({
    ...record,
    saved_by_name: record.saved_by
      ? teacherNameById.get(record.saved_by) || "Professor não identificado"
      : "Professor não identificado",
  }));
  const detail = buildStudentScoringDetail({
    student,
    students,
    days,
    rules,
    records: recordsWithTeacher,
    scores,
    disciplineEvents,
    auditLogs,
    ...(period
      ? { period: period.period }
      : { trimesterStartDate: SECOND_TRIMESTER_2026_START_DATE }),
    currentDate: getTodayInSaoPaulo(),
  });

  if (!detail) return { error: "Aluno não encontrado no ranking ativo da classe." };
  return period ? { ...detail, periodState: period.state } : detail;
}

export async function getStudentScoringDetail(
  classId: string,
  studentId: string,
  periodId?: string,
) {
  const auth = await requireTeacherAction();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;
  const periodResult = await loadScoringPeriodContext(supabase, classId, periodId);
  if (periodResult.kind === "error") return { error: periodResult.error };
  if (periodResult.kind === "legacy") {
    return getLegacyStudentScoringDetail(supabase, classId, studentId);
  }

  const { context } = periodResult;
  const student = context.students.find((row) => row.id === studentId);
  if (!student) return { error: "Aluno não encontrado neste período da classe." };

  const daysResult = await loadPeriodDays(supabase, classId, context);
  if (daysResult.error) return { error: "Não foi possível carregar os sábados do período." };

  const days = daysResult.data || [];
  const dayIds = days.map((day) => day.id);
  const periodRuleIds = context.rules.map((rule) => rule.id);
  const snapshotStudentIds = context.students.map((row) => row.id);
  const emptyResult = { data: [], error: null };
  const recordsPromise = dayIds.length > 0 && snapshotStudentIds.length > 0
    ? supabase
        .from("student_attendance_records")
        .select(`
          id, student_id, day_id, total_points, extra_activity_points,
          discipline_penalty_points, saved_by, discipline_penalty_reason,
          discipline_penalty_applied_by_name, saved_at
        `)
        .eq("class_id", classId)
        .in("day_id", dayIds)
        .in("student_id", snapshotStudentIds)
    : Promise.resolve(emptyResult);
  const [recordsResult, scoresResult, disciplineEventsResult, auditLogsResult] = dayIds.length > 0
    ? await Promise.all([
        recordsPromise,
        supabase
          .from("attendance_scores")
          .select("student_id, day_id, rule_id, period_rule_id, points_earned")
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .in("day_id", dayIds)
          .or(periodRuleIds.length > 0
            ? `period_rule_id.in.(${periodRuleIds.join(",")}),period_rule_id.is.null`
            : "period_rule_id.is.null"),
        supabase
          .from("attendance_discipline_events")
          .select(`
            id, record_id, day_id, student_id, points, reason,
            applied_by_name, created_at, updated_at
          `)
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .in("day_id", dayIds),
        supabase
          .from("scoring_audit_log")
          .select(`
            id, request_id, table_name, operation, row_id, day_id, student_id,
            period_id, actor_user_id, actor_name, changed_at, transaction_id, reason,
            source, metadata, old_data, new_data
          `)
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .in("day_id", dayIds)
          .or(`period_id.eq.${context.id},period_id.is.null`)
          .order("changed_at", { ascending: false })
          .limit(200),
      ])
    : [emptyResult, emptyResult, emptyResult, emptyResult];

  if (recordsResult.error) return { error: "Não foi possível carregar os registros do período." };
  if (scoresResult.error) return { error: "Não foi possível carregar a composição dos pontos do período." };
  if (disciplineEventsResult.error) return { error: "Não foi possível carregar os eventos do período." };
  if (auditLogsResult.error && !isScoringAuditContractMissing(auditLogsResult.error)) {
    return { error: "Não foi possível carregar o log de auditoria do período." };
  }

  const dayDateById = new Map(days.map((day) => [day.id, day.day_date] as const));
  const periodScores = mapPeriodScoreRows(
    (scoresResult.data || []) as unknown as PeriodScoreRow[],
    context,
    dayDateById,
  );

  return finishStudentScoringDetail({
    supabase,
    student,
    students: context.students,
    days,
    rules: context.rules,
    records: (recordsResult.data || []) as unknown as StudentScoringDetailRecordInput[],
    scores: periodScores,
    disciplineEvents: (disciplineEventsResult.data || []) as unknown as StudentScoringDetailDisciplineEventInput[],
    auditLogs: (auditLogsResult.error
      ? []
      : auditLogsResult.data || []) as unknown as StudentScoringAuditLogInput[],
    period: context,
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
    .update({ is_active: false })
    .eq("id", ruleId)
    .eq("class_id", classId);

  if (error) return { error: "Não foi possível desativar o critério." };
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
