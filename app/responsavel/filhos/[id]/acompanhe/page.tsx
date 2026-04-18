import { Activity, AlertTriangle, BarChart3, CalendarClock, Inbox, Thermometer, TrendingUp, Trophy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import PerformanceChartDrilldown from "@/components/ui/PerformanceChartDrilldown";
import {
  getGuardianClassOfferingSummary,
  getGuardianStudentMailbox,
  getGuardianStudentProgress,
  getGuardianStudents,
  getMyEnrollmentRequests,
  type GuardianMailboxMessage,
  type GuardianStudentProgressPoint,
} from "@/app/actions/guardians";
import {
  stackedPageClass,
  surfaceClass,
  surfaceSoftClass,
} from "@/components/ui/design-system";

interface Props {
  params: Promise<{ id: string }>;
}

interface GuardianStudent {
  id: string;
  full_name: string;
  class_id: string | null;
  photo_url: string | null;
  classes?: {
    id?: string | null;
    name?: string | null;
  } | null;
}

interface EnrollmentRequest {
  status: string;
  students?: {
    id?: string | null;
  } | {
    id?: string | null;
  }[] | null;
  classes?: {
    name?: string | null;
  } | {
    name?: string | null;
  }[] | null;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMailboxTypeMeta(type: GuardianMailboxMessage["message_type"]) {
  if (type === "indisciplina") {
    return {
      icon: AlertTriangle,
      label: "Indisciplina",
      badgeClass: "bg-es-orange",
    };
  }

  if (type === "calendario") {
    return {
      icon: CalendarClock,
      label: "Calendário",
      badgeClass: "bg-es-blue",
    };
  }

  return {
    icon: Inbox,
    label: "Aviso",
    badgeClass: "bg-es-yellow",
  };
}

export default async function GuardianStudentProgressPage({ params }: Props) {
  const { id } = await params;
  const [students, requests] = await Promise.all([
    getGuardianStudents(),
    getMyEnrollmentRequests(),
  ]);
  const guardianStudents = students as unknown as GuardianStudent[];
  const enrollmentRequests = requests as unknown as EnrollmentRequest[];
  const student = guardianStudents.find((entry) => entry.id === id);

  if (!student) {
    notFound();
  }

  const progress = await getGuardianStudentProgress(id);
  const timeline = progress.map((point: GuardianStudentProgressPoint) => ({
    label: format(new Date(`${point.day_date}T12:00:00`), "dd/MM"),
    fullLabel: format(new Date(`${point.day_date}T12:00:00`), "dd 'de' MMMM", { locale: ptBR }),
    className: point.class_name || "Turma em definição",
    studentScore: point.student_points,
    classAverage: Number(point.class_average),
  }));
  const cumulativeTimeline = timeline.reduce<Array<{
    label: string;
    fullLabel: string;
    className: string;
    studentScore: number;
    classAverage: number;
  }>>((acc, point) => {
    const previous = acc.at(-1);

    acc.push({
      ...point,
      studentScore: point.studentScore + (previous?.studentScore ?? 0),
      classAverage: point.classAverage + (previous?.classAverage ?? 0),
    });

    return acc;
  }, []);

  const latestEntry = progress.at(-1);
  const latestScore = latestEntry?.student_points ?? 0;
  const latestAverage = latestEntry ? Number(latestEntry.class_average) : 0;
  const averageScore = average(progress.map((point) => point.student_points));
  const totalScore = cumulativeTimeline.at(-1)?.studentScore ?? 0;
  const totalAverage = cumulativeTimeline.at(-1)?.classAverage ?? 0;
  const delta = totalScore - totalAverage;
  const pendingRequest = enrollmentRequests.find((request) => {
    const requestStudent = Array.isArray(request.students) ? request.students[0] : request.students;
    return requestStudent?.id === id && request.status === "pending";
  });
  const requestedClassName = Array.isArray(pendingRequest?.classes)
    ? pendingRequest?.classes[0]?.name
    : pendingRequest?.classes?.name;
  const className = student.classes?.name || requestedClassName || latestEntry?.class_name || "Turma em definição";
  const studentFirstName = student.full_name.split(" ")[0] || "Aluno";
  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
  const offeringSummary = await getGuardianClassOfferingSummary(id);
  const mailboxMessages = await getGuardianStudentMailbox(id);
  const offeringGoal = Number(offeringSummary?.offering_goal || 0);
  const accumulatedOffering = Number(offeringSummary?.accumulated_offering || 0);
  const trimesterGoal = Number(offeringSummary?.trimester_goal || offeringGoal * 13);
  const thermometerProgress = trimesterGoal > 0
    ? Math.min((accumulatedOffering / trimesterGoal) * 100, 100)
    : 0;

  return (
    <div className={stackedPageClass}>
      <PageHeader
        title={student.full_name}
        subtitle="Acompanhe o desempenho"
        backHref="/responsavel"
        backLabel="Voltar aos Dependentes"
      />

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr] md:gap-6">
        <div className={`${surfaceSoftClass} p-4 md:p-6 flex flex-col gap-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-4 border-foreground bg-es-blue flex items-center justify-center shadow-editorial-sm">
              <Thermometer className="w-4 h-4 stroke-[3]" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-black uppercase tracking-tight">Ofertas da classe</h3>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-40">
                Meta e valor acumulado do trimestre
              </span>
            </div>
          </div>

          <div className="border-2 border-foreground bg-background px-4 py-4 flex flex-col gap-4 shadow-editorial-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="border-2 border-foreground bg-white px-4 py-3 flex flex-col gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Alcançado</span>
                <strong className="text-2xl font-black tracking-tight">
                  {currencyFormatter.format(accumulatedOffering)}
                </strong>
              </div>
              <div className="border-2 border-foreground bg-white px-4 py-3 flex flex-col gap-2 sm:text-right">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Meta</span>
                <strong className="text-2xl font-black tracking-tight">
                  {currencyFormatter.format(trimesterGoal)}
                </strong>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="relative h-8 border-4 border-foreground bg-white shadow-editorial-sm overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-es-orange"
                  style={{ width: `${thermometerProgress}%` }}
                />
              </div>
              <div className="grid grid-cols-3 items-center text-[9px] font-black uppercase tracking-widest opacity-50">
                <span className="justify-self-start">0%</span>
                <span className="justify-self-center">{thermometerProgress.toFixed(0)}%</span>
                <span className="justify-self-end">100%</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-50">
            O termômetro mostra quanto a turma já arrecadou em relação à meta projetada para os 13 sábados do trimestre.
          </p>
        </div>

        <div className={`${surfaceSoftClass} p-4 md:p-6 flex flex-col gap-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-4 border-foreground bg-es-yellow flex items-center justify-center shadow-editorial-sm">
              <Inbox className="w-4 h-4 stroke-[3]" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-black uppercase tracking-tight">Caixa postal</h3>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-40">
                Recados da coordenação e da classe
              </span>
            </div>
          </div>

          {mailboxMessages.length > 0 ? (
            <div className="flex max-h-[22rem] flex-col gap-3 overflow-y-auto pr-1">
              {mailboxMessages.map((message) => {
                const meta = getMailboxTypeMeta(message.message_type);
                const Icon = meta.icon;

                return (
                  <article
                    key={message.message_id}
                    className="border-2 border-foreground bg-white px-4 py-3 shadow-editorial-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center border-2 border-foreground ${meta.badgeClass}`}>
                          <Icon className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                            {meta.label}
                          </span>
                          <h4 className="text-sm font-black uppercase tracking-tight">
                            {message.title}
                          </h4>
                        </div>
                      </div>
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                        {format(new Date(message.happened_at), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>

                    <p className="mt-3 text-[11px] font-bold uppercase leading-relaxed tracking-[0.08em] opacity-70">
                      {message.body}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border-4 border-dashed border-foreground/25 bg-background px-5 py-10 text-center shadow-editorial-sm">
              <p className="text-lg font-black uppercase tracking-tight">Nenhum recado por enquanto</p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] opacity-40">
                Avisos de indisciplina, agenda da classe e outros comunicados aparecerão aqui.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${surfaceSoftClass} p-5 flex flex-col gap-2`}>
          <div className="flex items-center gap-2 opacity-50">
            <Activity className="w-4 h-4 stroke-[3]" />
            <span className="text-[9px] font-black uppercase tracking-widest">Último sábado</span>
          </div>
          <strong className="text-3xl font-black tracking-tight">{latestScore}</strong>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            {latestEntry ? `Média da turma ${latestAverage.toFixed(1)}` : "Sem lançamento ainda"}
          </span>
        </div>

        <div className={`${surfaceSoftClass} p-5 flex flex-col gap-2`}>
          <div className="flex items-center gap-2 opacity-50">
            <TrendingUp className="w-4 h-4 stroke-[3]" />
            <span className="text-[9px] font-black uppercase tracking-widest">Média pessoal</span>
          </div>
          <strong className="text-3xl font-black tracking-tight">{averageScore.toFixed(1)}</strong>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            {progress.length} lançamentos acompanhados
          </span>
        </div>

        <div className={`${surfaceSoftClass} p-5 flex flex-col gap-2`}>
          <div className="flex items-center gap-2 opacity-50">
            <BarChart3 className="w-4 h-4 stroke-[3]" />
            <span className="text-[9px] font-black uppercase tracking-widest">Diferença atual</span>
          </div>
          <strong className="text-3xl font-black tracking-tight">
            {latestEntry ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` : "--"}
          </strong>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            Em relação ao acumulado médio da turma
          </span>
        </div>

        <div className="bg-es-yellow border-4 border-foreground shadow-editorial p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2 opacity-70">
            <Trophy className="w-4 h-4 stroke-[3]" />
            <span className="text-[9px] font-black uppercase tracking-widest">Pontuação total</span>
          </div>
          <strong className="text-4xl font-black tracking-tight">{totalScore.toFixed(1)}</strong>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            Acumulado do aluno neste período
          </span>
        </div>
      </div>

      <section className={`${surfaceClass} p-4 md:p-8 flex flex-col gap-6`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-[26px] md:text-[32px] font-black uppercase tracking-tighter leading-none">
              Desempenho comparado
            </h2>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
              Visão semanal e acumulada do aluno contra a turma
            </span>
          </div>
          <div className="border-2 border-foreground bg-background px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] shadow-editorial-sm">
            {className}
          </div>
        </div>

        {timeline.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 md:gap-6">
            <PerformanceChartDrilldown
              data={timeline}
              title="Aluno vs média da turma"
              eyebrow="Evolução semanal"
              ariaLabel="Gráfico semanal comparando a pontuação do aluno com a média da turma"
              classNameLabel={className}
              studentLabel={studentFirstName}
            />
            <PerformanceChartDrilldown
              data={cumulativeTimeline}
              title="Acumulado vs acumulado médio"
              eyebrow="Pontuação acumulada"
              ariaLabel="Gráfico acumulado comparando a pontuação total do aluno com a pontuação acumulada média da turma"
              classNameLabel={className}
              studentLabel={studentFirstName}
            />
          </div>
        ) : (
          <div className="border-4 border-foreground border-dashed bg-background p-10 text-center shadow-editorial-sm">
            <p className="text-lg font-black uppercase tracking-tight">Ainda não há pontuações para comparar.</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] opacity-40">
              O gráfico aparece assim que a matrícula for aprovada e a coordenação lançar a frequência e os pontos da turma.
            </p>
          </div>
        )}
      </section>

    </div>
  );
}
