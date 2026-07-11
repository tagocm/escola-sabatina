"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  addScoringPeriodAnnotationAction,
  approveScoringPeriodAuditAction,
  beginScoringPeriodAuditAction,
  closeScoringPeriodAction,
  openClassScoringPeriodAction,
  reopenScoringPeriodAction,
  resolveScoringPeriodFindingAction,
  type ClassScoringPeriod,
  type ScoringPeriodFinding,
} from "@/app/actions/scoring-periods";
import { ButtonLoader } from "@/components/ui/AppLoader";
import {
  alertClass,
  fieldLabelClass,
  primaryActionCenteredClass,
  secondaryActionClass,
  surfaceClass,
} from "@/components/ui/design-system";

interface ScoringPeriodAuditWorkbenchProps {
  period: ClassScoringPeriod;
  findings: ScoringPeriodFinding[];
  today: string;
}

const FINDING_LABELS: Record<string, string> = {
  record_total_mismatch: "Total salvo difere da composição",
  rule_points_differ_from_catalog: "Valor histórico difere da regra atual",
  saturday_incomplete_records: "Sábado com lançamentos incompletos",
  unattributed_scoring_audit_rows: "Alterações sem autoria identificada",
  legacy_unassigned_attendance_day: "Sábado legado fora do período",
};

