export const SCORING_AUDIT_NOT_APPLIED_MESSAGE =
  "A auditoria de pontuação ainda não foi aplicada no banco. Aplique a migração de auditoria antes de lançar ou consultar pontuação.";

interface SupabaseContractError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export function isScoringAuditContractMissing(error: SupabaseContractError | null | undefined) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes("scoring_audit_log")
    || text.includes("p_change_reason")
    || text.includes("pgrst202")
    || text.includes("pgrst205")
    || (
      text.includes("save_student_attendance_record")
      && (text.includes("could not find") || text.includes("schema cache"))
    );
}
