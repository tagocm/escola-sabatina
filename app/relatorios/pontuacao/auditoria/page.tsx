import { redirect } from "next/navigation";
import { getActiveClassContext } from "@/app/actions/classes";
import {
  getClassScoringPeriodContext,
  getScoringPeriodFindings,
  getScoringPeriodAuditHistory,
  getScoringPeriodOperationalMetrics,
} from "@/app/actions/scoring-periods";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import ScoringPeriodAuditWorkbench from "@/components/ui/ScoringPeriodAuditWorkbench";
import ScoringPeriodSelector from "@/components/ui/ScoringPeriodSelector";
import ScoringPeriodStatusPanel from "@/components/ui/ScoringPeriodStatusPanel";
import { pageMainClass, pageShellClass, surfaceClass } from "@/components/ui/design-system";
import { getTodayInSaoPaulo } from "@/lib/calendar/sabbath-period";
import { getScoringPeriodStatusLabel } from "@/lib/scoring/period-status";

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function ScoringPeriodAuditPage({ searchParams }: Props) {
  const classId = await getActiveClassContext();
  if (!classId) redirect("/classes");

  const query = await searchParams;
  const periodContext = await getClassScoringPeriodContext(classId, {
    periodId: query.period,
  });
  const selectedPeriod = periodContext.selectedPeriod;

  if (!selectedPeriod) {
    return (
      <div className={pageShellClass}>
        <Header />
        <main className={pageMainClass}>
          <PageHeader
            title="Auditoria da pontuação"
            subtitle="Fechamento, reconciliação e bloqueio por período"
            backHref="/relatorios/pontuacao"
            backLabel="Voltar ao Ranking"
          />
          <section className={`${surfaceClass} p-6`}>
            <p className="text-lg font-black uppercase">Nenhum período configurado para esta classe.</p>
          </section>
        </main>
      </div>
    );
  }

  if (query.period !== selectedPeriod.id) {
    redirect(`/relatorios/pontuacao/auditoria?period=${selectedPeriod.id}`);
  }

  const [findings, metrics, auditHistory] = await Promise.all([
    getScoringPeriodFindings(classId, selectedPeriod.id),
    getScoringPeriodOperationalMetrics(classId, selectedPeriod.id),
    getScoringPeriodAuditHistory(classId, selectedPeriod.id),
  ]);

  return (
    <div className={pageShellClass}>
      <Header />
      <main className={pageMainClass}>
        <PageHeader
          title="Auditoria da pontuação"
          subtitle="Reconcilie pendências sem apagar nem reinterpretar o histórico"
          backHref={`/relatorios/pontuacao?period=${selectedPeriod.id}`}
          backLabel="Voltar ao Ranking"
        />

        <ScoringPeriodSelector
          periods={periodContext.periods.map((period) => ({
            id: period.id,
            label: period.label,
            statusLabel: getScoringPeriodStatusLabel(period.status),
          }))}
          selectedPeriodId={selectedPeriod.id}
          pathname="/relatorios/pontuacao/auditoria"
        />

        <ScoringPeriodStatusPanel
          periodName={selectedPeriod.label}
          status={selectedPeriod.status}
          elapsed={metrics?.elapsed || 0}
          withRecords={metrics?.withRecords || 0}
          complete={metrics?.complete || 0}
          expected={selectedPeriod.expectedSaturdays}
        />

        <ScoringPeriodAuditWorkbench
          period={selectedPeriod}
          findings={findings}
          today={getTodayInSaoPaulo()}
        />

        <section className={`${surfaceClass} flex flex-col gap-4 p-5 md:p-6`}>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-50">Trilha de decisão</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tighter">Histórico do período</h2>
          </div>
          {auditHistory.length > 0 ? (
            <div className="flex flex-col gap-3">
              {auditHistory.map((entry) => (
                <article key={`${entry.kind}:${entry.id}`} className="border-4 border-foreground bg-background p-4 shadow-editorial-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]">{entry.label}</span>
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] opacity-50">
                      {new Intl.DateTimeFormat("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(entry.createdAt))}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-relaxed">{entry.reason}</p>
                  <p className="mt-3 text-[9px] font-black uppercase tracking-[0.14em] opacity-50">Por {entry.actorName}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="border-4 border-dashed border-foreground/30 bg-background p-5 text-sm font-black uppercase">
              Nenhuma decisão registrada ainda.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
