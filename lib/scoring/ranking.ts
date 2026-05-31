export type RankingStatus = "subindo" | "estavel" | "recuperando" | "atencao";

export interface RankingStudentInput {
  id: string;
  full_name: string;
  photo_url: string | null;
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
  possiblePoints: number;
  progressPercent: number;
  classAverageDelta: number;
  pointsBehindPrevious: number | null;
  recentTrend: number;
  status: RankingStatus;
}

export interface ClassScoringRankingWeek {
  dayId: string;
  dayDate: string;
  label: string;
  classAverage: number;
}

export interface ClassScoringRanking {
  summary: {
    launchedSaturdays: number;
    totalSaturdays: 13;
    standardPossiblePerSaturday: number;
    possiblePointsToDate: number;
    projectedPossiblePoints: number;
    classAverage: number;
    classHighest: number;
    studentCount: number;
  };
  students: ClassScoringRankingStudent[];
  weeklyAverages: ClassScoringRankingWeek[];
}

interface BuildClassScoringRankingInput {
  students: RankingStudentInput[];
  days: RankingDayInput[];
  rules: RankingRuleInput[];
  records: RankingRecordInput[];
}

const TOTAL_TRIMESTER_SATURDAYS = 13;

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
}: BuildClassScoringRankingInput): ClassScoringRanking {
  const orderedDays = [...days].sort((left, right) => left.day_date.localeCompare(right.day_date));
  const launchedSaturdays = orderedDays.length;
  const standardPossiblePerSaturday = rules
    .filter((rule) => rule.is_active !== false)
    .reduce((sum, rule) => sum + Number(rule.points || 0), 0);
  const possiblePointsToDate = standardPossiblePerSaturday * launchedSaturdays;
  const projectedPossiblePoints = standardPossiblePerSaturday * TOTAL_TRIMESTER_SATURDAYS;

  const recordsByStudent = new Map<string, RankingRecordInput[]>();
  const recordsByDay = new Map<string, RankingRecordInput[]>();

  for (const record of records) {
    recordsByStudent.set(record.student_id, [
      ...(recordsByStudent.get(record.student_id) || []),
      record,
    ]);
    recordsByDay.set(record.day_id, [
      ...(recordsByDay.get(record.day_id) || []),
      record,
    ]);
  }

  const dayIndexById = new Map(orderedDays.map((day, index) => [day.id, index]));
  const studentRows = students.map((student) => {
    const studentRecords = [...(recordsByStudent.get(student.id) || [])]
      .sort((left, right) => (dayIndexById.get(left.day_id) ?? 0) - (dayIndexById.get(right.day_id) ?? 0));
    const scores = studentRecords.map((record) => Number(record.total_points || 0));
    const totalPoints = scores.reduce((sum, score) => sum + score, 0);
    const recordedSaturdays = studentRecords.length;
    const averagePoints = recordedSaturdays > 0 ? roundTo(totalPoints / recordedSaturdays) : 0;
    const recentTrend = getRecentTrend(scores);

    return {
      studentId: student.id,
      studentName: student.full_name,
      photoUrl: student.photo_url,
      rank: 0,
      totalPoints,
      averagePoints,
      recordedSaturdays,
      possiblePoints: possiblePointsToDate,
      progressPercent: possiblePointsToDate > 0 ? roundTo((totalPoints / possiblePointsToDate) * 100) : 0,
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
        launchedSaturdays,
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

  const weeklyAverages = orderedDays.map((day) => {
    const dayRecords = recordsByDay.get(day.id) || [];
    const classAverageForDay = dayRecords.length > 0
      ? roundTo(dayRecords.reduce((sum, record) => sum + Number(record.total_points || 0), 0) / dayRecords.length)
      : 0;

    return {
      dayId: day.id,
      dayDate: day.day_date,
      label: formatDayLabel(day.day_date),
      classAverage: classAverageForDay,
    };
  });

  return {
    summary: {
      launchedSaturdays,
      totalSaturdays: TOTAL_TRIMESTER_SATURDAYS,
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
