import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ArrowRight, Check, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveClassContext } from "@/app/actions/classes";
import { getAttendanceContext } from "@/app/actions/attendance";
import { getStudents } from "@/app/actions/students";
import { getScoringRules } from "@/app/actions/scoring";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import AttendanceCard from "@/components/ui/AttendanceCard";
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

export default async function LancamentoFrequenciaPage({ searchParams }: Params) {
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
    redirect(`/relatorios/lancamento?d=${saturdayStr}`);
  }

  const [tY, tM, tD] = saturdayStr.split("-").map(Number);
  const targetDate = new Date(tY, tM - 1, tD, 12, 0, 0);
  const prevDate = new Date(tY, tM - 1, tD - 7, 12, 0, 0);
  const nextDate = new Date(tY, tM - 1, tD + 7, 12, 0, 0);
  const prevSat = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
  const nextSat = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;

  const [attendanceData, students, rules] = await Promise.all([
    getAttendanceContext(classId, saturdayStr),
    getStudents(classId),
    getScoringRules(classId),
  ]);

  if ("error" in attendanceData) {
    return <div className="p-8 font-black uppercase">Erro ao carregar dados de frequência: {attendanceData.error}</div>;
  }

  const recordsByStudentId = new Map(
    attendanceData.records.map((record) => [record.student_id, record]),
  );

  const selectedRuleIdsByStudentId = attendanceData.scores.reduce<Record<string, string[]>>((acc, score) => {
    acc[score.student_id] = [...(acc[score.student_id] || []), score.rule_id];
    return acc;
  }, {});

  const pendingStudents = students.filter((student) => !recordsByStudentId.has(student.id));
  const savedStudents = students.filter((student) => recordsByStudentId.has(student.id));

  const displayDate = format(targetDate, "dd 'de' MMMM", { locale: ptBR });

  return (
    <div className={pageShellClass}>
      <Header />

      <main className={pageMainClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
          <PageHeader
            title="Lançar Frequência"
            subtitle="Registro de presença e pontuação da classe na data selecionada"
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

        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4 border-b-4 border-foreground/10 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-es-yellow border-4 border-foreground shadow-editorial-sm">
                <Clock3 className="w-5 h-5 stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Pendentes de Entrada</h2>
                <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.22em]">
                  Alunos sem registro hoje
                </span>
              </div>
            </div>
            <span className="min-w-10 h-10 px-3 flex items-center justify-center border-4 border-foreground bg-white shadow-editorial-sm text-sm font-black uppercase">
              {pendingStudents.length}
            </span>
          </div>

          {rules.length === 0 ? (
            <div className="border-4 border-dashed border-foreground/30 bg-white px-6 py-12 text-center">
              <p className="text-lg font-black uppercase tracking-tight opacity-40">Cadastre os critérios de avaliação da classe antes de lançar frequência</p>
            </div>
          ) : pendingStudents.length > 0 ? (
            <div className="flex flex-col gap-5">
              {pendingStudents.map((student) => (
                <AttendanceCard
                  key={student.id}
                  classId={classId}
                  date={saturdayStr}
                  student={student}
                  rules={rules}
                  initialSelectedRuleIds={selectedRuleIdsByStudentId[student.id] || []}
                />
              ))}
            </div>
          ) : (
            <div className="border-4 border-dashed border-foreground/30 bg-white px-6 py-12 text-center">
              <p className="text-2xl font-black uppercase tracking-tight opacity-40">Toda a unidade já foi registrada</p>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4 border-b-4 border-es-green/20 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-es-green border-4 border-foreground shadow-editorial-sm">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Registros Finalizados</h2>
                <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.22em]">
                  Alunos já salvos para este sábado
                </span>
              </div>
            </div>
            <span className="min-w-10 h-10 px-3 flex items-center justify-center border-4 border-foreground bg-white shadow-editorial-sm text-sm font-black uppercase">
              {savedStudents.length}
            </span>
          </div>

          {savedStudents.length > 0 ? (
            <div className="flex flex-col gap-5">
              {savedStudents.map((student) => (
                <AttendanceCard
                  key={student.id}
                  classId={classId}
                  date={saturdayStr}
                  student={student}
                  rules={rules}
                  initialSelectedRuleIds={selectedRuleIdsByStudentId[student.id] || []}
                  isSaved
                />
              ))}
            </div>
          ) : (
            <div className="border-4 border-dashed border-foreground/20 bg-white px-6 py-12 text-center">
              <p className="text-lg font-black uppercase tracking-tight opacity-40">Nenhum registro finalizado ainda</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
