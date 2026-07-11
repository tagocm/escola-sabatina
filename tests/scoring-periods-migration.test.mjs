import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const migrationSource = readFileSync(
  join(repoRoot, "supabase", "migrations", "20260711003231_scoring_periods_lifecycle.sql"),
  "utf8",
);
const verificationSource = readFileSync(
  join(repoRoot, "scripts", "verify-scoring-periods.sql"),
  "utf8",
);
const hardeningSource = readFileSync(
  join(repoRoot, "supabase", "post_deploy", "20260711011516_enforce_scoring_period_app_contract.sql"),
  "utf8",
);
const backfillSource = migrationSource.split("-- Period-aware attendance scoring.")[0];

test("migration creates period calendar, snapshots and lifecycle", () => {
  for (const table of [
    "academic_terms",
    "academic_term_saturdays",
    "class_scoring_periods",
    "class_scoring_period_students",
    "class_scoring_period_rules",
    "class_scoring_period_lifecycle",
    "class_scoring_period_findings",
    "class_scoring_period_annotations",
  ]) {
    assert.match(migrationSource, new RegExp(`CREATE TABLE public\\.${table}\\b`, "i"));
  }

  assert.match(migrationSource, /2026, 2, '2º trimestre de 2026'.*2026-04-11.*2026-07-04.*13/s);
  assert.match(migrationSource, /2026, 3, '3º trimestre de 2026'.*2026-07-11.*2026-10-03.*13/s);
  assert.match(migrationSource, /2026, 4, '4º trimestre de 2026'.*2026-10-10.*2027-01-02.*13/s);
  assert.match(migrationSource, /WHEN terms\.term_number = 2 THEN 'closed_pending_audit'/);
  assert.match(migrationSource, /WHEN terms\.term_number = 3 THEN 'open'/);
});

test("backfill records findings without automatically changing historical points", () => {
  assert.match(backfillSource, /'record_total_mismatch'/);
  assert.match(backfillSource, /'rule_points_differ_from_catalog'/);
  assert.match(backfillSource, /'saturday_incomplete_records'/);
  assert.match(backfillSource, /'unattributed_scoring_audit_rows'/);
  const recordUpdates = backfillSource.match(/UPDATE public\.student_attendance_records[\s\S]*?;/gi) || [];
  const scoreUpdates = backfillSource.match(/UPDATE public\.attendance_scores[\s\S]*?;/gi) || [];
  const readSetClause = (statement) => statement
    .split(/\bSET\b/i)[1]
    ?.split(/\b(?:FROM|WHERE)\b/i)[0] || "";
  assert.ok(recordUpdates.every((statement) => !/total_points/i.test(readSetClause(statement))));
  assert.ok(scoreUpdates.every((statement) => !/points_earned/i.test(readSetClause(statement))));
});

test("period writes validate owner, participant snapshot, locks and explicit grants", () => {
  assert.match(migrationSource, /private\.is_scoring_period_owner\(p_period_id\)/);
  assert.match(migrationSource, /class_members\.role = 'owner'/);
  assert.match(migrationSource, /participants\.period_id = v_period_id[\s\S]*participants\.student_id = p_student_id/);
  assert.match(migrationSource, /v_period_status NOT IN \('open', 'closed_pending_audit', 'audit_in_progress'\)/);
  assert.match(migrationSource, /save_student_attendance_record_v2/);
  assert.match(migrationSource, /REVOKE ALL ON FUNCTION public\.save_student_attendance_record_v2/);
  assert.match(migrationSource, /GRANT EXECUTE ON FUNCTION public\.save_student_attendance_record_v2[\s\S]*TO authenticated/);
  assert.match(migrationSource, /REVOKE ALL ON FUNCTION private\.save_student_attendance_record_impl/);
  assert.match(migrationSource, /prevent_locked_scoring_fact_mutation/);
  assert.match(migrationSource, /ON DELETE RESTRICT/);
  assert.match(migrationSource, /sync_open_scoring_period_student/);
  assert.match(migrationSource, /move_active_students_to_class/);
  assert.match(migrationSource, /offering_goal_snapshot/);
  assert.match(migrationSource, /private\.current_sao_paulo_date\(\)/);
  assert.match(migrationSource, /participants\.joined_on[\s\S]*p_day_date/);
  assert.match(migrationSource, /participants\.left_on[\s\S]*p_day_date/);
  assert.match(hardeningSource, /REVOKE INSERT, UPDATE, DELETE[\s\S]*public\.attendance_days/);
});

test("audit evidence is refreshed and post-deploy hardening cannot run in stage one", () => {
  assert.match(migrationSource, /private\.refresh_scoring_period_findings/);
  assert.match(migrationSource, /is_current = TRUE/);
  assert.match(migrationSource, /PERFORM private\.refresh_scoring_period_findings\(p_period_id\)/);
  assert.match(migrationSource, /private\.bootstrap_class_scoring_periods/);
  assert.match(migrationSource, /REVOKE ALL ON FUNCTION private\.refresh_scoring_period_findings/);
  assert.equal(
    existsSync(join(
      repoRoot,
      "supabase",
      "migrations",
      "20260711011516_enforce_scoring_period_app_contract.sql",
    )),
    false,
  );
});

test("guardian summaries and production verification are period-aware and read-only", () => {
  assert.match(migrationSource, /get_guardian_student_progress_for_period/);
  assert.match(migrationSource, /get_guardian_class_offering_summary_for_period/);
  assert.match(migrationSource, /days\.period_id = v_period_id/);
  assert.match(verificationSource, /BEGIN;/);
  assert.match(verificationSource, /SET TRANSACTION READ ONLY;/);
  assert.match(verificationSource, /ROLLBACK;/);
  const executableVerificationSource = verificationSource
    .replace(/--.*$/gm, "")
    .replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(
    executableVerificationSource,
    /\b(INSERT|UPDATE|DELETE|UPSERT|TRUNCATE)\b/i,
  );
});
