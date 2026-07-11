import {
  DEFAULT_SCORING_PERIOD_SATURDAYS,
  LEGACY_SECOND_TRIMESTER_2026_START_DATE,
  getElapsedScoringPeriodSaturdays,
  resolveScoringPeriod,
  type ResolvedScoringPeriod,
  type ScoringPeriodDefinition,
  type ScoringPeriodScheduleInput,
} from "./periods";

export type RankingStatus = "subindo" | "estavel" | "recuperando" | "atencao";

export interface RankingStudentInput {
  id: string;
  full_name: string;
  photo_url: string | null;
  joined_on?: string | null;
  left_on?: string | null;
}

export interface RankingDayInput {
  id: string;
  day_date: string;
}

export interface RankingRuleInput {
  points: number | null;
  is_active: boolean | null;
}

export interface RankingRecordInput {
  student_id: string;
  day_id: string;
  total_points: number | null;
}

export interface ClassScoringRankingStudent {
  studentId: string;
  studentName: string;
  photoUrl: string | null;
  rank: number;
  totalPoints: number;
  averagePoints: number;
  recordedSaturdays: number;
  eligibleElapsedSaturdays: number;
  eligibleTotalSaturdays: number;
  possiblePoints: number;
  progressPercent: number;
  classAverageDelta: number;
  pointsBehindPrevious: number | null;
  recentTrend: number;
  status: RankingStatus;
}

export interface ClassScoringRankingWeek {
  dayId: string | null;
  dayDate: string;
  label: string;
  classAverage: number;
}

export interface ClassScoringRankingSummary {
  /** @deprecated Use `elapsedSaturdays`; kept for existing UI consumers. */
  launchedSaturdays: number;
  elapsedSaturdays: number;
  saturdaysWithRecords: number;
  completeSaturdays: number;
  totalSaturdays: number;
  standardPossiblePerSaturday: number;
  possiblePointsToDate: number;
  projectedPossiblePoints: number;
  classAverage: number;
  classHighest: number;
  studentCount: number;
}

export interface ClassScoringRanking {
  period: ResolvedScoringPeriod | null;
  summary: ClassScoringRankingSummary;
  students: ClassScoringRankingStudent[];
  weeklyAverages: ClassScoringRankingWeek[];
}

export interface BuildClassScoringRankingInput {
  students: RankingStudentInput[];
  days: RankingDayInput[];
  rules: RankingRuleInput[];
  records: RankingRecordInput[];
  period?: ScoringPeriodDefinition;
  schedule?: readonly ScoringPeriodScheduleInput[];
  /** @deprecated Pass `period` or `schedule` instead. */
  trimesterStartDate?: string;
  currentDate?: string;
}

/** @deprecated Load and pass a scoring period instead. */
export const SECOND_TRIMESTER_2026_START_DATE = LEGACY_SECOND_TRIMESTER_2026_START_DATE;

