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

const calendarOutput = transpile("../lib/calendar/sabbath-period.ts");
const calendarUrl = `data:text/javascript;base64,${Buffer.from(calendarOutput).toString("base64")}`;
const periodsOutput = transpile("../lib/scoring/periods.ts")
  .replace(/from "\.\.\/calendar\/sabbath-period"/g, `from "${calendarUrl}"`);
const periodsUrl = `data:text/javascript;base64,${Buffer.from(periodsOutput).toString("base64")}`;
const rankingOutput = transpile("../lib/scoring/ranking.ts")
  .replace(/from "\.\/periods"/g, `from "${periodsUrl}"`);
const rankingUrl = `data:text/javascript;base64,${Buffer.from(rankingOutput).toString("base64")}`;
const detailOutput = transpile("../lib/scoring/student-detail.ts")
  .replace(/from "\.\/ranking"/g, `from "${rankingUrl}"`)
  .replace(/from "\.\/periods"/g, `from "${periodsUrl}"`);
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
  assert.equal(detail.summary.elapsedSaturdays, 3);
  assert.equal(detail.summary.saturdaysWithRecords, 3);
  assert.equal(detail.summary.completeSaturdays, 2);
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

test("limita detalhe e auditoria ao período selecionado", () => {
  const makeRecord = (id, dayId, totalPoints) => ({
    id,
    student_id: "ana",
    day_id: dayId,
    total_points: totalPoints,
    extra_activity_points: 0,
    discipline_penalty_points: 0,
    saved_by: "teacher-1",
    saved_by_name: "Professora Marta",
    saved_at: "2026-07-11T12:00:00Z",
  });
  const makeAudit = (id, dayId, changedAt) => ({
    id,
    request_id: id,
    table_name: "student_attendance_records",
    operation: "insert",
    row_id: id,
    day_id: dayId,
    student_id: "ana",
    actor_user_id: "teacher-1",
    actor_name: "Professora Marta",
    changed_at: changedAt,
    transaction_id: 1,
    reason: "Lançamento regular",
    source: "save_student_attendance_record",
    metadata: {},
    old_data: null,
    new_data: { total_points: 7 },
  });
  const detail = buildStudentScoringDetail({
    student: students[0],
    students: [students[0]],
    days: [
      { id: "q2-last", day_date: "2026-07-04" },
      { id: "q3-first", day_date: "2026-07-11" },
    ],
    rules: [rules[0]],
    records: [
      makeRecord("record-q2", "q2-last", 20),
      makeRecord("record-q3", "q3-first", 7),
    ],
    scores: [
      { student_id: "ana", day_id: "q2-last", rule_id: "presenca", points_earned: 2 },
      { student_id: "ana", day_id: "q3-first", rule_id: "presenca", points_earned: 2 },
    ],
    disciplineEvents: [],
    auditLogs: [
      makeAudit("audit-q2", "q2-last", "2026-07-04T12:00:00Z"),
      makeAudit("audit-q3", "q3-first", "2026-07-11T12:00:00Z"),
    ],
    period: {
      id: "2026-q3",
      label: "3º trimestre de 2026",
      startDate: "2026-07-11",
      expectedSaturdays: 13,
    },
    currentDate: "2026-07-11",
  });

  assert.ok(detail);
  assert.equal(detail.period?.id, "2026-q3");
  assert.equal(detail.summary.totalPoints, 7);
  assert.equal(detail.summary.elapsedSaturdays, 1);
  assert.equal(detail.summary.saturdaysWithRecords, 1);
  assert.equal(detail.summary.completeSaturdays, 1);
  assert.equal(detail.timeline[0].dayDate, "2026-07-11");
  assert.equal(detail.timeline.some((week) => week.dayDate === "2026-07-04"), false);
  assert.deepEqual(detail.auditLog.map((entry) => entry.id), ["audit-q3"]);
});

test("não conta sábados anteriores à entrada do participante", () => {
  const transferredStudent = {
    ...students[0],
    joined_on: "2026-07-25",
    left_on: null,
  };
  const detail = buildStudentScoringDetail({
    student: transferredStudent,
    students: [transferredStudent],
    days: [
      { id: "d1", day_date: "2026-07-11" },
      { id: "d2", day_date: "2026-07-18" },
      { id: "d3", day_date: "2026-07-25" },
      { id: "d4", day_date: "2026-08-01" },
    ],
    rules: [rules[0]],
    records: [
      {
        id: "before-join",
        student_id: "ana",
        day_id: "d1",
        total_points: 99,
        extra_activity_points: 0,
        discipline_penalty_points: 0,
      },
      {
        id: "after-join",
        student_id: "ana",
        day_id: "d3",
        total_points: 2,
        extra_activity_points: 0,
        discipline_penalty_points: 0,
      },
    ],
    scores: [],
    disciplineEvents: [],
    period: {
      id: "transfer-period",
      label: "Período de transferência",
      startDate: "2026-07-11",
      expectedSaturdays: 4,
    },
    currentDate: "2026-08-01",
  });

  assert.ok(detail);
  assert.equal(detail.summary.totalPoints, 2);
  assert.equal(detail.summary.launchedSaturdays, 2);
  assert.equal(detail.summary.possiblePointsToDate, 4);
  assert.equal(detail.summary.daysWithoutRecord, 1);
  assert.deepEqual(detail.timeline.map((week) => week.isEligible), [false, false, true, true]);
});
