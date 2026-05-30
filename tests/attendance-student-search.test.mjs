import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/attendance/student-search.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const {
  filterAttendanceStudents,
  normalizeAttendanceSearchText,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const students = [
  { id: "1", full_name: "Ana Clara Silva" },
  { id: "2", full_name: "João Pedro Santos" },
  { id: "3", full_name: "Maria Eduarda" },
];

test("filtra alunos pelo nome sem diferenciar acentos, caixa ou espaços", () => {
  assert.deepEqual(
    filterAttendanceStudents(students, "  joao   pedro ").map((student) => student.id),
    ["2"],
  );
});

test("retorna todos os alunos quando a busca está vazia", () => {
  assert.deepEqual(
    filterAttendanceStudents(students, "   ").map((student) => student.id),
    ["1", "2", "3"],
  );
});

test("normaliza texto de busca para comparação estável", () => {
  assert.equal(normalizeAttendanceSearchText("  ÁNA   Clára  "), "ana clara");
});
