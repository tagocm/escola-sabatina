import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveClassContext, getClassById } from "@/app/actions/classes";
import { getAttendanceContext } from "@/app/actions/attendance";
import OfferingInput from "@/components/ui/OfferingInput";
import Link from "next/link";
import { ArrowLeft, ArrowRight, HandCoins, Target, Thermometer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import { pageMainClass, pageShellClass } from "@/components/ui/design-system";

interface Params {
  searchParams: Promise<{ d?: string }>;
}

function computeSaturday(input?: string) {
  const baseDate = input ? new Date(`${input}T12:00:00`) : new Date();

  if (Number.isNaN(baseDate.getTime())) {
    return computeSaturday();
  }

  const saturday = new Date(baseDate);
  saturday.setHours(12, 0, 0, 0);
  saturday.setDate(saturday.getDate() + (6 - saturday.getDay()));

  return `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, "0")}-${String(saturday.getDate()).padStart(2, "0")}`;
}

export default async function LancamentoOfertasPage({ searchParams }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const classId = await getActiveClassContext();
  if (!classId) redirect("/classes");

  const d = (await searchParams).d;
  const saturdayStr = computeSaturday(d);

  if (d !== saturdayStr) {
    redirect(`/relatorios/ofertas?d=${saturdayStr}`);
  }

  const dateStr = saturdayStr;
  const [tY, tM, tD] = saturdayStr.split("-").map(Number);
  const targetDate = new Date(tY, tM - 1, tD, 12, 0, 0);

  const prevDate = new Date(tY, tM - 1, tD - 7, 12, 0, 0);
  const nextDate = new Date(tY, tM - 1, tD + 7, 12, 0, 0);
  const prevSat = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
  const nextSat = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;

  const [attendanceData, classData] = await Promise.all([
    getAttendanceContext(classId, dateStr),
    getClassById(classId),
  ]);

  const { data: offeringDays } = await supabase
    .from("attendance_days")
    .select("day_date, total_offering")
    .eq("class_id", classId);

  if ("error" in attendanceData) {
    return <div className="p-8 font-black uppercase">Erro ao carregar dados de oferta: {attendanceData.error}</div>;
  }

  const displayDate = format(targetDate, "dd 'de' MMMM", { locale: ptBR });
  const offeringGoal = Number(classData?.offering_goal || 0);
  const totalOffering = Number(attendanceData.day?.total_offering || 0);
  const accumulatedOffering = (offeringDays || []).reduce(
    (sum, day) => sum + Number(day.total_offering || 0),
    0,
  );
  const offeringHistory = (offeringDays || [])
    .filter((day) => Number(day.total_offering || 0) > 0)
    .sort((a, b) => new Date(b.day_date).getTime() - new Date(a.day_date).getTime());
  const trimesterGoal = offeringGoal * 13;
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

          <div className="flex h-12 w-full shrink-0 overflow-hidden border-4 border-foreground bg-white shadow-editorial-sm sm:w-auto">
            <Link href={`?d=${prevSat}`} className="w-12 flex items-center justify-center border-r-4 border-foreground hover:bg-background transition-colors" title="Sábado Anterior">
              <ArrowLeft className="w-4 h-4 stroke-[3]" />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-white px-4 sm:min-w-[140px] sm:px-6">
              <span className="text-[7px] font-black uppercase tracking-widest opacity-30 leading-none mb-1">Data Escolar</span>
              <span className="text-[11px] font-black uppercase tracking-tighter">{displayDate}</span>
            </div>

            <Link href={`?d=${nextSat}`} className="w-12 flex items-center justify-center border-l-4 border-foreground hover:bg-background transition-colors" title="Próximo Sábado">
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </Link>
          </div>
        </div>

        <section id="oferta-section" className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr_1.15fr] md:gap-6">
          <div className="bg-white border-4 border-foreground p-6 md:p-8 shadow-editorial flex flex-col gap-5 scroll-mt-24">
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

            <OfferingInput classId={classId} date={dateStr} initialAmount={totalOffering} />
          </div>

          <div className="bg-white border-4 border-foreground p-6 md:p-8 shadow-editorial flex flex-col gap-5">
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

          <div className="bg-white border-4 border-foreground p-6 md:p-8 shadow-editorial flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-es-orange border-4 border-foreground shadow-editorial-sm">
                <Thermometer className="w-5 h-5 stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-black uppercase tracking-tighter">Acumulado do Trimestre</h2>
                <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest">
                  Meta do trimestre: meta por sábado x 13
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
                <div className="relative h-8 border-4 border-foreground bg-white shadow-editorial-sm overflow-hidden">
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
              O termômetro mostra o avanço acumulado da arrecadação da classe em relação à meta projetada para os 13 sábados do trimestre.
            </p>
          </div>
        </section>

        <section id="offering-history" className="bg-white border-4 border-foreground p-6 md:p-8 shadow-editorial flex flex-col gap-6 scroll-mt-24">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black uppercase tracking-tighter">Histórico das Ofertas</h2>
            <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.22em]">
              Cada salvamento cria ou atualiza o lançamento do sábado selecionado
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
