import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Medal, Trophy, TrendingUp, Users } from "lucide-react";
import { getActiveClassContext } from "@/app/actions/classes";
import { getClassScoringRanking } from "@/app/actions/scoring";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import { pageMainClass, pageShellClass, surfaceClass } from "@/components/ui/design-system";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import { redirect } from "next/navigation";

const statusMeta = {
  subindo: { label: "Subindo", className: "bg-es-green" },
  estavel: { label: "Estável", className: "bg-es-yellow" },
  recuperando: { label: "Recuperando", className: "bg-es-lilac" },
  atencao: { label: "Atenção", className: "bg-es-orange" },
} as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSigned(value: number) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-4 border-foreground bg-surface px-4 py-4 shadow-editorial-sm">
      <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">{label}</span>
      <p className="mt-2 text-2xl font-black leading-none tracking-tight md:text-3xl">{value}</p>
    </div>
  );
}

function StudentAvatar({
  studentId,
  name,
  photoUrl,
  sizeClassName = "h-14 w-14",
  initialsClassName = "text-sm",
}: {
  studentId: string;
  name: string;
  photoUrl: string | null;
  sizeClassName?: string;
  initialsClassName?: string;
}) {
  const photoSrc = getStudentPhotoSrc(studentId, photoUrl);

  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden border-4 border-foreground bg-surface-muted shadow-editorial-sm ${sizeClassName}`}>
      {photoSrc ? (
        <Image
          src={photoSrc}
          alt={`Foto de ${name}`}
          fill
          unoptimized
          sizes="(min-width: 1024px) 240px, 45vw"
          className="object-cover"
        />
      ) : (
        <span className={`${initialsClassName} font-black uppercase tracking-tighter opacity-50`}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}

export default async function RankingPontuacaoPage() {
  const classId = await getActiveClassContext();
  if (!classId) redirect("/classes");

  const ranking = await getClassScoringRanking(classId);
  if ("error" in ranking) {
    return (
      <div className={pageShellClass}>
        <Header />
        <main className={pageMainClass}>
          <PageHeader
            title="Ranking de Pontuação"
            subtitle="Pódio, médias e evolução trimestral da classe"
            backHref="/"
            backLabel="Voltar ao Painel"
          />
          <section className={`${surfaceClass} p-6 md:p-8`}>
            <p className="text-lg font-black uppercase tracking-tight">{ranking.error}</p>
          </section>
        </main>
      </div>
    );
  }

  const topStudents = ranking.students.slice(0, 3);
  const hasScores = ranking.students.some((student) => student.totalPoints > 0);
  const chartStudents = ranking.students.slice(0, 6);
  const maxChartPoints = Math.max(1, ...chartStudents.map((student) => student.totalPoints));
  const weeklySlots = Array.from({ length: ranking.summary.totalSaturdays }, (_, index) => ranking.weeklyAverages[index] || null);
  const maxWeeklyAverage = Math.max(1, ...ranking.weeklyAverages.map((week) => week.classAverage));
  const firstStudent = topStudents[0];
  const otherPodiumStudents = topStudents.slice(1);

  return (
    <div className={pageShellClass}>
      <Header />

      <main className={pageMainClass}>
        <PageHeader
          title="Ranking de Pontuação"
          subtitle="Pódio, médias e evolução trimestral da classe"
          backHref="/"
          backLabel="Voltar ao Painel"
        />

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr] md:gap-6">
          <div className="border-4 border-foreground bg-es-yellow p-5 shadow-editorial md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
                  Ranking trimestral
                </span>
                <h2 className="text-[32px] font-black uppercase leading-none tracking-tighter md:text-[44px]">
                  Pontuação da turma
                </h2>
              </div>
              <div className="flex h-14 w-14 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm">
                <Trophy className="h-7 w-7 stroke-[3]" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label="Sábados"
                value={`${ranking.summary.launchedSaturdays}/${ranking.summary.totalSaturdays}`}
              />
              <MetricCard label="Média" value={formatNumber(ranking.summary.classAverage)} />
              <MetricCard label="Maior" value={formatNumber(ranking.summary.classHighest)} />
            </div>
          </div>

          <div className={`${surfaceClass} flex flex-col justify-between gap-5 p-5 md:p-6`}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-lilac shadow-editorial-sm">
                <Users className="h-5 w-5 stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-xl font-black uppercase leading-none tracking-tighter">
                  Resumo da classe
                </h3>
                <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                  Dados já salvos no lançamento
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Alunos" value={String(ranking.summary.studentCount)} />
              <MetricCard label="Por sábado" value={formatNumber(ranking.summary.standardPossiblePerSaturday)} />
            </div>
          </div>
        </section>

        {!hasScores ? (
          <section className={`${surfaceClass} flex flex-col gap-6 p-6 md:p-8`}>
            <div className="border-4 border-dashed border-foreground/30 bg-background p-6 text-left shadow-editorial-sm md:p-8">
              <p className="text-lg font-black uppercase leading-tight tracking-tight">
                Ainda não há pontuações no trimestre.
              </p>
              <p className="mt-3 max-w-2xl text-[11px] font-bold uppercase leading-relaxed tracking-[0.14em] opacity-50">
                Assim que a chamada for lançada, o pódio, gráficos e tabela aparecem automaticamente aqui.
              </p>
            </div>
            <Link
              href="/relatorios/lancamento"
              className="inline-flex min-h-12 w-full items-center justify-between gap-3 border-4 border-foreground bg-es-blue px-5 text-[11px] font-black uppercase tracking-[0.16em] shadow-editorial transition-all hover:shadow-editorial-hover active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:w-auto"
            >
              Lançar pontuações
              <ArrowUpRight className="h-5 w-5 stroke-[3]" />
            </Link>
          </section>
        ) : (
          <>
            <section className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6 lg:gap-6 lg:p-8`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-green shadow-editorial-sm">
                    <Medal className="h-5 w-5 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase leading-none tracking-tighter">
                      Pódio do trimestre
                    </h3>
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                      Fotos em destaque para a apresentação final da aula
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                {firstStudent && (
                  <article className="grid grid-cols-1 gap-5 border-4 border-foreground bg-es-green p-4 shadow-editorial md:grid-cols-[minmax(220px,0.72fr)_1fr] md:p-5 lg:p-6">
                    <div className="flex min-w-0 flex-col gap-3">
                      <StudentAvatar
                        studentId={firstStudent.studentId}
                        name={firstStudent.studentName}
                        photoUrl={firstStudent.photoUrl}
                        sizeClassName="aspect-square h-auto w-full min-h-[240px] md:min-h-[300px]"
                        initialsClassName="text-5xl md:text-7xl"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="border-4 border-foreground bg-surface px-4 py-4 shadow-editorial-sm">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-50">
                            Pontos
                          </span>
                          <p className="mt-2 text-[52px] font-black leading-none tracking-tighter">
                            {formatNumber(firstStudent.totalPoints)}
                          </p>
                        </div>
                        <div className="border-4 border-foreground bg-surface px-4 py-4 shadow-editorial-sm">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-50">
                            Presença
                          </span>
                          <p className="mt-2 text-[36px] font-black leading-none tracking-tighter">
                            {firstStudent.recordedSaturdays}/{ranking.summary.launchedSaturdays}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col justify-between gap-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                            Primeiro lugar
                          </span>
                          <h4 className="text-[34px] font-black uppercase leading-none tracking-tighter md:text-[52px]">
                            {firstStudent.studentName}
                          </h4>
                        </div>
                        <span className="shrink-0 border-4 border-foreground bg-surface px-4 py-3 text-3xl font-black leading-none shadow-editorial-sm">
                          #{firstStudent.rank}
                        </span>
                      </div>
                      <div className="border-t-4 border-foreground pt-5">
                        <p className="text-[13px] font-black uppercase leading-relaxed tracking-[0.18em] opacity-70">
                          Continue firme no trimestre.
                        </p>
                      </div>
                    </div>
                  </article>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-1">
                  {otherPodiumStudents.map((student) => (
                    <article
                      key={student.studentId}
                      className="grid grid-cols-[minmax(120px,0.5fr)_1fr] gap-4 border-4 border-foreground bg-surface p-4 shadow-editorial-sm"
                    >
                      <div className="flex min-w-0 flex-col gap-3">
                        <StudentAvatar
                          studentId={student.studentId}
                          name={student.studentName}
                          photoUrl={student.photoUrl}
                          sizeClassName="aspect-square h-auto w-full min-h-[150px]"
                          initialsClassName="text-4xl"
                        />
                        <div className="border-4 border-foreground bg-background px-3 py-3 shadow-editorial-sm">
                          <span className="text-[8px] font-black uppercase tracking-[0.18em] opacity-50">
                            Pontos
                          </span>
                          <p className="text-[34px] font-black leading-none tracking-tighter">
                            {formatNumber(student.totalPoints)}
                          </p>
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-col justify-between gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-[24px] font-black uppercase leading-none tracking-tighter md:text-[30px]">
                            {student.studentName}
                          </h4>
                          <span className="shrink-0 border-4 border-foreground bg-es-yellow px-3 py-2 text-xl font-black leading-none shadow-editorial-sm">
                            #{student.rank}
                          </span>
                        </div>
                        <div className="border-t-4 border-foreground pt-3">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-50">
                            Presença
                          </span>
                          <p className="text-[30px] font-black leading-none tracking-tighter">
                            {student.recordedSaturdays}/{ranking.summary.launchedSaturdays}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2 md:gap-6">
              <div className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-orange shadow-editorial-sm">
                    <BarChart3 className="h-5 w-5 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase leading-none tracking-tighter">
                      Top pontuações
                    </h3>
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                      Barras proporcionais ao líder
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {chartStudents.map((student) => (
                    <div
                      key={student.studentId}
                      className="grid grid-cols-[minmax(0,7rem)_1fr_3rem] items-center gap-3 text-[10px] font-black uppercase tracking-[0.12em]"
                    >
                      <span className="truncate">{student.studentName}</span>
                      <div className="relative h-7 overflow-hidden border-4 border-foreground bg-background shadow-editorial-sm">
                        <div
                          className="absolute inset-y-0 left-0 bg-es-orange"
                          style={{ width: `${Math.max(4, (student.totalPoints / maxChartPoints) * 100)}%` }}
                        />
                      </div>
                      <span className="text-right">{formatNumber(student.totalPoints)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-blue shadow-editorial-sm">
                    <TrendingUp className="h-5 w-5 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase leading-none tracking-tighter">
                      Média por sábado
                    </h3>
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                      Ciclo trimestral de 13 sábados
                    </span>
                  </div>
                </div>

                <div
                  className="grid min-h-40 grid-cols-[repeat(13,minmax(0,1fr))] items-end gap-1 border-b-4 border-l-4 border-foreground px-2 pt-6"
                  role="img"
                  aria-label="Gráfico da média de pontuação da turma por sábado"
                >
                  {weeklySlots.map((week, index) => (
                    <div key={week?.dayId || index} className="flex min-w-0 flex-col items-center gap-2">
                      <div
                        className={`w-full border-2 border-foreground ${week ? "bg-es-blue" : "bg-surface"}`}
                        style={{ height: `${week ? Math.max(16, (week.classAverage / maxWeeklyAverage) * 120) : 12}px` }}
                        title={week ? `${week.label}: ${formatNumber(week.classAverage)}` : `Sábado ${index + 1}`}
                      />
                      <span className="text-[8px] font-black uppercase tracking-tighter opacity-40">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6`}>
              <div className="flex items-center gap-3">
                <div className="h-6 w-2 border-2 border-foreground bg-es-lilac" />
                <h3 className="text-xl font-black uppercase leading-none tracking-tighter">
                  Tabela completa
                </h3>
              </div>

              <div className="overflow-x-auto border-4 border-foreground bg-surface shadow-editorial-sm">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[4rem_1.6fr_0.7fr_0.7fr_0.8fr_0.7fr_1fr] gap-3 border-b-4 border-foreground bg-background px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em]">
                    <span>#</span>
                    <span>Aluno</span>
                    <span>Total</span>
                    <span>Média</span>
                    <span>Presença</span>
                    <span>Ritmo</span>
                    <span>Status</span>
                  </div>
                  {ranking.students.map((student) => {
                    const meta = statusMeta[student.status];
                    return (
                      <div
                        key={student.studentId}
                        className="grid grid-cols-[4rem_1.6fr_0.7fr_0.7fr_0.8fr_0.7fr_1fr] items-center gap-3 border-b-2 border-foreground/10 px-4 py-3 text-sm font-bold uppercase tracking-wide last:border-b-0"
                      >
                        <span className="flex h-9 w-9 items-center justify-center border-4 border-foreground bg-es-yellow text-xs font-black shadow-editorial-sm">
                          {student.rank}
                        </span>
                        <span className="font-black tracking-tight">{student.studentName}</span>
                        <span>{formatNumber(student.totalPoints)}</span>
                        <span>{formatNumber(student.averagePoints)}</span>
                        <span>{student.recordedSaturdays}/{ranking.summary.launchedSaturdays}</span>
                        <span>{formatSigned(student.recentTrend)}</span>
                        <span className={`inline-flex min-h-8 items-center justify-center border-2 border-foreground px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
