import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

test("tela de chamada busca o verso bíblico do sábado selecionado", () => {
  const attendancePageSource = readFileSync(
    join(repoRoot, "app", "relatorios", "lancamento", "page.tsx"),
    "utf8",
  );

  assert.match(
    attendancePageSource,
    /getClassWeeklyBibleVerseByWeek\(classId,\s*saturdayStr\)/,
    "attendance page should fetch the verse registered for the selected sabbath",
  );
  assert.doesNotMatch(
    attendancePageSource,
    /getClassWeeklyBibleVerseByWeek\(classId,\s*shiftSaturday\(saturdayStr,\s*-1\)\)/,
    "attendance page should not fetch the previous sabbath verse",
  );
  assert.doesNotMatch(
    attendancePageSource,
    /const\s+verseWeekStr\s*=\s*shiftSaturday\(saturdayStr,\s*-1\)/,
    "attendance page should not keep a shifted verse week variable",
  );
});
