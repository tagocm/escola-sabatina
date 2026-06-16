import {
  SECOND_TRIMESTER_2026_START_DATE,
  buildClassScoringRanking,
  type RankingStatus,
} from "./ranking";

export type ScoringCategory = "frequencia" | "participacao" | "espiritual" | "atividade";

export interface StudentScoringDetailStudentInput {
  id: string;
  full_name: string;
  photo_url: string | null;
  class_id: string | null;
  class_name?: string | null;
}

export interface StudentScoringDetailDayInput {
  id: string;
  day_date: string;
}

export interface StudentScoringDetailRuleInput {
  id: string;
  name: string;
  category: string | null;
  points: number | null;
  is_active: boolean | null;
  display_order: number | null;
}

export interface StudentScoringDetailRecordInput {
  id: string;
  student_id: string;
  day_id: string;
  total_points: number | null;
  extra_activity_points: number | null;
  discipline_penalty_points: number | null;
  saved_by?: string | null;
  saved_by_name?: string | null;
  discipline_penalty_reason?: string | null;
  discipline_penalty_applied_by_name?: string | null;
  saved_at?: string | null;
}

export interface StudentScoringDetailScoreInput {
  student_id: string;
  day_id: string;
  rule_id: string;
  points_earned: number | null;
}

export interface StudentScoringDetailDisciplineEventInput {
  id: string;
  record_id: string;
  day_id: string;
  student_id: string;
  points: number | null;
  reason: string | null;
  applied_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface StudentScoringRuleBreakdown {
  ruleId: string;
  name: string;
  category: ScoringCategory;
  points: number;
}

export interface StudentScoringDisciplineEvent {
  id: string;
  dayDate: string;
  dayLabel: string;
  points: number;
  reason: string;
  appliedByName: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StudentScoringDetailWeek {
  weekNumber: number;
  dayId: string | null;
  dayDate: string;
  label: string;
  fullLabel: string;
  isElapsed: boolean;
  hasRecord: boolean;
  recordId: string | null;
  savedAt: string | null;
  savedBy: string | null;
  savedByName: string | null;
  totalPoints: number;
  baseRulePoints: number;
  extraActivityPoints: number;
  disciplinePenaltyPoints: number;
  selectedRules: StudentScoringRuleBreakdown[];
  missedRules: StudentScoringRuleBreakdown[];
  disciplineEvents: StudentScoringDisciplineEvent[];
  classAverage: number;
  classHighest: number;
  classSize: number;
  dailyRank: number | null;
  dailyDelta: number;
}

export interface StudentScoringCategorySummary {
  category: ScoringCategory;
  label: string;
  points: number;
  possiblePoints: number;
  progressPercent: number;
}

export interface StudentScoringDetail {
  student: {
    id: string;
    name: string;
    photoUrl: string | null;
    classId: string | null;
    className: string | null;
  };
  summary: {
    rank: number;
    status: RankingStatus;
    totalPoints: number;
    averagePoints: number;
    recordedSaturdays: number;
    launchedSaturdays: number;
    totalSaturdays: number;
    standardPossiblePerSaturday: number;
    possiblePointsToDate: number;
    projectedPossiblePoints: number;
    progressPercent: number;
    classAverageDelta: number;
    pointsBehindPrevious: number | null;
    recentTrend: number;
    classAverage: number;
    classHighest: number;
    daysWithoutRecord: number;
  };
  categorySummaries: StudentScoringCategorySummary[];
  adjustmentTotals: {
    extraActivityPoints: number;
    disciplinePenaltyPoints: number;
  };
  strongestCategory: StudentScoringCategorySummary | null;
  weakestCategory: StudentScoringCategorySummary | null;
  disciplineEvents: StudentScoringDisciplineEvent[];
  timeline: StudentScoringDetailWeek[];
}

interface BuildStudentScoringDetailInput {
  student: StudentScoringDetailStudentInput;
  students: StudentScoringDetailStudentInput[];
  days: StudentScoringDetailDayInput[];
  rules: StudentScoringDetailRuleInput[];
  records: StudentScoringDetailRecordInput[];
  scores: StudentScoringDetailScoreInput[];
  disciplineEvents: StudentScoringDetailDisciplineEventInput[];
  trimesterStartDate?: string;
  currentDate?: string;
}

const TOTAL_TRIMESTER_SATURDAYS = 13;

const CATEGORY_LABELS: Record<ScoringCategory, string> = {
  frequencia: "Frequência",
  participacao: "Participação",
  espiritual: "Espiritual",
  atividade: "Atividade",
};

const CATEGORIES: ScoringCategory[] = ["frequencia", "espiritual", "atividade", "participacao"];

function roundTo(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function addDays(dayDate: string, daysToAdd: number) {
  const [year, month, day] = dayDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + daysToAdd, 12, 0, 0);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildTrimesterSlots(trimesterStartDate: string) {
  return Array.from({ length: TOTAL_TRIMESTER_SATURDAYS }, (_, index) => addDays(trimesterStartDate, index * 7));
}

function formatShortDayLabel(dayDate: string) {
  const [, month, day] = dayDate.split("-");
  return `${day}/${month}`;
}

function formatFullDayLabel(dayDate: string) {
  const [year, month, day] = dayDate.split("-");
  return `${day}/${month}/${year}`;
}

function getElapsedTrimesterSaturdays(trimesterSlots: string[], currentDate?: string) {
  if (!currentDate) return trimesterSlots.length;
  return trimesterSlots.filter((dayDate) => dayDate <= currentDate).length;
}

function normalizeCategory(category: string | null | undefined): ScoringCategory {
  if (
    category === "frequencia" ||
    category === "participacao" ||
    category === "espiritual" ||
    category === "atividade"
  ) {
    return category;
  }

  return "atividade";
}

function mapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item] as const));
}

