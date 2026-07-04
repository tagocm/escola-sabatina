import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function readLatestScoringAuditMigration() {
  const migrationsDir = join(repoRoot, "supabase", "migrations");
  const migrationName = readdirSync(migrationsDir)
    .filter((name) =>
      name.endsWith("_secure_scoring_audit_rpc.sql")
      || name.endsWith("_robust_scoring_audit_log.sql")
    )
    .sort()
    .at(-1);

  assert.ok(migrationName, "scoring audit migration should exist");
  return readFileSync(join(migrationsDir, migrationName), "utf8");
}

test("scoring audit migration gates writes through reasoned RPC", () => {
  const migrationSql = readLatestScoringAuditMigration();

  assert.match(
    migrationSql,
    /CREATE TABLE IF NOT EXISTS public\.scoring_audit_log/i,
    "migration should create append-only scoring audit table",
  );
  assert.match(
    migrationSql,
    /operation TEXT NOT NULL CHECK \(operation IN \('baseline', 'insert', 'update', 'delete'\)\)/i,
    "audit table should preserve a baseline plus future mutations",
  );
  assert.match(
    migrationSql,
    /request_id UUID/i,
    "audit rows should carry a request id to group all row changes from one save",
  );
  assert.match(
    migrationSql,
    /CREATE OR REPLACE FUNCTION private\.save_student_attendance_record_impl/i,
    "write implementation should live behind a private function",
  );
  assert.match(
    migrationSql,
    /CREATE OR REPLACE FUNCTION public\.save_student_attendance_record[\s\S]*SECURITY INVOKER/i,
    "public RPC should be a non-definer wrapper",
  );
  assert.match(
    migrationSql,
    /p_change_reason TEXT DEFAULT NULL/i,
    "secure scoring RPC should require an audit reason parameter",
  );
  assert.match(
    migrationSql,
    /Informe o motivo do lançamento ou correção da pontuação\./,
    "database should reject scoring saves without a reason",
  );
  assert.match(
    migrationSql,
    /prevent_scoring_audit_log_mutation/i,
    "audit table should block update/delete attempts",
  );
  assert.match(
    migrationSql,
    /REVOKE INSERT, UPDATE, DELETE ON public\.student_attendance_records FROM authenticated/i,
    "authenticated users should lose direct record writes",
  );
  assert.match(
    migrationSql,
    /REVOKE INSERT, UPDATE, DELETE ON public\.attendance_scores FROM authenticated/i,
    "authenticated users should lose direct score writes",
  );
  assert.match(
    migrationSql,
    /REVOKE INSERT, UPDATE, DELETE ON public\.attendance_discipline_events FROM authenticated/i,
    "authenticated users should lose direct discipline event writes",
  );
  assert.match(
    migrationSql,
    /GRANT EXECUTE ON FUNCTION public\.save_student_attendance_record\(UUID, DATE, UUID, UUID\[\], INTEGER, JSONB, TEXT\) TO authenticated/i,
    "authenticated teachers should write only via the reasoned secure RPC",
  );
});