function roundTo(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatDayLabel(dayDate: string) {
  const [, month, day] = dayDate.split("-");
  return `${day}/${month}`;
}

function getRecentTrend(scores: number[]) {
  if (scores.length < 2) return scores[0] || 0;

  const previousScores = scores.slice(0, -1);
  const previousAverage = previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length;
  return roundTo(scores[scores.length - 1] - previousAverage);
}

export function isScoringParticipantEligibleOnDate(
  student: Pick<RankingStudentInput, "joined_on" | "left_on">,
  date: string,
) {
  return (!student.joined_on || student.joined_on <= date)
    && (!student.left_on || student.left_on > date);
}

function getStatus({
  totalPoints,
  averagePoints,
  classTotalAverage,
  classAverage,
  recordedSaturdays,
  launchedSaturdays,
  recentTrend,
}: {
  totalPoints: number;
  averagePoints: number;
  classTotalAverage: number;
  classAverage: number;
  recordedSaturdays: number;
  launchedSaturdays: number;
  recentTrend: number;
}): RankingStatus {
  const presenceRatio = launchedSaturdays > 0 ? recordedSaturdays / launchedSaturdays : 0;

  if (recentTrend < -1) {
    return "atencao";
  }

  if (totalPoints < classTotalAverage && recentTrend > 0) {
    return "recuperando";
  }

  if (averagePoints < classAverage && presenceRatio < 0.75) {
    return "atencao";
  }

  if (recentTrend > 1) {
    return "subindo";
  }

  return "estavel";
}

export function buildClassScoringRanking({
  students,
  days,
  rules,
  records,
  period,
  schedule,
  trimesterStartDate,
  currentDate,
}: BuildClassScoringRankingInput): ClassScoringRanking {
  const resolvedPeriod = resolveScoringPeriod({
    period,
    schedule,
    startDate: trimesterStartDate,
  });
  const periodSchedule = resolvedPeriod?.schedule || [];
  const periodEndDate = resolvedPeriod?.endDate || null;
  const periodScheduleDates = new Set(periodSchedule);
  const effectiveEndDate = currentDate && periodEndDate && currentDate < periodEndDate
    ? currentDate
    : periodEndDate;
  const orderedDays = [...days]
    .filter((day) => {
      if (!resolvedPeriod) return !currentDate || day.day_date <= currentDate;
      return periodScheduleDates.has(day.day_date)
        && day.day_date >= resolvedPeriod.startDate
        && day.day_date <= (effectiveEndDate || resolvedPeriod.endDate);
    })
    .sort((left, right) => left.day_date.localeCompare(right.day_date));
  const elapsedSaturdays = resolvedPeriod && currentDate
    ? getElapsedScoringPeriodSaturdays(resolvedPeriod, currentDate)
    : orderedDays.length;
  const elapsedPeriodSchedule = periodSchedule.slice(0, elapsedSaturdays);
  const launchedSaturdays = elapsedSaturdays;
  const totalSaturdays = resolvedPeriod?.expectedSaturdays
    || DEFAULT_SCORING_PERIOD_SATURDAYS;
  const standardPossiblePerSaturday = rules
    .filter((rule) => rule.is_active !== false)
    .reduce((sum, rule) => sum + Number(rule.points || 0), 0);
  const possiblePointsToDate = standardPossiblePerSaturday * launchedSaturdays;
  const projectedPossiblePoints = standardPossiblePerSaturday * totalSaturdays;

  const recordsByStudent = new Map<string, RankingRecordInput[]>();
  const recordsByDay = new Map<string, RankingRecordInput[]>();
  const validDayIds = new Set(orderedDays.map((day) => day.id));
  const dayDateById = new Map(orderedDays.map((day) => [day.id, day.day_date] as const));
  const studentById = new Map(students.map((student) => [student.id, student] as const));
  const rankedStudentIds = new Set(students.map((student) => student.id));

  for (const record of records) {
    if (!validDayIds.has(record.day_id)) continue;
    const recordStudent = studentById.get(record.student_id);
    const recordDate = dayDateById.get(record.day_id);
    if (!recordStudent || !recordDate || !isScoringParticipantEligibleOnDate(recordStudent, recordDate)) {
      continue;
    }

    recordsByStudent.set(record.student_id, [
      ...(recordsByStudent.get(record.student_id) || []),
      record,
    ]);
    recordsByDay.set(record.day_id, [
      ...(recordsByDay.get(record.day_id) || []),
      record,
    ]);
  }

  const saturdaysWithRecords = orderedDays.filter((day) =>
    (recordsByDay.get(day.id) || []).some((record) => rankedStudentIds.has(record.student_id)),
  ).length;
  const completeSaturdays = students.length > 0
    ? orderedDays.filter((day) => {
        const expectedStudentIds = new Set(
          students
            .filter((student) => isScoringParticipantEligibleOnDate(student, day.day_date))
            .map((student) => student.id),
        );
        const recordedStudentIds = new Set(
          (recordsByDay.get(day.id) || [])
            .map((record) => record.student_id)
            .filter((studentId) => expectedStudentIds.has(studentId)),
        );
        return expectedStudentIds.size > 0
          && [...expectedStudentIds].every((studentId) => recordedStudentIds.has(studentId));
      }).length
    : 0;

  const dayIndexById = new Map(orderedDays.map((day, index) => [day.id, index]));
  const studentRows = students.map((student) => {
    const studentRecords = [...(recordsByStudent.get(student.id) || [])]
      .sort((left, right) => (dayIndexById.get(left.day_id) ?? 0) - (dayIndexById.get(right.day_id) ?? 0));
    const scores = studentRecords.map((record) => Number(record.total_points || 0));
    const totalPoints = scores.reduce((sum, score) => sum + score, 0);
    const recordedSaturdays = studentRecords.length;
    const averagePoints = recordedSaturdays > 0 ? roundTo(totalPoints / recordedSaturdays) : 0;
    const recentTrend = getRecentTrend(scores);
    const eligibleElapsedSaturdays = resolvedPeriod
      ? elapsedPeriodSchedule
          .filter((date) => isScoringParticipantEligibleOnDate(student, date))
          .length
      : launchedSaturdays;
    const eligibleTotalSaturdays = resolvedPeriod
      ? periodSchedule.filter((date) => isScoringParticipantEligibleOnDate(student, date)).length
      : totalSaturdays;
    const studentPossiblePointsToDate = standardPossiblePerSaturday * eligibleElapsedSaturdays;

    return {
      studentId: student.id,
      studentName: student.full_name,
      photoUrl: student.photo_url,
      rank: 0,
      totalPoints,
      averagePoints,
      recordedSaturdays,
      eligibleElapsedSaturdays,
      eligibleTotalSaturdays,
      possiblePoints: studentPossiblePointsToDate,
      progressPercent: studentPossiblePointsToDate > 0
        ? roundTo((totalPoints / studentPossiblePointsToDate) * 100)
        : 0,
      classAverageDelta: 0,
      pointsBehindPrevious: null,
      recentTrend,
      status: "estavel" as RankingStatus,
    };
  });

  const classAverage = studentRows.length > 0
    ? roundTo(studentRows.reduce((sum, student) => sum + student.totalPoints, 0) / studentRows.length)
    : 0;
  const classHighest = Math.max(0, ...studentRows.map((student) => student.totalPoints));

  const rankedStudents = studentRows
    .map((student) => ({
      ...student,
      classAverageDelta: roundTo(student.totalPoints - classAverage),
      status: getStatus({
        totalPoints: student.totalPoints,
        averagePoints: student.averagePoints,
        classTotalAverage: classAverage,
        classAverage: launchedSaturdays > 0 ? roundTo(classAverage / launchedSaturdays) : 0,
        recordedSaturdays: student.recordedSaturdays,
        launchedSaturdays: student.eligibleElapsedSaturdays,
        recentTrend: student.recentTrend,
      }),
    }))
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) return right.totalPoints - left.totalPoints;
      if (right.averagePoints !== left.averagePoints) return right.averagePoints - left.averagePoints;
      return left.studentName.localeCompare(right.studentName, "pt-BR");
    })
    .map((student, index, sortedStudents) => ({
      ...student,
      rank: index + 1,
      pointsBehindPrevious: index === 0
        ? null
        : Math.max(0, sortedStudents[index - 1].totalPoints - student.totalPoints),
    }));

  const dayByDate = new Map(orderedDays.map((day) => [day.day_date, day]));
  const weeklyDays = periodSchedule.length > 0
    ? periodSchedule.map((dayDate) => dayByDate.get(dayDate) || { id: null, day_date: dayDate })
    : orderedDays;
  const weeklyAverages = weeklyDays.map((day) => {
    const dayId = day.id;
    const dayRecords = dayId ? recordsByDay.get(dayId) || [] : [];
    const classAverageForDay = dayRecords.length > 0
      ? roundTo(dayRecords.reduce((sum, record) => sum + Number(record.total_points || 0), 0) / dayRecords.length)
      : 0;

    return {
      dayId,
      dayDate: day.day_date,
      label: formatDayLabel(day.day_date),
      classAverage: classAverageForDay,
    };
  });

  return {
    period: resolvedPeriod,
    summary: {
      launchedSaturdays,
      elapsedSaturdays,
      saturdaysWithRecords,
      completeSaturdays,
      totalSaturdays,
      standardPossiblePerSaturday,
      possiblePointsToDate,
      projectedPossiblePoints,
      classAverage,
      classHighest,
      studentCount: students.length,
    },
    students: rankedStudents,
    weeklyAverages,
  };
}