function getStudentDayKey(studentId: string, dayId: string) {
  return `${studentId}:${dayId}`;
}

function pushGrouped<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue) {
  map.set(key, [...(map.get(key) || []), value]);
}

function buildRuleBreakdown(
  score: StudentScoringDetailScoreInput,
  ruleById: Map<string, StudentScoringDetailRuleInput>,
): StudentScoringRuleBreakdown {
  const rule = ruleById.get(score.rule_id);

  return {
    ruleId: score.rule_id,
    name: rule?.name || "Critério removido",
    category: normalizeCategory(rule?.category),
    points: Number(score.points_earned ?? rule?.points ?? 0),
  };
}

function buildMissedRules(
  rules: StudentScoringDetailRuleInput[],
  selectedRuleIds: Set<string>,
): StudentScoringRuleBreakdown[] {
  return rules
    .filter((rule) => rule.is_active !== false)
    .filter((rule) => !selectedRuleIds.has(rule.id))
    .sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0))
    .map((rule) => ({
      ruleId: rule.id,
      name: rule.name,
      category: normalizeCategory(rule.category),
      points: Number(rule.points || 0),
    }));
}

function buildFallbackDisciplineEvent(
  record: StudentScoringDetailRecordInput,
  dayDate: string,
): StudentScoringDisciplineEvent | null {
  const points = Number(record.discipline_penalty_points || 0);
  if (points <= 0) return null;

  return {
    id: `legacy-${record.id}`,
    dayDate,
    dayLabel: formatShortDayLabel(dayDate),
    points,
    reason: String(record.discipline_penalty_reason || "Registro anterior sem motivo informado").trim(),
    appliedByName: String(record.discipline_penalty_applied_by_name || "Professor não identificado").trim(),
    createdAt: record.saved_at || null,
    updatedAt: record.saved_at || null,
  };
}

function mapDisciplineEvent(
  event: StudentScoringDetailDisciplineEventInput,
  dayDate: string,
): StudentScoringDisciplineEvent {
  return {
    id: event.id,
    dayDate,
    dayLabel: formatShortDayLabel(dayDate),
    points: Math.max(1, Number(event.points || 1)),
    reason: String(event.reason || "Motivo não informado").trim(),
    appliedByName: String(event.applied_by_name || "Professor não identificado").trim(),
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  };
}

