import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const readSource = (path) => readFileSync(join(repoRoot, path), "utf8");

test("attendance reads do not create days and writes use the selected period", () => {
  const attendance = readSource("app/actions/attendance.ts");
  const contextBody = attendance.slice(
    attendance.indexOf("export async function getAttendanceContext"),
    attendance.indexOf("export async function saveStudentAttendanceRecord"),
  );
  const saveBody = attendance.slice(
    attendance.indexOf("export async function saveStudentAttendanceRecord"),
    attendance.indexOf("export async function updateOfferingAction"),
  );

  assert.match(contextBody, /\.maybeSingle\(\)/);
  assert.doesNotMatch(contextBody, /\.(insert|upsert|update|delete)\s*\(/);
  assert.match(saveBody, /save_student_attendance_record_v2/);
  assert.match(saveBody, /savedRecord\.period_id !== selectedPeriod\.id/);
  assert.match(saveBody, /requiresChangeReason/);

  const offeringBody = attendance.slice(
    attendance.indexOf("export async function updateOfferingAction"),
  );
  assert.match(offeringBody, /selectedPeriod\.schedule\.includes\(date\)/);
  assert.match(offeringBody, /savedOffering\.period_id !== selectedPeriod\.id/);
});

test("attendance preserves the resolved period while class settings centralize period selection", () => {
  const launchPage = readSource("app/relatorios/lancamento/page.tsx");
  const classPage = readSource("app/classes/[id]/page.tsx");
  const rankingPage = readSource("app/relatorios/pontuacao/page.tsx");
  const offeringPage = readSource("app/relatorios/ofertas/page.tsx");

  for (const source of [rankingPage, offeringPage, classPage]) {
    assert.match(source, /getClassScoringPeriodContext/);
    assert.match(source, /ScoringPeriodSelector/);
  }

  assert.match(launchPage, /getAttendanceContext\(classId, saturdayStr, selectedPeriod\.id\)/);
  assert.match(launchPage, /getScoringPeriodStudents\(classId, selectedPeriod\.id, saturdayStr\)/);
  assert.match(launchPage, /subtitle=\{selectedPeriod\.label\}/);
  assert.doesNotMatch(launchPage, /Registro de presença e pontuação da classe na data selecionada/);
  assert.doesNotMatch(launchPage, /ScoringPeriodSelector/);
  assert.doesNotMatch(launchPage, /ScoringPeriodStatusPanel/);
  assert.match(classPage, /ScoringPeriodStatusPanel/);
  assert.match(classPage, /ScoringPeriodDateGrid/);
  assert.match(classPage, /schedule=\{selectedPeriod\.schedule\}/);
  assert.match(classPage, /pathname=\{`\/classes\/\$\{id\}`\}/);
  assert.match(offeringPage, /\.eq\("period_id", selectedPeriod\.id\)/);
  assert.match(rankingPage, /getClassScoringRanking\(classId, selectedPeriod\?\.id \|\| query\.period\)/);
});

test("class settings offer each scheduled Saturday as a direct period-aware record link", () => {
  const dateGrid = readSource("components/ui/ScoringPeriodDateGrid.tsx");

  assert.match(dateGrid, /schedule\.map/);
  assert.match(dateGrid, /Sábado \{index \+ 1\}/);
  assert.match(dateGrid, /pathname: "\/relatorios\/lancamento"/);
  assert.match(dateGrid, /query: \{ period: periodId, d: date \}/);
  assert.match(dateGrid, /canWrite/);
  assert.match(dateGrid, /requiresChangeReason/);
});

test("guardian totals and class movement no longer imply a trimester rollover", () => {
  const guardianActions = readSource("app/actions/guardians.ts");
  const guardianPage = readSource("app/responsavel/filhos/[id]/acompanhe/page.tsx");
  const transferForm = readSource("components/ui/ClassTransferForm.tsx");
  const classActions = readSource("app/actions/classes.ts");

  assert.match(guardianActions, /get_guardian_student_progress_for_period/);
  assert.match(guardianActions, /get_guardian_class_offering_summary_for_period/);
  const deactivateGuardianBody = guardianActions.slice(
    guardianActions.indexOf("export async function deactivateGuardianStudent"),
    guardianActions.indexOf("// ============================================================\n// CREATE: Register a new child"),
  );
  assert.match(deactivateGuardianBody, /from\("guardian_students"\)/);
  assert.doesNotMatch(deactivateGuardianBody, /from\("students"\)[\s\S]*\.update\(/);
  assert.match(guardianPage, /getGuardianStudentScoringPeriods/);
  assert.match(guardianPage, /ScoringPeriodSelector/);
  assert.match(guardianPage, /period\.participantStatus === "active"/);
  assert.match(guardianPage, /period\.leftOn > today/);
  assert.match(guardianPage, /period\.className/);
  assert.match(transferForm, /não encerra o trimestre, não inicia uma nova contagem de pontos/);
  assert.doesNotMatch(transferForm, /Transferência de Trimestre/);
  assert.match(classActions, /move_active_students_to_class/);
  const transferAction = classActions.slice(
    classActions.indexOf("export async function transferStudentsToClassAction"),
    classActions.indexOf("export async function updateLastClass"),
  );
  assert.doesNotMatch(transferAction, /\.from\("students"\)[\s\S]*\.update\(/);
});

test("historical values remain explicit and locked periods remain consultable", () => {
  const launchPage = readSource("app/relatorios/lancamento/page.tsx");
  const rulesAction = readSource("app/actions/scoring-periods.ts");
  const scoringSheet = readSource("components/ui/AttendanceScoringSheet.tsx");
  const studentLists = readSource("components/ui/AttendanceStudentLists.tsx");

  assert.match(rulesAction, /variant_kind/);
  assert.match(rulesAction, /legacy_observed/);
  assert.match(launchPage, /periodRuleIds\.has\(score\.period_rule_id\)/);
  assert.match(scoringSheet, /Valor histórico preservado/);
  assert.match(scoringSheet, /currentRule\?\.sourceRuleId !== selectedRule\.sourceRuleId/);
  assert.match(studentLists, /readOnly=\{readOnly\}/);
  assert.doesNotMatch(
    studentLists.slice(
      studentLists.indexOf('status="saved"'),
      studentLists.indexOf("{selectedStudent ?"),
    ),
    /disabled=\{readOnly\}/,
  );
});
