import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildQ2ScoringSanitizationReport,
  Q2_2026_LAST_SATURDAY,
  Q2_2026_START_DATE,
} from "../scripts/report-q2-scoring-sanitization.mjs";

const repoRoot = process.cwd();

test("relatório de saneamento do Q2 calcula divergências sem escrever dados", () => {
  const report = buildQ2ScoringSanitizationReport({
    classes: [{ id: "class-1", name: "Juvenis", is_active: true }],
    students: [
      { id: "student-1", class_id: "class-1", is_active: true },
      { id: "student-2", class_id: "class-1", is_active: true },
    ],
    attendanceDays: [
      { id: "day-1", class_id: "class-1", day_date: "2026-04-11" },
      { id: "day-2", class_id: "class-1", day_date: "2026-04-18" },
      { id: "day-3", class_id: "class-1", day_date: "2026-06-27" },
      { id: "day-4", class_id: "class-1", day_date: "2026-07-04" },
    ],
    attendanceRecords: [
      {
        id: "record-1",
        class_id: "class-1",
        day_id: "day-1",
        student_id: "student-1",
        total_points: 3,
        extra_activity_points: 0,
        discipline_penalty_points: 0,
      },
      {
        id: "record-2",
        class_id: "class-1",
        day_id: "day-2",
        student_id: "student-2",
        total_points: 2,
        extra_activity_points: 0,
        discipline_penalty_points: 0,
      },
    ],
    attendanceScores: [
      {
        id: "score-1",
        class_id: "class-1",
        day_id: "day-1",
        student_id: "student-1",
        rule_id: "rule-1",
        points_earned: 2,
      },
      {
        id: "score-2",
        class_id: "class-1",
        day_id: "day-2",
        student_id: "student-2",
        rule_id: "rule-1",
        points_earned: 1,
      },
    ],
    scoringRules: [{ id: "rule-1", class_id: "class-1", points: 2, is_active: true }],
    auditLogs: [
      {
        id: "audit-1",
        request_id: null,
        table_name: "student_attendance_records",
        operation: "insert",
        row_id: "record-1",
        class_id: "class-1",
        day_id: "day-3",
        student_id: "student-1",
        actor_user_id: null,
        actor_name: "Sistema",
        changed_at: "2026-07-04T01:00:00Z",
        transaction_id: 1,
        reason: "direct scoring table change without RPC reason",
        source: "database",
      },
      {
        id: "audit-2",
        request_id: null,
        table_name: "attendance_scores",
        operation: "insert",
        row_id: "score-2",
        class_id: "class-1",
        day_id: "day-4",
        student_id: "student-2",
        actor_user_id: null,
        actor_name: "Sistema",
        changed_at: "2026-07-04T02:00:00Z",
        transaction_id: 2,
        reason: "direct scoring table change without RPC reason",
        source: "database",
      },
      {
        id: "audit-reasoned",
        request_id: "request-1",
        table_name: "attendance_scores",
        operation: "insert",
        row_id: "score-1",
        class_id: "class-1",
        day_id: "day-1",
        student_id: "student-1",
        actor_user_id: "teacher-1",
        actor_name: "Professora",
        changed_at: "2026-04-11T12:00:00Z",
        transaction_id: 3,
        reason: "Lançamento regular",
        source: "save_student_attendance_record",
      },
    ],
  });

  assert.equal(report.mode, "read-only");
  assert.equal(report.summary.period.startDate, Q2_2026_START_DATE);
  assert.equal(report.summary.period.lastSaturday, Q2_2026_LAST_SATURDAY);
  assert.equal(report.summary.scoringFormulaMismatchCount, 2);
  assert.deepEqual(
    report.scoringFormulaMismatches.map((entry) => entry.difference),
    [1, 1],
  );
  assert.equal(report.summary.currentRulePointMismatchCount, 1);
  assert.equal(report.currentRulePointMismatches[0].difference, -1);
  assert.equal(report.summary.unattributedDirectInsertEventCount, 2);
  assert.deepEqual(report.unattributedDirectInsertEvents.summaryByDay, [
    { dayDate: "2026-06-27", count: 1 },
    { dayDate: "2026-07-04", count: 1 },
  ]);

  const emptySaturday = report.dateCoverage.find((entry) => entry.dayDate === "2026-05-23");
  assert.equal(emptySaturday?.recordCount, 0);
  assert.equal(emptySaturday?.currentActiveRoster, 2);
  assert.equal(emptySaturday?.reviewRequired, true);
});

test("script do relatório preserva contrato estritamente read-only", () => {
  const source = readFileSync(
    join(repoRoot, "scripts", "report-q2-scoring-sanitization.mjs"),
    "utf8",
  );

  assert.doesNotMatch(source, /\.insert\s*\(/);
  assert.doesNotMatch(source, /\.update\s*\(/);
  assert.doesNotMatch(source, /\.upsert\s*\(/);
  assert.doesNotMatch(source, /\.delete\s*\(/);
  assert.doesNotMatch(source, /writeFile|appendFile|createWriteStream/);
  assert.match(source, /process\.stdout\.write/);
});
