export type ScoringPeriodStatus =
  | "draft"
  | "open"
  | "closed_pending_audit"
  | "audit_in_progress"
  | "audited_locked";

export const SCORING_PERIOD_STATUS_LABELS: Record<ScoringPeriodStatus, string> = {
  draft: "Programado",
  open: "Em andamento",
  closed_pending_audit: "Encerrado - aguardando auditoria",
  audit_in_progress: "Auditoria em andamento",
  audited_locked: "Auditado - somente leitura",
};

const WRITABLE_SCORING_PERIOD_STATUSES = new Set<ScoringPeriodStatus>([
  "open",
  "closed_pending_audit",
  "audit_in_progress",
]);

export function getScoringPeriodStatusLabel(status: ScoringPeriodStatus) {
  return SCORING_PERIOD_STATUS_LABELS[status];
}

export function isWritableScoringPeriodStatus(status: ScoringPeriodStatus) {
  return WRITABLE_SCORING_PERIOD_STATUSES.has(status);
}
