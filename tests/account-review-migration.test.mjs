import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(
  here,
  "..",
  "supabase",
  "migrations",
  "20260817004938_suspend_teacher_account_data_access.sql",
);

test("the database hold targets only the teacher account", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /51cc1e11-a35d-4bf3-aa62-78974accb2cb/);
  assert.match(sql, /private\.is_teacher_account_access_suspended/);
  assert.match(sql, /AS RESTRICTIVE FOR ALL TO authenticated/);
  assert.match(sql, /teacher_account_access_hold_trigger/);

  // The mother's separate guardian account must never be hard-coded into the hold.
  assert.doesNotMatch(sql, /f1f63799-04ed-475a-8038-b9bfb79b60eb/);
});
