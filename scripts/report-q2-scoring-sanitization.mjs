import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

export const Q2_2026_START_DATE = "2026-04-11";
export const Q2_2026_LAST_SATURDAY = "2026-07-04";

export const KNOWN_Q2_2026_BASELINE = Object.freeze({
  scoringFormulaMismatches: 22,
  currentRulePointMismatches: 7,
  unattributedDirectInsertEvents: 190,
  recordCountsByDate: Object.freeze({
    "2026-05-23": 0,
    "2026-06-06": 7,
    "2026-07-04": 18,
  }),
});

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");
  }
}

function loadLocalEnv() {
  const cwd = process.cwd();
  for (const filename of [".env", ".env.local"]) {
    loadEnvFile(resolve(cwd, filename));
  }
}

function addDays(dayDate, daysToAdd) {
  const [year, month, day] = dayDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + daysToAdd, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

function buildSaturdaySlots(startDate = Q2_2026_START_DATE, count = 13) {
  return Array.from({ length: count }, (_, index) => addDays(startDate, index * 7));
}

function scoringKey(dayId, studentId) {
  return `${dayId}:${studentId}`;
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function isKnownUnattributedDirectInsert(entry) {
  return entry.operation === "insert"
    && !entry.actor_user_id
    && String(entry.actor_name || "").trim().toLocaleLowerCase("pt-BR") === "sistema"
    && !entry.request_id
    && String(entry.source || "").trim().toLocaleLowerCase("pt-BR") === "database"
    && String(entry.reason || "").trim().toLocaleLowerCase("pt-BR")
      === "direct scoring table change without rpc reason";
}

function groupCount(rows, readKey) {
  const counts = new Map();
  for (const row of rows) {
    const key = readKey(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function compareKnownBaseline({ mismatches, rulePointMismatches, dateCoverage, unattributedEvents }) {
  const actualRecordCounts = Object.fromEntries(
    dateCoverage
      .filter((entry) => entry.dayDate in KNOWN_Q2_2026_BASELINE.recordCountsByDate)
      .map((entry) => [entry.dayDate, entry.recordCount]),
  );

  const checks = {
    scoringFormulaMismatches:
      mismatches.length === KNOWN_Q2_2026_BASELINE.scoringFormulaMismatches,
    currentRulePointMismatches:
      rulePointMismatches.length === KNOWN_Q2_2026_BASELINE.currentRulePointMismatches,
    unattributedDirectInsertEvents:
      unattributedEvents.length === KNOWN_Q2_2026_BASELINE.unattributedDirectInsertEvents,
    recordCountsByDate: Object.entries(KNOWN_Q2_2026_BASELINE.recordCountsByDate)
      .every(([dayDate, expected]) => actualRecordCounts[dayDate] === expected),
  };

  return {
    expected: KNOWN_Q2_2026_BASELINE,
    checks,
    matchesKnownBaseline: Object.values(checks).every(Boolean),
  };
}

export function buildQ2ScoringSanitizationReport({
  classes = [],
  students = [],
  attendanceDays = [],
  attendanceRecords = [],
  attendanceScores = [],
  scoringRules = [],
  auditLogs = [],
} = {}) {
  const q2Slots = buildSaturdaySlots();
  const q2SlotDates = new Set(q2Slots);
  const q2Days = attendanceDays.filter((day) => q2SlotDates.has(day.day_date));
  const q2DayIds = new Set(q2Days.map((day) => day.id));
  const dayById = new Map(q2Days.map((day) => [day.id, day]));
  const currentRuleById = new Map(scoringRules.map((rule) => [rule.id, rule]));

  const q2Scores = attendanceScores.filter((score) => q2DayIds.has(score.day_id));
  const scoreSumByStudentDay = new Map();
  for (const score of q2Scores) {
    const key = scoringKey(score.day_id, score.student_id);
    scoreSumByStudentDay.set(
      key,
      (scoreSumByStudentDay.get(key) || 0) + toNumber(score.points_earned),
    );
  }

  const q2Records = attendanceRecords.filter((record) => q2DayIds.has(record.day_id));
  const mismatches = q2Records.flatMap((record) => {
    const scorePoints = scoreSumByStudentDay.get(scoringKey(record.day_id, record.student_id)) || 0;
    const extraActivityPoints = toNumber(record.extra_activity_points);
    const disciplinePenaltyPoints = toNumber(record.discipline_penalty_points);
    const expectedTotal = scorePoints + extraActivityPoints - disciplinePenaltyPoints;
    const persistedTotal = toNumber(record.total_points);
    const difference = persistedTotal - expectedTotal;
    if (difference === 0) return [];

    return [{
      recordId: record.id,
      classId: record.class_id || dayById.get(record.day_id)?.class_id || null,
      dayId: record.day_id,
      dayDate: dayById.get(record.day_id)?.day_date || null,
      studentId: record.student_id,
      persistedTotal,
      scorePoints,
      extraActivityPoints,
      disciplinePenaltyPoints,
      expectedTotal,
      difference,
    }];
  }).sort((left, right) => (
    String(left.dayDate).localeCompare(String(right.dayDate))
      || String(left.studentId).localeCompare(String(right.studentId))
  ));

  const rulePointMismatches = q2Scores.flatMap((score) => {
    const currentRule = currentRuleById.get(score.rule_id);
    if (!currentRule) return [];

    const persistedPoints = toNumber(score.points_earned);
    const currentRulePoints = toNumber(currentRule.points);
    if (persistedPoints === currentRulePoints) return [];

    return [{
      scoreId: score.id,
      classId: score.class_id || dayById.get(score.day_id)?.class_id || currentRule.class_id || null,
      dayId: score.day_id,
      dayDate: dayById.get(score.day_id)?.day_date || null,
      studentId: score.student_id,
      ruleId: score.rule_id,
      persistedPoints,
      currentRulePoints,
      difference: persistedPoints - currentRulePoints,
      warning: "A regra atual não comprova qual valor vigorava no Q2; não corrigir automaticamente.",
    }];
  }).sort((left, right) => (
    String(left.dayDate).localeCompare(String(right.dayDate))
      || String(left.studentId).localeCompare(String(right.studentId))
  ));

  const classIds = new Set([
    ...classes.map((entry) => entry.id),
    ...q2Days.map((entry) => entry.class_id),
  ].filter(Boolean));
  const activeRosterByClass = new Map();
  for (const student of students) {
    if (student.is_active === false || !classIds.has(student.class_id)) continue;
    activeRosterByClass.set(
      student.class_id,
      (activeRosterByClass.get(student.class_id) || 0) + 1,
    );
  }
  const recordCountByClassDate = new Map();
  for (const record of q2Records) {
    const day = dayById.get(record.day_id);
    if (!day) continue;
    const key = `${day.class_id}:${day.day_date}`;
    recordCountByClassDate.set(key, (recordCountByClassDate.get(key) || 0) + 1);
  }
  const dateCoverage = [...classIds].flatMap((classId) => q2Slots.map((dayDate) => {
    const day = q2Days.find((entry) => entry.class_id === classId && entry.day_date === dayDate);
    const recordCount = recordCountByClassDate.get(`${classId}:${dayDate}`) || 0;
    const currentActiveRoster = activeRosterByClass.get(classId) || 0;

    return {
      classId,
      dayId: day?.id || null,
      dayDate,
      recordCount,
      currentActiveRoster,
      differenceFromCurrentRoster: recordCount - currentActiveRoster,
      reviewRequired: !day || recordCount !== currentActiveRoster,
      warning: "O roster ativo atual é apenas referência; exige reconstrução histórica antes de concluir que faltam registros.",
    };
  }));

  const unattributedEvents = auditLogs
    .filter((entry) => q2DayIds.has(entry.day_id))
    .filter(isKnownUnattributedDirectInsert)
    .map((entry) => ({
      auditId: entry.id,
      tableName: entry.table_name,
      rowId: entry.row_id,
      classId: entry.class_id || dayById.get(entry.day_id)?.class_id || null,
      dayId: entry.day_id,
      dayDate: dayById.get(entry.day_id)?.day_date || null,
      studentId: entry.student_id,
      changedAt: entry.changed_at,
      transactionId: entry.transaction_id,
      actorUserId: entry.actor_user_id,
      actorName: entry.actor_name,
      requestId: entry.request_id,
      source: entry.source,
      reason: entry.reason,
    }))
    .sort((left, right) => (
      String(left.dayDate).localeCompare(String(right.dayDate))
        || String(left.tableName).localeCompare(String(right.tableName))
        || String(left.auditId).localeCompare(String(right.auditId))
    ));

  const unattributedByDay = groupCount(
    unattributedEvents,
    (entry) => entry.dayDate || "unknown",
  ).map(({ key, count }) => ({ dayDate: key, count }));
  const unattributedByTable = groupCount(
    unattributedEvents,
    (entry) => entry.tableName || "unknown",
  ).map(({ key, count }) => ({ tableName: key, count }));

  const summary = {
    period: {
      label: "Q2 2026",
      startDate: Q2_2026_START_DATE,
      lastSaturday: Q2_2026_LAST_SATURDAY,
      saturdayCount: q2Slots.length,
    },
    classCount: classIds.size,
    currentActiveStudentCount: [...activeRosterByClass.values()]
      .reduce((sum, count) => sum + count, 0),
    attendanceDayCount: q2Days.length,
    attendanceRecordCount: q2Records.length,
    attendanceScoreCount: q2Scores.length,
    scoringFormulaMismatchCount: mismatches.length,
    currentRulePointMismatchCount: rulePointMismatches.length,
    dateCoverageReviewCount: dateCoverage.filter((entry) => entry.reviewRequired).length,
    unattributedDirectInsertEventCount: unattributedEvents.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    summary,
    knownBaselineComparison: compareKnownBaseline({
      mismatches,
      rulePointMismatches,
      dateCoverage,
      unattributedEvents,
    }),
    scoringFormulaMismatches: mismatches,
    currentRulePointMismatches: rulePointMismatches,
    dateCoverage,
    unattributedDirectInsertEvents: {
      summaryByDay: unattributedByDay,
      summaryByTable: unattributedByTable,
      rows: unattributedEvents,
    },
  };
}

async function fetchAll(makeQuery, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL não está configurada.");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não está configurada.");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket },
  });

  const [classes, students, attendanceDays, scoringRules] = await Promise.all([
    fetchAll(() => supabase.from("classes").select("id,name,is_active")),
    fetchAll(() => supabase.from("students").select("id,class_id,is_active")),
    fetchAll(() => supabase
      .from("attendance_days")
      .select("id,class_id,day_date")
      .gte("day_date", Q2_2026_START_DATE)
      .lte("day_date", Q2_2026_LAST_SATURDAY)),
    fetchAll(() => supabase
      .from("class_scoring_rules")
      .select("id,class_id,points,is_active")),
  ]);

  const q2DayIds = attendanceDays.map((day) => day.id);
  const [attendanceRecords, attendanceScores, auditLogs] = q2DayIds.length === 0
    ? [[], [], []]
    : await Promise.all([
        fetchAll(() => supabase
          .from("student_attendance_records")
          .select("id,class_id,day_id,student_id,total_points,extra_activity_points,discipline_penalty_points,saved_by,saved_at,updated_at")
          .in("day_id", q2DayIds)),
        fetchAll(() => supabase
          .from("attendance_scores")
          .select("id,class_id,day_id,student_id,rule_id,points_earned,created_at")
          .in("day_id", q2DayIds)),
        fetchAll(() => supabase
          .from("scoring_audit_log")
          .select("id,request_id,table_name,operation,row_id,class_id,day_id,student_id,actor_user_id,actor_name,changed_at,transaction_id,reason,source")
          .in("day_id", q2DayIds)),
      ]);

  const report = buildQ2ScoringSanitizationReport({
    classes,
    students,
    attendanceDays,
    attendanceRecords,
    attendanceScores,
    scoringRules,
    auditLogs,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
