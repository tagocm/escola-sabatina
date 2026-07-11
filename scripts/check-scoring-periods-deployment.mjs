import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const contents = readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match || line.trim().startsWith("#")) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");
  }
}

for (const filename of [".env", ".env.local"]) {
  loadEnvFile(resolve(process.cwd(), filename));
}

function fail(message, details) {
  console.error(`FAIL: ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl) fail("NEXT_PUBLIC_SUPABASE_URL não está configurada.");
if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY não está configurada.");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
});

const { data: terms, error: termsError } = await supabase
  .from("academic_terms")
  .select("id,year,term_number,name,start_date,end_date,expected_saturdays,status")
  .eq("year", 2026)
  .in("term_number", [2, 3])
  .order("term_number");

if (termsError) fail("O calendário trimestral ainda não está disponível.", termsError.message);
if ((terms || []).length !== 2) fail("Q2 e Q3 de 2026 não foram encontrados de forma única.");

const q2 = terms.find((term) => term.term_number === 2);
const q3 = terms.find((term) => term.term_number === 3);
if (q2?.start_date !== "2026-04-11" || q2?.end_date !== "2026-07-04") {
  fail("O calendário do Q2 não corresponde a 11/04..04/07.");
}
if (q3?.start_date !== "2026-07-11" || q3?.end_date !== "2026-10-03") {
  fail("O calendário do Q3 não corresponde a 11/07..03/10.");
}

const termIds = terms.map((term) => term.id);
const { data: saturdays, error: saturdaysError } = await supabase
  .from("academic_term_saturdays")
  .select("term_id,week_number,saturday_date")
  .in("term_id", termIds);
if (saturdaysError) fail("Não foi possível validar os sábados dos períodos.", saturdaysError.message);

for (const term of terms) {
  const schedule = (saturdays || []).filter((entry) => entry.term_id === term.id);
  if (schedule.length !== term.expected_saturdays || schedule.length !== 13) {
    fail(`${term.name} não possui exatamente 13 sábados.`);
  }
}

const { data: periods, error: periodsError } = await supabase
  .from("class_scoring_periods")
  .select("id,class_id,term_id,status")
  .in("term_id", termIds);
if (periodsError) fail("Não foi possível validar os períodos das classes.", periodsError.message);
if (!(periods || []).some((period) => period.term_id === q3.id && period.status === "open")) {
  fail("Nenhum período Q3 está aberto para iniciar a nova contagem.");
}
if ((periods || []).some((period) => period.term_id === q2.id && period.status === "open")) {
  fail("O Q2 não pode permanecer aberto como contagem corrente.");
}

const { data: july11Days, error: july11Error } = await supabase
  .from("attendance_days")
  .select("id,period_id,class_scoring_periods!attendance_days_period_fkey!inner(term_id)")
  .eq("day_date", "2026-07-11");
if (july11Error) fail("Não foi possível validar a fronteira de 11/07.", july11Error.message);
if ((july11Days || []).some((day) => {
  const period = Array.isArray(day.class_scoring_periods)
    ? day.class_scoring_periods[0]
    : day.class_scoring_periods;
  return period?.term_id !== q3.id;
})) {
  fail("Existe sábado 11/07 associado fora do Q3.");
}

const { data: periodDays, error: periodDaysError } = await supabase
  .from("attendance_days")
  .select("id,period_id,day_date")
  .gte("day_date", "2026-04-11")
  .lte("day_date", "2026-10-03");
if (periodDaysError) fail("Não foi possível validar os sábados já persistidos.", periodDaysError.message);
if ((periodDays || []).some((day) => !day.period_id)) {
  fail("Há attendance_days dentro de Q2/Q3 sem period_id.");
}

const dayIds = (periodDays || []).map((day) => day.id);
if (dayIds.length > 0) {
  const { data: scores, error: scoresError } = await supabase
    .from("attendance_scores")
    .select("id,period_rule_id")
    .in("day_id", dayIds);
  if (scoresError) fail("Não foi possível validar as regras snapshot.", scoresError.message);
  if ((scores || []).some((score) => !score.period_rule_id)) {
    fail("Há attendance_scores do período sem period_rule_id.");
  }
}

const rpcResult = await supabase.rpc("save_student_attendance_record_v2", {
  p_class_id: ZERO_UUID,
  p_day_date: "2099-01-03",
  p_student_id: ZERO_UUID,
  p_rule_ids: [],
  p_extra_activity_points: 0,
  p_discipline_events: [],
  p_change_reason: "Verificação somente leitura do contrato por período.",
});
if (
  !rpcResult.error?.message.includes("Não autenticado")
  && !rpcResult.error?.message.includes("permission denied")
) {
  fail("A RPC v2 não respondeu com o bloqueio de acesso esperado.", rpcResult.error?.message);
}

console.log("OK: períodos Q2/Q3, fronteira 11/07, snapshots e RPC v2 validados.");
