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

test("cadastro do verso não avança uma data para o sábado seguinte", () => {
  const classesActionsSource = readFileSync(
    join(repoRoot, "app", "actions", "classes.ts"),
    "utf8",
  );

  assert.match(
    classesActionsSource,
    /!isDateOnly\(raw\)\s*\|\|\s*!isSaturdayDate\(raw\)/,
    "weekly verse dates should be accepted only when they are the exact Sabbath",
  );
  assert.doesNotMatch(
    classesActionsSource,
    /saturday\.setDate\(saturday\.getDate\(\)\s*\+\s*\(6\s*-\s*saturday\.getDay\(\)\)\)/,
    "weekly verse registration should not silently move dates to the next Sabbath",
  );
});

test("verso aparece apenas na confirmação contextual e exige uma resposta antes de pontuar", () => {
  const attendancePage = readFileSync(
    join(repoRoot, "app", "relatorios", "lancamento", "page.tsx"),
    "utf8",
  );
  const scoringSheet = readFileSync(
    join(repoRoot, "components", "ui", "AttendanceScoringSheet.tsx"),
    "utf8",
  );
  const verseModal = readFileSync(
    join(repoRoot, "components", "ui", "AttendanceVerseConfirmationModal.tsx"),
    "utf8",
  );

  assert.doesNotMatch(attendancePage, /WeeklyBibleVerseStickyCard/);
  assert.match(attendancePage, /weeklyBibleVerse=\{weeklyBibleVerse\}/);
  assert.match(scoringSheet, /AttendanceVerseConfirmationModal/);
  assert.match(scoringSheet, /rule\.name\.toLowerCase\(\)\.includes\("verso"\)/);
  assert.match(scoringSheet, /setVerseRulePendingConfirmation\(rule\)/);
  assert.match(verseModal, /Sabe/);
  assert.match(verseModal, /Não sabe/);
  assert.match(verseModal, /backdrop-blur/);
  assert.match(verseModal, /\{verse\.bible_book\} \{verse\.chapter_number\}:\{verse\.verse_reference\}/);
});