export function buildStudentScoringDetail({
  student,
  students,
  days,
  rules,
  records,
  scores,
  disciplineEvents,
  trimesterStartDate = SECOND_TRIMESTER_2026_START_DATE,
  currentDate,
}: BuildStudentScoringDetailInput): StudentScoringDetail | null {
  const ranking = buildClassScoringRanking({
    students,
    days,
    rules,
    records,
    trimesterStartDate,
    currentDate,
  });
  const rankingStudent = ranking.students.find((entry) => entry.studentId === student.id);
  if (!rankingStudent) return null;

  const trimesterSlots = buildTrimesterSlots(trimesterStartDate);
  const trimesterEndDate = trimesterSlots.at(-1) || null;
  const trimesterSlotDates = new Set(trimesterSlots);
  const effectiveEndDate = currentDate && trimesterEndDate && currentDate < trimesterEndDate
    ? currentDate
    : trimesterEndDate;
  const elapsedSaturdays = getElapsedTrimesterSaturdays(trimesterSlots, currentDate);
  const validDays = [...days]
    .filter((day) => trimesterSlotDates.has(day.day_date))
    .filter((day) => day.day_date >= trimesterStartDate)
    .filter((day) => day.day_date <= (effectiveEndDate || day.day_date))
    .sort((left, right) => left.day_date.localeCompare(right.day_date));
  const validDayIds = new Set(validDays.map((day) => day.id));
  const dayByDate = new Map(validDays.map((day) => [day.day_date, day] as const));
  const ruleById = mapById(rules);
  const studentNameById = new Map(students.map((entry) => [entry.id, entry.full_name] as const));

  const recordsByDayId = new Map<string, StudentScoringDetailRecordInput[]>();
  const studentRecordByDayId = new Map<string, StudentScoringDetailRecordInput>();
  for (const record of records) {
    if (!validDayIds.has(record.day_id)) continue;
    pushGrouped(recordsByDayId, record.day_id, record);
    if (record.student_id === student.id) {
      studentRecordByDayId.set(record.day_id, record);
    }
  }

  const scoresByStudentDay = new Map<string, StudentScoringDetailScoreInput[]>();
  for (const score of scores) {
    if (!validDayIds.has(score.day_id)) continue;
    pushGrouped(scoresByStudentDay, getStudentDayKey(score.student_id, score.day_id), score);
  }

  const disciplineEventsByRecordId = new Map<string, StudentScoringDetailDisciplineEventInput[]>();
  for (const event of disciplineEvents) {
    if (!validDayIds.has(event.day_id)) continue;
    pushGrouped(disciplineEventsByRecordId, event.record_id, event);
  }

  const categoryTotals = new Map<ScoringCategory, number>(CATEGORIES.map((category) => [category, 0]));
  let extraActivityTotal = 0;
  let disciplinePenaltyTotal = 0;

  const timeline = trimesterSlots.map<StudentScoringDetailWeek>((dayDate, index) => {
    const day = dayByDate.get(dayDate) || null;
    const dayId = day?.id || null;
    const classRecords = dayId ? recordsByDayId.get(dayId) || [] : [];
    const record = dayId ? studentRecordByDayId.get(dayId) || null : null;
    const isElapsed = index < elapsedSaturdays;
    const classAverage = classRecords.length > 0
      ? roundTo(classRecords.reduce((sum, row) => sum + Number(row.total_points || 0), 0) / classRecords.length)
      : 0;
    const classHighest = Math.max(0, ...classRecords.map((row) => Number(row.total_points || 0)));
    const dayRankedRecords = [...classRecords].sort((left, right) => {
      const pointDelta = Number(right.total_points || 0) - Number(left.total_points || 0);
      if (pointDelta !== 0) return pointDelta;
      return String(studentNameById.get(left.student_id) || "").localeCompare(
        String(studentNameById.get(right.student_id) || ""),
        "pt-BR",
      );
    });
    const dailyRank = record
      ? dayRankedRecords.findIndex((entry) => entry.student_id === student.id) + 1
      : null;
    const scoreRows = dayId
      ? [...(scoresByStudentDay.get(getStudentDayKey(student.id, dayId)) || [])]
      : [];
    const selectedRules = scoreRows
      .map((score) => buildRuleBreakdown(score, ruleById))
      .sort((left, right) => {
        const leftRule = ruleById.get(left.ruleId);
        const rightRule = ruleById.get(right.ruleId);
        return Number(leftRule?.display_order || 0) - Number(rightRule?.display_order || 0);
      });
    const selectedRuleIds = new Set(selectedRules.map((rule) => rule.ruleId));
    const missedRules = record ? buildMissedRules(rules, selectedRuleIds) : [];
    const baseRulePoints = selectedRules.reduce((sum, rule) => sum + rule.points, 0);
    const extraActivityPoints = Number(record?.extra_activity_points || 0);
    const eventRows = record ? disciplineEventsByRecordId.get(record.id) || [] : [];
    const mappedDisciplineEvents = eventRows.map((event) => mapDisciplineEvent(event, dayDate));
    const fallbackDisciplineEvent = record && mappedDisciplineEvents.length === 0
      ? buildFallbackDisciplineEvent(record, dayDate)
      : null;
    const rowDisciplineEvents = fallbackDisciplineEvent
      ? [fallbackDisciplineEvent]
      : mappedDisciplineEvents;
    const disciplinePenaltyPoints = rowDisciplineEvents.length > 0
      ? rowDisciplineEvents.reduce((sum, event) => sum + event.points, 0)
      : Number(record?.discipline_penalty_points || 0);
    const totalPoints = Number(record?.total_points || 0);

    for (const rule of selectedRules) {
      categoryTotals.set(rule.category, (categoryTotals.get(rule.category) || 0) + rule.points);
    }
    extraActivityTotal += extraActivityPoints;
    disciplinePenaltyTotal += disciplinePenaltyPoints;

    return {
      weekNumber: index + 1,
      dayId,
      dayDate,
      label: formatShortDayLabel(dayDate),
      fullLabel: formatFullDayLabel(dayDate),
      isElapsed,
      hasRecord: Boolean(record),
      recordId: record?.id || null,
      savedAt: record?.saved_at || null,
      savedBy: record?.saved_by || null,
      savedByName: record?.saved_by_name || null,
      totalPoints,
      baseRulePoints,
      extraActivityPoints,
      disciplinePenaltyPoints,
      selectedRules,
      missedRules,
      disciplineEvents: rowDisciplineEvents,
      classAverage,
      classHighest,
      classSize: classRecords.length,
      dailyRank: dailyRank && dailyRank > 0 ? dailyRank : null,
      dailyDelta: roundTo(totalPoints - classAverage),
    };
  });

  const activePossibleByCategory = new Map<ScoringCategory, number>(CATEGORIES.map((category) => [category, 0]));
  for (const rule of rules) {
    if (rule.is_active === false) continue;
    const category = normalizeCategory(rule.category);
    activePossibleByCategory.set(category, (activePossibleByCategory.get(category) || 0) + Number(rule.points || 0));
  }

  const categorySummaries = CATEGORIES.map((category) => {
    const points = categoryTotals.get(category) || 0;
    const possiblePoints = (activePossibleByCategory.get(category) || 0) * ranking.summary.launchedSaturdays;

    return {
      category,
      label: CATEGORY_LABELS[category],
      points,
      possiblePoints,
      progressPercent: possiblePoints > 0 ? roundTo((points / possiblePoints) * 100) : 0,
    };
  });

  const comparableCategories = categorySummaries.filter((category) => category.possiblePoints > 0);
  const strongestCategory = comparableCategories.length > 0
    ? [...comparableCategories].sort((left, right) => right.progressPercent - left.progressPercent)[0]
    : null;
  const weakestCategory = comparableCategories.length > 0
    ? [...comparableCategories].sort((left, right) => left.progressPercent - right.progressPercent)[0]
    : null;
  const detailDisciplineEvents = timeline
    .flatMap((week) => week.disciplineEvents)
    .sort((left, right) => left.dayDate.localeCompare(right.dayDate));
  const daysWithoutRecord = timeline.filter((week) => week.isElapsed && !week.hasRecord).length;

  return {
    student: {
      id: student.id,
      name: student.full_name,
      photoUrl: student.photo_url,
      classId: student.class_id,
      className: student.class_name || null,
    },
    summary: {
      rank: rankingStudent.rank,
      status: rankingStudent.status,
      totalPoints: rankingStudent.totalPoints,
      averagePoints: rankingStudent.averagePoints,
      recordedSaturdays: rankingStudent.recordedSaturdays,
      launchedSaturdays: ranking.summary.launchedSaturdays,
      totalSaturdays: ranking.summary.totalSaturdays,
      standardPossiblePerSaturday: ranking.summary.standardPossiblePerSaturday,
      possiblePointsToDate: ranking.summary.possiblePointsToDate,
      projectedPossiblePoints: ranking.summary.projectedPossiblePoints,
      progressPercent: rankingStudent.progressPercent,
      classAverageDelta: rankingStudent.classAverageDelta,
      pointsBehindPrevious: rankingStudent.pointsBehindPrevious,
      recentTrend: rankingStudent.recentTrend,
      classAverage: ranking.summary.classAverage,
      classHighest: ranking.summary.classHighest,
      daysWithoutRecord,
    },
    categorySummaries,
    adjustmentTotals: {
      extraActivityPoints: extraActivityTotal,
      disciplinePenaltyPoints: disciplinePenaltyTotal,
    },
    strongestCategory,
    weakestCategory,
    disciplineEvents: detailDisciplineEvents,
    timeline,
  };
}

export function buildStudentScoringChartData(detail: StudentScoringDetail) {
  const elapsedRows = detail.timeline.filter((week) => week.isElapsed);

  return elapsedRows.map((week) => ({
    label: week.label,
    fullLabel: week.fullLabel,
    studentScore: week.hasRecord ? week.totalPoints : 0,
    classAverage: week.classAverage,
  }));
}

export function buildStudentScoringCumulativeChartData(detail: StudentScoringDetail) {
  let studentScore = 0;
  let classAverage = 0;

  return detail.timeline
    .filter((week) => week.isElapsed)
    .map((week) => {
      studentScore += week.hasRecord ? week.totalPoints : 0;
      classAverage += week.classAverage;

      return {
        label: week.label,
        fullLabel: week.fullLabel,
        studentScore: roundTo(studentScore),
        classAverage: roundTo(classAverage),
      };
    });
}
