import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function readLatestSecureScoringMigration() {
  const migrationsDir = join(repoRoot, "supabase", "migrations");
  const migrationName = readdirSync(migrationsDir)
    .filter((name) => name.endsWith("_secure_scoring_audit_rpc.sql"))
    .sort()
    .at(-1);

  assert.ok(migrationName, "secure scoring migration should exist");
  return readFileSync(join(migrationsDir, migrationName), "utf8");
}

test("secure scoring migration gates writes through audited RPC", () => {
  const migrationSql = readLatestSecureScoringMigration();

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
    /CREATE OR REPLACE FUNCTION public\.save_student_attendance_record/i,
    "migration should create secure scoring RPC",
  );
  assert.match(
    migrationSql,
    /SECURITY DEFINER\s+SET search_path = public/i,
    "secure scoring RPC should run as a database-owned function with a fixed search path",
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
    /GRANT EXECUTE ON FUNCTION public\.save_student_attendance_record\(UUID, DATE, UUID, UUID\[\], INTEGER, JSONB\) TO authenticated/i,
    "authenticated teachers should write only via the secure RPC",
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
