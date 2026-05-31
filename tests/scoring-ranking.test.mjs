import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/scoring/ranking.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const {
  buildClassScoringRanking,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const students = [
  { id: "ana", full_name: "Ana Clara", photo_url: "ana.jpg" },
  { id: "bia", full_name: "Bia Santos", photo_url: null },
  { id: "caio", full_name: "Caio Lima", photo_url: null },
  { id: "davi", full_name: "Davi Rocha", photo_url: null },
];

const days = [
  { id: "d1", day_date: "2026-04-04" },
  { id: "d2", day_date: "2026-04-11" },
  { id: "d3", day_date: "2026-04-18" },
];

const rules = [
  { points: 2, is_active: true },
  { points: 3, is_active: true },
  { points: 10, is_active: false },
];

test("monta ranking trimestral com ordenação, métricas e status", () => {
  const ranking = buildClassScoringRanking({
    students,
    days,
    rules,
    records: [
      { student_id: "ana", day_id: "d1", total_points: 8 },
      { student_id: "ana", day_id: "d2", total_points: 10 },
      { student_id: "ana", day_id: "d3", total_points: 12 },
      { student_id: "bia", day_id: "d1", total_points: 10 },
      { student_id: "bia", day_id: "d2", total_points: 10 },
      { student_id: "bia", day_id: "d3", total_points: 10 },
      { student_id: "caio", day_id: "d1", total_points: 20 },
      { student_id: "davi", day_id: "d1", total_points: 4 },
      { student_id: "davi", day_id: "d2", total_points: 3 },
      { student_id: "davi", day_id: "d3", total_points: 2 },
    ],
  });

  assert.deepEqual(ranking.summary, {
    launchedSaturdays: 3,
    totalSaturdays: 13,
    standardPossiblePerSaturday: 5,
    possiblePointsToDate: 15,
    projectedPossiblePoints: 65,
    classAverage: 22.25,
    classHighest: 30,
    studentCount: 4,
  });

  assert.deepEqual(ranking.students.map((student) => ({
    id: student.studentId,
    rank: student.rank,
    total: student.totalPoints,
    average: student.averagePoints,
    recorded: student.recordedSaturdays,
    behind: student.pointsBehindPrevious,
    status: student.status,
  })), [
    { id: "ana", rank: 1, total: 30, average: 10, recorded: 3, behind: null, status: "subindo" },
    { id: "bia", rank: 2, total: 30, average: 10, recorded: 3, behind: 0, status: "estavel" },
    { id: "caio", rank: 3, total: 20, average: 20, recorded: 1, behind: 10, status: "recuperando" },
    { id: "davi", rank: 4, total: 9, average: 3, recorded: 3, behind: 11, status: "atencao" },
  ]);

  assert.deepEqual(ranking.weeklyAverages.map((week) => ({
    label: week.label,
    average: week.classAverage,
  })), [
    { label: "04/04", average: 10.5 },
    { label: "11/04", average: 7.67 },
    { label: "18/04", average: 8 },
  ]);
});

test("respeita a data inicial do trimestre e mantém 13 semanas no gráfico", () => {
  const ranking = buildClassScoringRanking({
    students,
    days,
    rules,
    trimesterStartDate: "2026-04-11",
    records: [
      { student_id: "ana", day_id: "d1", total_points: 8 },
      { student_id: "ana", day_id: "d2", total_points: 10 },
      { student_id: "ana", day_id: "d3", total_points: 12 },
      { student_id: "bia", day_id: "d1", total_points: 10 },
      { student_id: "bia", day_id: "d2", total_points: 10 },
      { student_id: "bia", day_id: "d3", total_points: 10 },
      { student_id: "caio", day_id: "d1", total_points: 20 },
    ],
  });

  assert.equal(ranking.summary.launchedSaturdays, 2);
  assert.deepEqual(ranking.students.map((student) => ({
    id: student.studentId,
    total: student.totalPoints,
    recorded: student.recordedSaturdays,
  })), [
    { id: "ana", total: 22, recorded: 2 },
    { id: "bia", total: 20, recorded: 2 },
    { id: "caio", total: 0, recorded: 0 },
    { id: "davi", total: 0, recorded: 0 },
  ]);

  assert.equal(ranking.weeklyAverages.length, 13);
  assert.deepEqual(ranking.weeklyAverages.slice(0, 3).map((week) => ({
    label: week.label,
    average: week.classAverage,
  })), [
    { label: "11/04", average: 10 },
    { label: "18/04", average: 11 },
    { label: "25/04", average: 0 },
  ]);
});
