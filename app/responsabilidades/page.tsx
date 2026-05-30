import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import ResponsibilitiesCalendarBoard from "@/components/ui/ResponsibilitiesCalendarBoard";
import { getActiveClassContext, getClassById } from "@/app/actions/classes";
import { requireTeacherPage } from "@/lib/auth/guards";
import {
  assignResponsibilityAction,
  deleteResponsibilityTaskForDayAction,
  deleteResponsibilityAssignmentAction,
  drawResponsibilityAction,
  getResponsibilitiesCalendar,
  updateResponsibilitySlotCountAction,
} from "@/app/actions/responsibilities";
import { pageMainClass, pageShellClass } from "@/components/ui/design-system";

interface Props {
  searchParams: Promise<{ m?: string }>;
}

function getMonthRef(input?: string) {
  const date = input ? new Date(`${input}-01T12:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) {
    return getMonthRef();
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ResponsibilitiesPage({ searchParams }: Props) {
  await requireTeacherPage();
  const monthRef = getMonthRef((await searchParams).m);
  const classId = await getActiveClassContext();
  if (!classId) redirect("/classes");

  const classData = await getClassById(classId);
  if (!classData) redirect("/classes");

  const [year, month] = monthRef.split("-").map(Number);
  const currentMonth = new Date(year, month - 1, 1, 12, 0, 0);
  const previousMonth = new Date(year, month - 2, 1, 12, 0, 0);
  const nextMonth = new Date(year, month, 1, 12, 0, 0);
  const prevRef = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
  const nextRef = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

  const { days, students } = await getResponsibilitiesCalendar(classId, monthRef);
  const totalTasks = days.reduce((sum, day) => sum + day.tasks.length, 0);
  const totalAssignments = days.reduce(
    (sum, day) => sum + day.tasks.reduce((taskSum, task) => taskSum + task.assignments.length, 0),
    0,
  );
  const assignAction = assignResponsibilityAction.bind(null, classId);
  const drawAction = drawResponsibilityAction.bind(null, classId);
  const updateSlotCountAction = updateResponsibilitySlotCountAction.bind(null, classId);
  const deleteAssignmentAction = deleteResponsibilityAssignmentAction.bind(null, classId);
  const deleteTaskForDayAction = deleteResponsibilityTaskForDayAction.bind(null, classId);
  const submitAssignAction = async (formData: FormData) => {
    "use server";
    await assignAction(formData);
  };
  const submitDrawAction = async (formData: FormData) => {
    "use server";
    await drawAction(formData);
  };
  const submitUpdateSlotCountAction = async (formData: FormData) => {
    "use server";
    await updateSlotCountAction(formData);
  };
  const submitDeleteAssignmentAction = async (formData: FormData) => {
    "use server";
    await deleteAssignmentAction(formData);
  };
  const submitDeleteTaskForDayAction = async (formData: FormData) => {
    "use server";
    await deleteTaskForDayAction(formData);
  };

  return (
    <div className={pageShellClass}>
      <Header />

      <main className={`${pageMainClass} max-w-7xl`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Responsabilidades"
            subtitle="Agenda de tarefas dos sábados e escala dos alunos"
            backHref="/"
            backLabel="Voltar ao Painel"
          />

          <div className="flex h-12 w-full shrink-0 overflow-hidden border-4 border-foreground bg-surface shadow-editorial-sm sm:w-auto">
            <Link href={`?m=${prevRef}`} className="w-12 flex items-center justify-center border-r-4 border-foreground hover:bg-background transition-colors">
              <ArrowLeft className="w-4 h-4 stroke-[3]" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-surface px-4 sm:min-w-[170px] sm:px-6">
              <span className="text-[7px] font-black uppercase tracking-widest opacity-30 leading-none mb-1">Mês em foco</span>
              <span className="text-[11px] font-black uppercase tracking-tighter">
                {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <Link href={`?m=${nextRef}`} className="w-12 flex items-center justify-center border-l-4 border-foreground hover:bg-background transition-colors">
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </Link>
          </div>
        </div>

        <section className="bg-surface border-4 border-foreground p-5 md:p-6 shadow-editorial flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 border-4 border-foreground bg-es-green flex items-center justify-center shadow-editorial-sm shrink-0">
                <CalendarDays className="w-5 h-5 stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-2xl font-black uppercase tracking-tighter">{classData.name}</h2>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-40">
                  Agenda compacta dos sábados com distribuição das tarefas da classe
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-3">
              <div className="border-4 border-foreground bg-background px-4 py-3 shadow-editorial-sm min-w-0">
                <span className="text-[8px] font-black uppercase tracking-[0.18em] opacity-35">Sábados no mês</span>
                <strong className="mt-1 block text-2xl font-black leading-none">{days.length}</strong>
              </div>
              <div className="border-4 border-foreground bg-background px-4 py-3 shadow-editorial-sm min-w-0">
                <span className="text-[8px] font-black uppercase tracking-[0.18em] opacity-35">Atividades</span>
                <strong className="mt-1 block text-2xl font-black leading-none">{totalTasks}</strong>
              </div>
              <div className="border-4 border-foreground bg-background px-4 py-3 shadow-editorial-sm min-w-0">
                <span className="text-[8px] font-black uppercase tracking-[0.18em] opacity-35">Vagas preenchidas</span>
                <strong className="mt-1 block text-2xl font-black leading-none">{totalAssignments}</strong>
              </div>
            </div>
          </div>

          {days.length > 0 ? (
            <ResponsibilitiesCalendarBoard
              days={days as never}
              students={students as never}
              classSettingsHref={`/classes/${classId}#responsibilities-section`}
              onAssign={submitAssignAction}
              onDraw={submitDrawAction}
              onUpdateSlotCount={submitUpdateSlotCountAction}
              onDeleteAssignment={submitDeleteAssignmentAction}
              onDeleteTemplate={submitDeleteTaskForDayAction}
            />
          ) : (
            <div className="border-4 border-dashed border-foreground/30 bg-background px-6 py-12 text-center">
              <p className="text-lg font-black uppercase tracking-tight opacity-40">Nenhum sábado encontrado neste mês</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