function formatEvidence(value: Record<string, unknown>) {
  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${typeof entry === "object" ? JSON.stringify(entry) : String(entry)}`)
    .join(" / ") || "Sem valor registrado";
}

export default function ScoringPeriodAuditWorkbench({
  period,
  findings,
  today,
}: ScoringPeriodAuditWorkbenchProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const openFindings = findings.filter((finding) => finding.status === "open");
  const hasOpenBlockingFindings = openFindings.some((finding) => finding.isBlocking);
  const canResolveFindings = period.status === "closed_pending_audit"
    || period.status === "audit_in_progress";

  const runAction = (action: () => Promise<{ error?: string; success?: boolean }>) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setFeedback({ kind: "error", message: result.error });
        router.refresh();
        return;
      }
      setFeedback({ kind: "success", message: "Operação registrada com sucesso." });
      router.refresh();
    });
  };

  const handleLifecycle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (period.status === "draft") {
      runAction(() => openClassScoringPeriodAction(period.classId, period.termId, formData));
    } else if (period.status === "open") {
      runAction(() => closeScoringPeriodAction(period.id, formData));
    } else if (period.status === "closed_pending_audit") {
      runAction(() => beginScoringPeriodAuditAction(period.id, formData));
    } else if (period.status === "audit_in_progress") {
      runAction(() => approveScoringPeriodAuditAction(period.id, formData));
    } else if (period.status === "audited_locked") {
      runAction(() => reopenScoringPeriodAction(period.id, formData));
    }
  };

  const lifecycleLabel = {
    draft: "Abrir período",
    open: "Encerrar período",
    closed_pending_audit: "Iniciar auditoria",
    audit_in_progress: "Aprovar e bloquear",
    audited_locked: "Reabrir para correção",
  }[period.status];
  const canRunLifecycle = !(period.status === "draft" && today < period.startDate)
    && !(period.status === "open" && today < period.endDate)
    && !(period.status === "audit_in_progress" && hasOpenBlockingFindings);

  return (
    <div className="flex flex-col gap-6">
      {feedback ? (
        <div className={feedback.kind === "error" ? alertClass : "border-4 border-foreground bg-es-green px-4 py-3 shadow-editorial-sm"}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em]">{feedback.message}</p>
        </div>
      ) : null}

      <section className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6`}>
        <div>
          <p className={fieldLabelClass}>Ciclo de vida</p>
          <h2 className="mt-2 text-2xl font-black uppercase tracking-tighter">Controle da auditoria</h2>
        </div>

        {period.status === "open" && today < period.endDate ? (
          <p className="border-4 border-foreground bg-es-yellow p-4 text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
            Este período termina em {period.endDate}. O encerramento ficará disponível após o último sábado programado.
          </p>
        ) : null}

        {period.status === "draft" && today < period.startDate ? (
          <p className="border-4 border-foreground bg-es-yellow p-4 text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
            Este período começa em {period.startDate}. A abertura ficará disponível na data inicial programada.
          </p>
        ) : null}

        {period.status === "draft" ? (
          <p className="border-4 border-foreground bg-es-lilac p-4 text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
            Ao abrir, o sistema congela o roster, os critérios e a meta de ofertas deste trimestre.
            Confira alunos e regras da classe antes de confirmar.
          </p>
        ) : null}

        {period.status === "audit_in_progress" && hasOpenBlockingFindings ? (
          <p className="border-4 border-foreground bg-es-orange p-4 text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
            Resolva ou aceite todos os achados bloqueantes antes de aprovar e bloquear o período.
          </p>
        ) : null}

        <form onSubmit={handleLifecycle} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className={fieldLabelClass}>Motivo da transição</span>
            <textarea
              name="reason"
              required
              minLength={10}
              disabled={isPending || !canRunLifecycle}
              rows={3}
              className="min-h-24 resize-y border-4 border-foreground bg-background px-4 py-3 text-sm font-bold outline-none focus:bg-es-lilac/10 disabled:opacity-50"
              placeholder="Registre a decisão e a evidência usada"
            />
          </label>
          <button
            type="submit"
            disabled={isPending || !canRunLifecycle}
            className={primaryActionCenteredClass}
          >
            {isPending ? <ButtonLoader size="sm" label="Registrando transição" /> : null}
            {lifecycleLabel}
          </button>
        </form>
      </section>

      <section className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className={fieldLabelClass}>Pendências encontradas</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tighter">Reconciliação manual</h2>
          </div>
          <span className="border-4 border-foreground bg-es-orange px-3 py-2 text-xs font-black uppercase shadow-editorial-sm">
            {openFindings.length} em aberto
          </span>
        </div>

        <p className="text-[10px] font-bold uppercase leading-relaxed tracking-[0.14em] opacity-60">
          Resolver um achado não altera a pontuação automaticamente. Primeiro corrija o lançamento com evidência, ou aceite a divergência como exceção documentada.
        </p>

        {findings.length > 0 ? (
          <div className="flex flex-col gap-4">
            {findings.map((finding) => (
              <article key={finding.id} className="border-4 border-foreground bg-background p-4 shadow-editorial-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <span className={fieldLabelClass}>{finding.code}</span>
                    <h3 className="mt-2 text-lg font-black uppercase tracking-tight">
                      {FINDING_LABELS[finding.code] || "Achado de auditoria"}
                    </h3>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] opacity-60">
                      {finding.saturdayDate || "Sem sábado específico"} · {finding.tableName || "Visão do período"}
                    </p>
                  </div>
                  <span className={`border-2 border-foreground px-2 py-1 text-[9px] font-black uppercase ${finding.status === "open" ? "bg-es-orange" : "bg-es-green"}`}>
                    {finding.status === "open" ? (finding.isBlocking ? "Bloqueante" : "Aberto") : finding.status}
                  </span>
                </div>

                {finding.saturdayDate || finding.studentId ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {finding.saturdayDate ? (
                      <Link
                        href={`/relatorios/lancamento?period=${period.id}&d=${finding.saturdayDate}`}
                        className={secondaryActionClass}
                      >
                        Abrir sábado
                        <ArrowUpRight className="h-4 w-4 stroke-[3]" />
                      </Link>
                    ) : null}
                    {finding.studentId ? (
                      <Link
                        href={`/relatorios/pontuacao/${finding.studentId}?period=${period.id}`}
                        className={secondaryActionClass}
                      >
                        Ver aluno
                        <ArrowUpRight className="h-4 w-4 stroke-[3]" />
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                <details className="mt-4 border-2 border-foreground bg-surface p-3">
                  <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.14em]">
                    Ver evidência técnica
                  </summary>
                  <dl className="mt-3 grid grid-cols-1 gap-3 text-[10px] font-bold uppercase leading-relaxed md:grid-cols-2">
                    <div><dt className={fieldLabelClass}>Esperado</dt><dd className="mt-1">{formatEvidence(finding.expectedData)}</dd></div>
                    <div><dt className={fieldLabelClass}>Encontrado</dt><dd className="mt-1">{formatEvidence(finding.actualData)}</dd></div>
                  </dl>
                </details>

                {finding.status === "open" && canResolveFindings ? (
                  <form
                    className="mt-4 flex flex-col gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
                      const formData = new FormData(event.currentTarget);
                      if (submitter?.value) formData.set("resolution", submitter.value);
                      runAction(() => resolveScoringPeriodFindingAction(period.id, finding.id, formData));
                    }}
                  >
                    <label className="flex flex-col gap-2">
                      <span className={fieldLabelClass}>Justificativa e evidência</span>
                      <textarea
                        name="reason"
                        required
                        minLength={10}
                        disabled={isPending}
                        rows={3}
                        className="min-h-24 resize-y border-4 border-foreground bg-surface px-4 py-3 text-sm font-bold outline-none focus:bg-es-lilac/10"
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button type="submit" name="resolution" value="resolved" disabled={isPending} className={primaryActionCenteredClass}>
                        Resolver com evidência
                      </button>
                      <button type="submit" name="resolution" value="accepted" disabled={isPending} className={secondaryActionClass}>
                        Aceitar como exceção
                      </button>
                    </div>
                  </form>
                ) : finding.status === "open" ? (
                  <p className="mt-4 border-2 border-foreground bg-es-lilac p-3 text-[10px] font-bold uppercase leading-relaxed">
                    Reabra ou encerre o período no estado de auditoria antes de decidir este achado.
                  </p>
                ) : finding.resolutionReason ? (
                  <p className="mt-4 border-2 border-foreground bg-surface p-3 text-[10px] font-bold uppercase leading-relaxed">
                    Decisão: {finding.resolutionReason}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="border-4 border-dashed border-foreground/30 bg-background p-6 text-sm font-black uppercase">
            Nenhum achado registrado para este período.
          </p>
        )}
      </section>

      <section className={`${surfaceClass} flex flex-col gap-4 p-5 md:p-6`}>
        <div>
          <p className={fieldLabelClass}>Registro complementar</p>
          <h2 className="mt-2 text-xl font-black uppercase tracking-tighter">Adicionar anotação</h2>
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            runAction(() => addScoringPeriodAnnotationAction(period.id, null, formData));
          }}
        >
          <input type="hidden" name="annotationType" value="note" />
          <textarea
            name="body"
            required
            minLength={5}
            disabled={isPending}
            rows={3}
            className="min-h-24 resize-y border-4 border-foreground bg-background px-4 py-3 text-sm font-bold outline-none focus:bg-es-lilac/10"
            placeholder="Registre fonte externa, decisão ou contexto da auditoria"
          />
          <button type="submit" disabled={isPending} className={primaryActionCenteredClass}>
            Registrar anotação
          </button>
        </form>
      </section>
    </div>
  );
}
