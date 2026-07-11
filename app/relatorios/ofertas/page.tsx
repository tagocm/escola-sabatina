import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClassContext } from "@/app/actions/classes";
import { getAttendanceContext } from "@/app/actions/attendance";
import {
  getClassScoringPeriodContext,
  getScoringPeriodOperationalMetrics,
} from "@/app/actions/scoring-periods";
import OfferingInput from "@/components/ui/OfferingInput";
import ScoringPeriodSelector from "@/components/ui/ScoringPeriodSelector";
import ScoringPeriodStatusPanel from "@/components/ui/ScoringPeriodStatusPanel";
import Link from "next/link";
import { ArrowLeft, ArrowRight, HandCoins, Target, Thermometer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import { pageMainClass, pageShellClass } from "@/components/ui/design-system";
import { getTodayInSaoPaulo } from "@/lib/calendar/sabbath-period";
import { getScoringPeriodStatusLabel } from "@/lib/scoring/period-status";

interface Params {
  searchParams: Promise<{ d?: string; period?: string }>;
}

function resolveScheduledSaturday(
  requestedDate: string | undefined,
  schedule: string[],
  today: string,
) {
  if (requestedDate && schedule.includes(requestedDate)) return requestedDate;
  return schedule.find((date) => date >= today) || schedule.at(-1) || null;
}

export default async function LancamentoOfertasPage({ searchParams }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const classId = await getActiveClassContext();
  if (!classId) redirect("/classes");

  const query = await searchParams;
  const periodContext = await getClassScoringPeriodContext(classId, {
    periodId: query.period,
    date: query.period ? null : query.d,
  });
  const selectedPeriod = periodContext.selectedPeriod;

  if (!selectedPeriod) {
    return <div className="p-8 font-black uppercase">Nenhum período de pontuação foi configurado para esta classe.</div>;
  }

  const saturdayStr = resolveScheduledSaturday(
    query.d,
    selectedPeriod.schedule,
    getTodayInSaoPaulo(),
  );

  if (!saturdayStr) {
    return <div className="p-8 font-black uppercase">O calendário deste período não possui sábados configurados.</div>;
  }

  if (query.d !== saturdayStr || query.period !== selectedPeriod.id) {
    redirect(`/relatorios/ofertas?period=${selectedPeriod.id}&d=${saturdayStr}`);
  }

  const dateStr = saturdayStr;
  const [tY, tM, tD] = saturdayStr.split("-").map(Number);
  const targetDate = new Date(tY, tM - 1, tD, 12, 0, 0);
  const saturdayIndex = selectedPeriod.schedule.indexOf(saturdayStr);
  const prevSat = selectedPeriod.schedule[Math.max(0, saturdayIndex - 1)] || saturdayStr;
  const nextSat = selectedPeriod.schedule[
    Math.min(selectedPeriod.schedule.length - 1, saturdayIndex + 1)
  ] || saturdayStr;

  const [attendanceData, periodMetrics, offeringDaysResult] = await Promise.all([
    getAttendanceContext(classId, dateStr, selectedPeriod.id),
    getScoringPeriodOperationalMetrics(classId, selectedPeriod.id),
    supabase
      .from("attendance_days")
      .select("day_date, total_offering")
      .eq("class_id", classId)
      .eq("period_id", selectedPeriod.id),
  ]);

  if ("error" in attendanceData) {
    return <div className="p-8 font-black uppercase">Erro ao carregar dados de oferta: {attendanceData.error}</div>;
  }

  if (offeringDaysResult.error) {
    return <div className="p-8 font-black uppercase">Erro ao carregar o histórico de ofertas deste período.</div>;
  }

  const displayDate = format(targetDate, "dd 'de' MMMM", { locale: ptBR });
  const offeringGoal = selectedPeriod.offeringGoalSnapshot;
  const totalOffering = Number(attendanceData.day?.total_offering || 0);
  const accumulatedOffering = (offeringDaysResult.data || []).reduce(
    (sum, day) => sum + Number(day.total_offering || 0),
    0,
  );
  const offeringHistory = (offeringDaysResult.data || [])
    .filter((day) => Number(day.total_offering || 0) > 0)
    .sort((a, b) => new Date(b.day_date).getTime() - new Date(a.day_date).getTime());
  const expectedSaturdays = periodMetrics?.expected ?? selectedPeriod.expectedSaturdays;
  const trimesterGoal = offeringGoal * expectedSaturdays;
  const thermometerProgress = trimesterGoal > 0 ? Math.min((accumulatedOffering / trimesterGoal) * 100, 100) : 0;
  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  return (
    <div className={pageShellClass}>
      <Header />

      <main className={pageMainClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
          <PageHeader
            title="Oferta do Sábado"
            subtitle="Registro financeiro e histórico de arrecadação da classe"
            backHref="/"
            backLabel="Voltar ao Painel"
          />

          <div className="flex h-12 w-full shrink-0 overflow-hidden border-4 border-foreground bg-surface shadow-editorial-sm sm:w-auto">
            <Link href={`?period=${selectedPeriod.id}&d=${prevSat}`} className="w-12 flex items-center justify-center border-r-4 border-foreground hover:bg-background transition-colors" title="Sábado Anterior">
              <ArrowLeft className="w-4 h-4 stroke-[3]" />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-surface px-4 sm:min-w-[140px] sm:px-6">
              <span className="text-[7px] font-black uppercase tracking-widest opacity-30 leading-none mb-1">Data Escolar</span>
              <span className="text-[11px] font-black uppercase tracking-tighter">{displayDate}</span>
            </div>

            <Link href={`?period=${selectedPeriod.id}&d=${nextSat}`} className="w-12 flex items-center justify-center border-l-4 border-foreground hover:bg-background transition-colors" title="Próximo Sábado">
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </Link>
          </div>
        </div>

        <ScoringPeriodSelector
          periods={periodContext.periods.map((period) => ({
            id: period.id,
            label: period.label,
            statusLabel: getScoringPeriodStatusLabel(period.status),
          }))}
          selectedPeriodId={selectedPeriod.id}
          pathname="/relatorios/ofertas"
          query={{ d: saturdayStr }}
        />

        <ScoringPeriodStatusPanel
          periodName={selectedPeriod.label}
          status={selectedPeriod.status}
          elapsed={periodMetrics?.elapsed || 0}
          withRecords={periodMetrics?.withRecords || 0}
          complete={periodMetrics?.complete || 0}
          expected={expectedSaturdays}
        />

        <section id="oferta-section" className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr_1.15fr] md:gap-6">
          <div className="bg-surface border-4 border-foreground p-6 md:p-8 shadow-editorial flex flex-col gap-5 scroll-mt-24">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-es-yellow border-4 border-foreground shadow-editorial-sm">
                <HandCoins className="w-5 h-5 stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-black uppercase tracking-tighter">Oferta do Sábado</h2>
                <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest">
                  Lançamento financeiro da unidade na data selecionada
                </span>
              </div>
            </div>

            <OfferingInput
              key={`${selectedPeriod.id}:${dateStr}:${totalOffering}`}
              classId={classId}
              periodId={selectedPeriod.id}
              date={dateStr}
              initialAmount={totalOffering}
              readOnly={!selectedPeriod.canWrite}
              requiresChangeReason={selectedPeriod.requiresChangeReason}
            />
          </div>

          <div className="bg-surface border-4 border-foreground p-6 md:p-8 shadow-editorial flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-es-lilac border-4 border-foreground shadow-editorial-sm">
                <Target className="w-5 h-5 stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-black uppercase tracking-tighter">Meta da Classe</h2>
                <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest">
                  Referência cadastrada para cada sábado
                </span>
              </div>
            </div>

            <div className="border-4 border-foreground bg-background px-5 py-4 shadow-editorial-sm">
              <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Meta atual</span>
              <p className="mt-2 text-3xl font-black tracking-tight">{currencyFormatter.format(offeringGoal)}</p>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-50">
              Use esta comparação para acompanhar rapidamente se a arrecadação do sábado ficou acima ou abaixo do esperado.
            </p>
          </div>

          <div className="bg-surface border-4 border-foreground p-6 md:p-8 shadow-editorial flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-es-orange border-4 border-foreground shadow-editorial-sm">
                <Thermometer className="w-5 h-5 stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-black uppercase tracking-tighter">Acumulado do Trimestre</h2>
                <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest">
                  Meta do trimestre: meta por sábado x {expectedSaturdays}
                </span>
              </div>
            </div>

            <div className="border-4 border-foreground bg-background px-4 py-4 shadow-editorial-sm flex flex-col gap-4 md:px-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-4">
                <div className="min-w-0 flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Arrecadado</span>
                  <p className="mt-2 text-lg font-black tracking-tight leading-none whitespace-nowrap">
                    {currencyFormatter.format(accumulatedOffering)}
                  </p>
                </div>
                <div className="shrink-0 sm:text-right">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Meta</span>
                  <p className="mt-2 text-lg font-black tracking-tight leading-none whitespace-nowrap">
                    {currencyFormatter.format(trimesterGoal)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="relative h-8 border-4 border-foreground bg-surface shadow-editorial-sm overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-es-orange" style={{ width: `${thermometerProgress}%` }} />
                </div>
                <div className="grid grid-cols-3 items-center text-[9px] font-black uppercase tracking-widest opacity-50">
                  <span className="justify-self-start">0%</span>
                  <span className="justify-self-center">{thermometerProgress.toFixed(0)}%</span>
                  <span className="justify-self-end">100%</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-50">
              O termômetro mostra o avanço acumulado da arrecadação da classe em relação à meta projetada para os {expectedSaturdays} sábados deste período.
            </p>
          </div>
        </section>

        <section id="offering-history" className="bg-surface border-4 border-foreground p-6 md:p-8 shadow-editorial flex flex-col gap-6 scroll-mt-24">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black uppercase tracking-tighter">Histórico das Ofertas</h2>
            <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.22em]">
              Lançamentos do período selecionado, separados dos demais trimestres
            </span>
          </div>

          {offeringHistory.length > 0 ? (
            <div className="flex flex-col gap-4">
              {offeringHistory.map((day) => {
                const [year, month, date] = day.day_date.split("-").map(Number);
                const dayDate = new Date(year, month - 1, date, 12, 0, 0);

                return (
                  <div
                    key={day.day_date}
                    className="grid grid-cols-1 gap-3 border-4 border-foreground bg-background px-4 py-4 shadow-editorial-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Sábado registrado</span>
                      <p className="text-lg font-black uppercase tracking-tight">
                        {format(dayDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Arrecadado</span>
                      <p className="mt-1 text-2xl font-black tracking-tight">
                        {currencyFormatter.format(Number(day.total_offering || 0))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border-4 border-dashed border-foreground/30 bg-background px-6 py-10 text-center">
              <p className="text-lg font-black uppercase tracking-tight opacity-40">Nenhuma oferta salva ainda</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
