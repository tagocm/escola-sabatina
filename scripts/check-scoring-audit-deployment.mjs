import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const EXPECTED_RPC_ERROR = "Não autenticado.";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const contents = readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");
  }
}

function loadLocalEnv() {
  const cwd = process.cwd();
  for (const filename of [".env", ".env.local"]) {
    loadEnvFile(resolve(cwd, filename));
  }
}

function fail(message, details) {
  console.error(`FAIL: ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  fail("NEXT_PUBLIC_SUPABASE_URL não está configurada.");
}

if (!serviceRoleKey) {
  fail("SUPABASE_SERVICE_ROLE_KEY não está configurada.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocket,
  },
});

const auditLogColumns = [
  "id",
  "request_id",
  "table_name",
  "operation",
  "row_id",
  "class_id",
  "day_id",
  "student_id",
  "actor_user_id",
  "actor_name",
  "changed_at",
  "transaction_id",
  "reason",
  "source",
  "metadata",
  "old_data",
  "new_data",
].join(",");

const auditLogResult = await supabase
  .from("scoring_audit_log")
  .select(auditLogColumns)
  .limit(1);

if (auditLogResult.error) {
  fail(
    "A tabela public.scoring_audit_log ainda não está disponível com o contrato esperado.",
    auditLogResult.error.message,
  );
}

const recordsResult = await supabase
  .from("student_attendance_records")
  .select("id,updated_at")
  .limit(1);

if (recordsResult.error) {
  fail(
    "A tabela public.student_attendance_records ainda não expõe updated_at.",
    recordsResult.error.message,
  );
}

const rpcResult = await supabase.rpc("save_student_attendance_record", {
  p_class_id: ZERO_UUID,
  p_day_date: "2099-01-01",
  p_student_id: ZERO_UUID,
  p_rule_ids: [],
  p_extra_activity_points: 0,
  p_discipline_events: [],
  p_change_reason: "Verificação pré-deploy da auditoria de pontuação.",
});

if (!rpcResult.error) {
  fail("A RPC respondeu sem o bloqueio de autenticação esperado.");
}

if (!rpcResult.error.message.includes(EXPECTED_RPC_ERROR)) {
  fail(
    "A RPC public.save_student_attendance_record não está com a assinatura/contrato esperado.",
    rpcResult.error.message,
  );
}

console.log("OK: auditoria de pontuação aplicada no Supabase configurado.");