test("attendance action prefers audited RPC and keeps fallback server-calculated", () => {
  const actionSource = readFileSync(join(repoRoot, "app", "actions", "attendance.ts"), "utf8");
  const saveActionBody = actionSource.slice(
    actionSource.indexOf("export async function saveStudentAttendanceRecord"),
    actionSource.indexOf("export async function updateOfferingAction"),
  );

  assert.match(
    saveActionBody,
    /\.rpc\(\s*["']save_student_attendance_record["']/,
    "save action should call the database RPC",
  );
  assert.match(
    saveActionBody,
    /p_change_reason:\s*normalizedChangeReason/,
    "save action should forward a normalized audit reason to the RPC",
  );
  assert.match(
    actionSource,
    /const DEFAULT_SCORING_CHANGE_REASON = "Pontuação salva sem motivo informado\."/,
    "save action should keep an automatic audit reason for blank user input",
  );
  assert.match(
    actionSource,
    /const DEFAULT_DISCIPLINE_EVENT_REASON = "Desconto registrado sem motivo informado\."/,
    "save action should keep an automatic discipline reason for blank user input",
  );
  assert.match(
    saveActionBody,
    /String\(changeReason \|\| ""\)\.trim\(\) \|\| DEFAULT_SCORING_CHANGE_REASON/,
    "save action should allow a blank user reason by falling back to the automatic audit reason",
  );
  assert.match(
    saveActionBody,
    /reason:\s*String\(event\.reason \|\| ""\)\.trim\(\) \|\| DEFAULT_DISCIPLINE_EVENT_REASON/,
    "save action should allow blank discipline reasons by falling back to the automatic discipline reason",
  );
  assert.doesNotMatch(
    saveActionBody,
    /if \(!normalizedChangeReason\)/,
    "save action should not force teachers to type a scoring change reason",
  );
  assert.doesNotMatch(
    saveActionBody,
    /Informe o motivo do (desconto por indisciplina|lançamento ou correção da pontuação)\./,
    "save action should not expose any teacher-facing reason requirement",
  );
  assert.match(
    actionSource,
    /saveStudentAttendanceRecordDirectly/,
    "save action should keep a temporary compatibility path while production is not migrated",
  );
  assert.match(
    actionSource,
    /\.from\(\s*["']class_scoring_rules["']\s*\)\s*[\s\S]*\.select\(\s*["']id, points["']\s*\)/,
    "compatibility fallback should recalculate selected rule points from the database",
  );
  assert.doesNotMatch(
    actionSource,
    /rulesMetadata/,
    "save action should not accept rule point metadata from the client",
  );
  assert.match(
    saveActionBody,
    /isScoringAuditContractMissing\(recordError\)[\s\S]*saveStudentAttendanceRecordDirectly/,
    "direct compatibility fallback should only run when the audited RPC contract is missing",
  );
});

test("attendance discipline modal does not require a typed reason", () => {
  const modalSource = readFileSync(join(repoRoot, "components", "ui", "AttendanceDisciplinePenaltyModal.tsx"), "utf8");

  assert.doesNotMatch(
    modalSource,
    /setErrorMsg\("Informe o motivo do desconto por indisciplina\."\)/,
    "discipline modal should not block saves without a typed reason",
  );
  assert.match(
    modalSource,
    /Motivo do desconto \(opcional\)/,
    "discipline modal should label the reason field as optional",
  );
  assert.match(
    modalSource,
    /onConfirm\(reason\.trim\(\)\)/,
    "discipline modal should submit the trimmed reason without requiring it",
  );
});

test("scoring actions degrade gracefully when audit database contract is missing", () => {
  const contractSource = readFileSync(join(repoRoot, "lib", "scoring", "audit-contract.ts"), "utf8");
  const attendanceSource = readFileSync(join(repoRoot, "app", "actions", "attendance.ts"), "utf8");
  const scoringSource = readFileSync(join(repoRoot, "app", "actions", "scoring.ts"), "utf8");

  assert.match(
    contractSource,
    /SCORING_AUDIT_NOT_APPLIED_MESSAGE/,
    "shared audit contract error should use a single safe user-facing message",
  );
  assert.match(
    contractSource,
    /pgrst202/i,
    "missing RPC signature should be treated as an audit contract failure",
  );
  assert.match(
    contractSource,
    /pgrst205/i,
    "missing audit table should be treated as an audit contract failure",
  );
  assert.match(
    attendanceSource,
    /isScoringAuditContractMissing\(recordError\)/,
    "saving should detect when the reasoned scoring RPC is not deployed",
  );
  assert.match(
    scoringSource,
    /auditLogs:\s*\(auditLogsResult\.error \? \[\] : auditLogsResult\.data \|\| \[\]\)/,
    "student scoring detail should continue without audit rows while the audit table is not deployed",
  );
});
