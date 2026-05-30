import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/attendance/student-display.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const {
  formatAttendanceStudentName,
  applySavedAttendanceStudent,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("formata primeiro nome e sobrenome para a polaroid", () => {
  assert.deepEqual(formatAttendanceStudentName("  Maria   Eduarda  Silva  "), {
    firstName: "MARIA",
    surname: "SILVA",
    compactName: "MARIA SILVA",
  });
});

test("mantém segundo nome como sobrenome quando só há dois nomes", () => {
  assert.deepEqual(formatAttendanceStudentName("João Pedro"), {
    firstName: "JOÃO",
    surname: "PEDRO",
    compactName: "JOÃO PEDRO",
  });
});

test("move aluno pendente para finalizado preservando dados atualizados", () => {
  const pendingStudents = [
    { student: { id: "1" }, initialSelectedRuleIds: [] },
    { student: { id: "2" }, initialSelectedRuleIds: ["old"] },
  ];
  const savedStudents = [
    { student: { id: "3" }, initialSelectedRuleIds: [] },
  ];
  const updatedStudent = {
    student: { id: "2" },
    initialSelectedRuleIds: ["new"],
    initialExtraActivityPoints: 1,
  };

  assert.deepEqual(applySavedAttendanceStudent(pendingStudents, savedStudents, updatedStudent), {
    pendingStudents: [
      { student: { id: "1" }, initialSelectedRuleIds: [] },
    ],
    savedStudents: [
      { student: { id: "2" }, initialSelectedRuleIds: ["new"], initialExtraActivityPoints: 1 },
      { student: { id: "3" }, initialSelectedRuleIds: [] },
    ],
  });
});
