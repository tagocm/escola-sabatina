import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import ts from "typescript";

function transpile(pathname) {
  const source = readFileSync(new URL(pathname, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

const rankingOutput = transpile("../lib/scoring/ranking.ts");
const rankingUrl = `data:text/javascript;base64,${Buffer.from(rankingOutput).toString("base64")}`;
const detailOutput = transpile("../lib/scoring/student-detail.ts")
  .replace(/from "\.\/ranking"/g, `from "${rankingUrl}"`);
const {
  buildStudentScoringDetail,
  buildStudentScoringChartData,
  buildStudentScoringCumulativeChartData,
} = await import(`data:text/javascript;base64,${Buffer.from(detailOutput).toString("base64")}`);

const students = [
  { id: "ana", full_name: "Ana Clara", photo_url: null, class_id: "classe-a", class_name: "Juvenis" },
  { id: "bia", full_name: "Bia Santos", photo_url: null, class_id: "classe-a", class_name: "Juvenis" },
];

const days = [
  { id: "d1", day_date: "2026-04-11" },
  { id: "d2", day_date: "2026-04-18" },
  { id: "d3", day_date: "2026-04-25" },
];

const rules = [
  { id: "presenca", name: "Presença", category: "frequencia", points: 2, is_active: true, display_order: 1 },
  { id: "biblia", name: "Bíblia", category: "espiritual", points: 3, is_active: true, display_order: 2 },
  { id: "atividade", name: "Atividade", category: "atividade", points: 1, is_active: true, display_order: 3 },
  { id: "cantar", name: "Participação cantar", category: "participacao", points: 2, is_active: true, display_order: 4 },
];

test("monta auditoria individual com categorias, ajustes e ranking diário", () => {
  const detail = buildStudentScoringDetail({
    student: students[0],
    students,
    days,
    rules,
    records: [
      {
        id: "ana-d1",
        student_id: "ana",
        day_id: "d1",
        total_points: 7,
        extra_activity_points: 2,
        discipline_penalty_points: 1,
        saved_by: "teacher-1",
        saved_by_name: "Professora Marta",
        discipline_penalty_reason: "Conversa paralela",
        discipline_penalty_applied_by_name: "Professora Marta",
        saved_at: "2026-04-11T12:00:00Z",
      },
      {
        id: "ana-d2",
        student_id: "ana",
        day_id: "d2",
        total_points: 2,
        extra_activity_points: 0,
        discipline_penalty_points: 0,
        saved_by: "teacher-2",
        saved_by_name: "Professor João",
        saved_at: "2026-04-18T12:00:00Z",
      },
      {
        id: "bia-d1",
        student_id: "bia",
        day_id: "d1",
        total_points: 6,
        extra_activity_points: 0,
        discipline_penalty_points: 0,
        saved_by: "teacher-1",
        saved_by_name: "Professora Marta",
        saved_at: "2026-04-11T12:00:00Z",
      },
      {
        id: "bia-d2",
        student_id: "bia",
        day_id: "d2",
        total_points: 8,
        extra_activity_points: 0,
        discipline_penalty_points: 0,
        saved_by: "teacher-1",
        saved_by_name: "Professora Marta",
        saved_at: "2026-04-18T12:00:00Z",
      },
      {
        id: "bia-d3",
        student_id: "bia",
        day_id: "d3",
        total_points: 5,
        extra_activity_points: 0,
        discipline_penalty_points: 0,
        saved_by: "teacher-2",
        saved_by_name: "Professor João",
        saved_at: "2026-04-25T12:00:00Z",
      },
    ],
    scores: [
      { student_id: "ana", day_id: "d1", rule_id: "presenca", points_earned: 2 },
      { student_id: "ana", day_id: "d1", rule_id: "biblia", points_earned: 3 },
      { student_id: "ana", day_id: "d1", rule_id: "atividade", points_earned: 1 },
      { student_id: "ana", day_id: "d2", rule_id: "presenca", points_earned: 2 },
      { student_id: "bia", day_id: "d1", rule_id: "presenca", points_earned: 2 },
      { student_id: "bia", day_id: "d1", rule_id: "biblia", points_earned: 3 },
      { student_id: "bia", day_id: "d1", rule_id: "atividade", points_earned: 1 },
      { student_id: "bia", day_id: "d2", rule_id: "presenca", points_earned: 2 },
      { student_id: "bia", day_id: "d2", rule_id: "biblia", points_earned: 3 },
      { student_id: "bia", day_id: "d2", rule_id: "atividade", points_earned: 1 },
      { student_id: "bia", day_id: "d2", rule_id: "cantar", points_earned: 2 },
      { student_id: "bia", day_id: "d3", rule_id: "presenca", points_earned: 2 },
      { student_id: "bia", day_id: "d3", rule_id: "biblia", points_earned: 3 },
    ],
    disciplineEvents: [
      {
        id: "event-1",
        record_id: "ana-d1",
        day_id: "d1",
        student_id: "ana",
        points: 1,
        reason: "Conversa paralela",
        applied_by_name: "Professora Marta",
        created_at: "2026-04-11T12:10:00Z",
        updated_at: "2026-04-11T12:10:00Z",
      },
    ],
    auditLogs: [
      {
        id: "audit-2",
        request_id: "request-2",
        table_name: "student_attendance_records",
        operation: "update",
        row_id: "ana-d2",
        day_id: "d2",
        student_id: "ana",
        actor_user_id: "teacher-2",
        actor_name: "Professor João",
        changed_at: "2026-04-18T12:30:00Z",
        transaction_id: 102,
        reason: "Correção após revisão da chamada",
        source: "save_student_attendance_record",
        metadata: { is_update: true },
        old_data: { total_points: 3 },
        new_data: { total_points: 2 },
      },
      {
        id: "audit-1",
        request_id: "request-1",
        table_name: "student_attendance_records",
        operation: "insert",
        row_id: "ana-d1",
        day_id: "d1",
        student_id: "ana",
        actor_user_id: "teacher-1",
        actor_name: "Professora Marta",
        changed_at: "2026-04-11T12:00:00Z",
        transaction_id: 101,
        reason: "Lançamento regular da pontuação semanal.",
        source: "save_student_attendance_record",
        metadata: { is_update: false },
        old_data: null,
        new_data: { total_points: 7 },
      },
    ],
    trimesterStartDate: "2026-04-11",
    currentDate: "2026-04-25",
  });

  assert.ok(detail);
  assert.equal(detail.summary.rank, 2);
  assert.equal(detail.summary.totalPoints, 9);
  assert.equal(detail.summary.launchedSaturdays, 3);
  assert.equal(detail.summary.daysWithoutRecord, 1);
  assert.deepEqual(detail.adjustmentTotals, {
    extraActivityPoints: 2,
    disciplinePenaltyPoints: 1,
  });
  assert.deepEqual(detail.categorySummaries.map((category) => ({
    category: category.category,
    points: category.points,
    possible: category.possiblePoints,
    progress: category.progressPercent,
  })), [
    { category: "frequencia", points: 4, possible: 6, progress: 66.67 },
    { category: "espiritual", points: 3, possible: 9, progress: 33.33 },
    { category: "atividade", points: 1, possible: 3, progress: 33.33 },
    { category: "participacao", points: 0, possible: 6, progress: 0 },
  ]);
  assert.equal(detail.strongestCategory?.category, "frequencia");
  assert.equal(detail.weakestCategory?.category, "participacao");
  assert.equal(detail.disciplineEvents[0].reason, "Conversa paralela");
  assert.deepEqual(detail.auditLog.map((entry) => ({
    operation: entry.operation,
    actor: entry.actorName,
    reason: entry.reason,
    source: entry.source,
  })), [
    {
      operation: "update",
      actor: "Professor João",
      reason: "Correção após revisão da chamada",
      source: "save_student_attendance_record",
    },
    {
      operation: "insert",
      actor: "Professora Marta",
      reason: "Lançamento regular da pontuação semanal.",
      source: "save_student_attendance_record",
    },
  ]);

  assert.deepEqual(detail.timeline.slice(0, 3).map((week) => ({
    date: week.dayDate,
    total: week.totalPoints,
    average: week.classAverage,
    rank: week.dailyRank,
    hasRecord: week.hasRecord,
    savedBy: week.savedByName,
    savedAt: week.savedAt,
    selected: week.selectedRules.map((rule) => rule.ruleId),
    missed: week.missedRules.map((rule) => rule.ruleId),
  })), [
    {
      date: "2026-04-11",
      total: 7,
      average: 6.5,
      rank: 1,
      hasRecord: true,
      savedBy: "Professora Marta",
      savedAt: "2026-04-11T12:00:00Z",
      selected: ["presenca", "biblia", "atividade"],
      missed: ["cantar"],
    },
    {
      date: "2026-04-18",
      total: 2,
      average: 5,
      rank: 2,
      hasRecord: true,
      savedBy: "Professor João",
      savedAt: "2026-04-18T12:00:00Z",
      selected: ["presenca"],
      missed: ["biblia", "atividade", "cantar"],
    },
    {
      date: "2026-04-25",
      total: 0,
      average: 5,
      rank: null,
      hasRecord: false,
      savedBy: null,
      savedAt: null,
      selected: [],
      missed: [],
    },
  ]);

  assert.deepEqual(buildStudentScoringChartData(detail).map((point) => point.studentScore), [7, 2, 0]);
  assert.deepEqual(buildStudentScoringCumulativeChartData(detail).map((point) => point.studentScore), [7, 9, 9]);
});
