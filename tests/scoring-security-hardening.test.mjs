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

test("attendance action does not trust client-supplied point values", () => {
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
    "save action should forward the human audit reason to the RPC",
  );
  assert.match(
    saveActionBody,
    /Informe o motivo do lançamento ou correção da pontuação\./,
    "save action should reject saves without an audit reason",
  );
  assert.doesNotMatch(
    saveActionBody,
    /\.from\(\s*["']attendance_scores["']\s*\)\s*\.\s*insert/s,
    "save action should not insert attendance scores directly",
  );
  assert.doesNotMatch(
    saveActionBody,
    /\.from\(\s*["']student_attendance_records["']\s*\)\s*\.\s*upsert/s,
    "save action should not upsert attendance records directly",
  );
  assert.doesNotMatch(
    saveActionBody,
    /rulesMetadata/,
    "save action should not accept rule point metadata from the client",
  );
});

test("scoring actions fail closed when audit database contract is missing", () => {
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
    "saving should fail closed if the reasoned scoring RPC is not deployed",
  );
  assert.match(
    scoringSource,
    /isScoringAuditContractMissing\(auditLogsResult\.error\)/,
    "student scoring detail should fail closed if the audit log is not deployed",
  );
});
