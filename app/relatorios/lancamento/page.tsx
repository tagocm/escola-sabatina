import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveClassContext,
  getClassWeeklyBibleVerseByWeek,
} from "@/app/actions/classes";
import { getAttendanceContext } from "@/app/actions/attendance";
import { getStudents } from "@/app/actions/students";
import { getScoringRules } from "@/app/actions/scoring";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import AttendanceStudentLists from "@/components/ui/AttendanceStudentLists";
import WeeklyBibleVerseStickyCard from "@/components/ui/WeeklyBibleVerseStickyCard";
import ClassGallerySection from "@/components/ui/ClassGallerySection";
import { pageMainClass, pageShellClass } from "@/components/ui/design-system";
import type { AttendanceDisciplineEvent } from "@/lib/types/attendance";

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

function shiftSaturday(input: string, weeks: number) {
  const [year, month, day] = input.split("-").map(Number);
  const shiftedDate = new Date(year, month - 1, day + (weeks * 7), 12, 0, 0);

  return `${shiftedDate.getFullYear()}-${String(shiftedDate.getMonth() + 1).padStart(2, "0")}-${String(shiftedDate.getDate()).padStart(2, "0")}`;
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
  const prevSat = shiftSaturday(saturdayStr, -1);
  const nextSat = shiftSaturday(saturdayStr, 1);

  const [attendanceData, students, rules, weeklyBibleVerse] = await Promise.all([
    getAttendanceContext(classId, saturdayStr),
    getStudents(classId),
    getScoringRules(classId),
    getClassWeeklyBibleVerseByWeek(classId, saturdayStr),
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

  const getRecordAdjustments = (studentId: string) => {
    const record = recordsByStudentId.get(studentId) as
      | {
          id: string;
          saved_at?: string | null;
          extra_activity_points?: number | null;
          discipline_penalty_points?: number | null;
          discipline_penalty_reason?: string | null;
          discipline_penalty_applied_by?: string | null;
          discipline_penalty_applied_by_name?: string | null;
          attendance_discipline_events?: Array<{
            id: string;
            points: number | null;
            reason: string | null;
            applied_by: string | null;
            applied_by_name: string | null;
            created_at: string | null;
            updated_at: string | null;
          }> | null;
        }
      | undefined;

    const disciplineEvents: AttendanceDisciplineEvent[] = Array.isArray(record?.attendance_discipline_events)
      ? [...record.attendance_discipline_events]
          .sort((left, right) => {
            const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
            const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
            return leftTime - rightTime;
          })
          .map((event) => ({
            id: event.id,
            points: Math.max(1, Number(event.points || 1)),
            reason: String(event.reason || "").trim(),
            appliedBy: event.applied_by,
            appliedByName: event.applied_by_name,
            createdAt: event.created_at,
            updatedAt: event.updated_at,
          }))
      : [];

    if (disciplineEvents.length === 0 && Number(record?.discipline_penalty_points || 0) > 0) {
      disciplineEvents.push({
        points: Math.max(1, Number(record?.discipline_penalty_points || 1)),
        reason: String(record?.discipline_penalty_reason || "Registro anterior sem motivo informado").trim(),
        appliedBy: record?.discipline_penalty_applied_by || null,
        appliedByName: record?.discipline_penalty_applied_by_name || "Professor não identificado",
        createdAt: record?.saved_at || null,
        updatedAt: record?.saved_at || null,
      });
    }

    return {
      extraActivityPoints: record?.extra_activity_points ?? 0,
      disciplineEvents,
    };
  };
  const buildStudentListItem = (student: (typeof students)[number]) => {
    const adjustments = getRecordAdjustments(student.id);

    return {
      full_name: student.full_name,
      student,
      initialSelectedRuleIds: selectedRuleIdsByStudentId[student.id] || [],
      initialExtraActivityPoints: adjustments.extraActivityPoints,
      initialDisciplineEvents: adjustments.disciplineEvents,
    };
  };
  const pendingStudentItems = pendingStudents.map(buildStudentListItem);
  const savedStudentItems = savedStudents.map(buildStudentListItem);

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

          <div className="flex h-12 w-full shrink-0 overflow-hidden border-4 border-foreground bg-surface shadow-editorial-sm sm:w-auto">
            <Link href={`?d=${prevSat}`} className="w-12 flex items-center justify-center border-r-4 border-foreground hover:bg-background transition-colors" title="Sábado Anterior">
              <ArrowLeft className="w-4 h-4 stroke-[3]" />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-surface px-4 sm:min-w-[140px] sm:px-6">
              <span className="text-[7px] font-black uppercase tracking-widest opacity-30 leading-none mb-1">Data Escolar</span>
              <span className="text-[11px] font-black uppercase tracking-tighter">{displayDate}</span>
            </div>

            <Link href={`?d=${nextSat}`} className="w-12 flex items-center justify-center border-l-4 border-foreground hover:bg-background transition-colors" title="Próximo Sábado">
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </Link>
          </div>
        </div>

        <WeeklyBibleVerseStickyCard
          verse={weeklyBibleVerse}
        />

        <ClassGallerySection
          classId={classId}
          weekDate={saturdayStr}
        />

        <AttendanceStudentLists
          key={saturdayStr}
          classId={classId}
          date={saturdayStr}
          rules={rules}
          pendingStudents={pendingStudentItems}
          savedStudents={savedStudentItems}
        />
      </main>
    </div>
  );
}
