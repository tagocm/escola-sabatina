import {
  fieldLabelClass,
  sectionTitleClass,
  statusBadgeClass,
  surfaceSoftClass,
} from "@/components/ui/design-system";
import {
  SCORING_PERIOD_STATUS_LABELS,
  type ScoringPeriodStatus,
} from "@/lib/scoring/period-status";

const STATUS_PRESENTATION: Record<
  ScoringPeriodStatus,
  { badgeClassName: string; editingNotice: string }
> = {
  draft: {
    badgeClassName: "bg-surface-muted",
    editingNotice:
      "A contagem ainda não começou. Os lançamentos devem permanecer indisponíveis até a abertura deste período.",
  },
  open: {
    badgeClassName: "bg-es-green",
    editingNotice:
      "Período aberto. Lançamentos e correções seguem o fluxo normal e permanecem registrados no histórico.",
  },
  closed_pending_audit: {
    badgeClassName: "bg-es-orange",
    editingNotice:
      "O período terminou, mas ainda pode receber correções enquanto aguarda auditoria. Toda correção deve informar um motivo explícito.",
  },
  audit_in_progress: {
    badgeClassName: "bg-es-blue",
    editingNotice:
      "A auditoria está em andamento. Qualquer correção autorizada deve informar um motivo explícito e será considerada na revisão.",
  },
  audited_locked: {
    badgeClassName: "bg-es-lilac",
    editingNotice:
      "Período auditado e bloqueado. Os dados estão disponíveis somente para consulta; nenhuma alteração é permitida.",
  },
};

export interface ScoringPeriodStatusPanelProps {
  periodName: string;
  status: ScoringPeriodStatus;
  elapsed: number;
  withRecords: number;
  complete: number;
  expected?: number;
}

export default function ScoringPeriodStatusPanel({
  periodName,
  status,
  elapsed,
  withRecords,
  complete,
  expected,
}: ScoringPeriodStatusPanelProps) {
  const presentation = STATUS_PRESENTATION[status];
  const metrics = [
    { label: "Sábados decorridos", value: elapsed },
    { label: "Com lançamentos", value: withRecords },
    { label: "Completos", value: complete },
  ];

  return (
    <section className={`${surfaceSoftClass} flex flex-col gap-5 p-4 md:p-6`}>
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-col gap-2">
          <p className={fieldLabelClass}>Período selecionado</p>
          <h2 className={`${sectionTitleClass} break-words`}>{periodName}</h2>
        </div>
        <span
          className={`${statusBadgeClass} ${presentation.badgeClassName} max-w-full text-center`}
        >
          {SCORING_PERIOD_STATUS_LABELS[status]}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex min-h-24 flex-col justify-between gap-3 border-4 border-foreground bg-surface p-4"
          >
            <dt className={fieldLabelClass}>{metric.label}</dt>
            <dd className="font-mono text-3xl font-black leading-none">
              {metric.value}
              {expected !== undefined && (
                <span className="ml-1 text-sm opacity-40">/ {expected}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-4 border-foreground bg-background p-4">
        <p className={fieldLabelClass}>Regra de edição</p>
        <p className="mt-2 text-sm font-bold leading-relaxed">
          {presentation.editingNotice}
        </p>
      </div>
    </section>
  );
}
