import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const scriptPath = join(repoRoot, "scripts", "check-scoring-audit-deployment.mjs");

test("scoring audit deployment check is available before publishing", () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const scriptSource = readFileSync(scriptPath, "utf8");

  assert.equal(
    packageJson.scripts["check:scoring-audit"],
    "node scripts/check-scoring-audit-deployment.mjs",
  );
  assert.match(
    scriptSource,
    /SUPABASE_SERVICE_ROLE_KEY/,
    "remote deployment check should require a server-only Supabase key",
  );
  assert.match(
    scriptSource,
    /import WebSocket from "ws"/,
    "remote deployment check should work in Node.js 20 without native WebSocket",
  );
  assert.match(
    scriptSource,
    /transport:\s*WebSocket/,
    "remote deployment check should pass the ws transport to Supabase Realtime",
  );
  assert.match(
    scriptSource,
    /\.from\("scoring_audit_log"\)/,
    "remote deployment check should verify the audit table contract",
  );
  assert.match(
    scriptSource,
    /\.select\("id,updated_at"\)/,
    "remote deployment check should verify student attendance records updated_at",
  );
  assert.match(
    scriptSource,
    /\.rpc\("save_student_attendance_record"/,
    "remote deployment check should verify the reasoned scoring RPC contract",
  );
  assert.match(
    scriptSource,
    /p_change_reason/,
    "remote deployment check should call the new RPC signature",
  );
});

test(
  "remote scoring audit deployment is ready",
  {
    skip: process.env.RUN_REMOTE_SCORING_AUDIT_CHECK === "1"
      ? false
      : "Set RUN_REMOTE_SCORING_AUDIT_CHECK=1 to validate the configured Supabase project.",
  },
  () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  },
);
