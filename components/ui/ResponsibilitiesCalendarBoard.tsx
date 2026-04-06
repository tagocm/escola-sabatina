"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Plus, Search, Shuffle, Trash2, UserCircle2, X } from "lucide-react";
import { getResponsibilityColor } from "@/components/ui/responsibility-colors";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";

interface StudentOption {
  id: string;
  full_name: string;
  photo_url?: string | null;
}

interface TaskAssignment {
  id: string;
  slotIndex: number;
  studentId: string;
  studentName: string;
  studentPhotoUrl?: string | null;
}

interface DayTask {
  id: string;
  name: string;
  participantCount: number;
  frequencyWeeks: number;
  messageTemplate: string;
  assignments: TaskAssignment[];
}

interface DayEntry {
  date: string;
  label: string;
  fullLabel: string;
  tasks: DayTask[];
}

interface ResponsibilitiesCalendarBoardProps {
  days: DayEntry[];
  students: StudentOption[];
  classSettingsHref: string;
  onAssign: (formData: FormData) => Promise<void>;
  onDraw: (formData: FormData) => Promise<void>;
  onUpdateSlotCount: (formData: FormData) => Promise<void>;
  onDeleteAssignment: (formData: FormData) => Promise<void>;
  onDeleteTemplate: (formData: FormData) => Promise<void>;
}

export default function ResponsibilitiesCalendarBoard({
  days,
  students,
  classSettingsHref,
  onAssign,
  onDraw,
  onUpdateSlotCount,
  onDeleteAssignment,
  onDeleteTemplate,
}: ResponsibilitiesCalendarBoardProps) {
  const [activeTaskKey, setActiveTaskKey] = useState<string | null>(null);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [slotCount, setSlotCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR")),
    [students],
  );
  const filteredStudents = useMemo(() => {
    const normalizedQuery = studentQuery.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return sortedStudents;
    return sortedStudents.filter((student) =>
      student.full_name.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
    );
  }, [sortedStudents, studentQuery]);

  let activeEntry: { day: DayEntry; task: DayTask; key: string } | null = null;
  if (activeTaskKey) {
    for (const day of days) {
      for (const task of day.tasks) {
        const key = `${day.date}-${task.id}`;
        if (key === activeTaskKey) {
          activeEntry = { day, task, key };
          break;
        }
      }
      if (activeEntry) break;
    }
  }

  const resetModalState = () => {
    setActiveTaskKey(null);
    setPickerSlotIndex(null);
    setStudentQuery("");
    setSlotCount(0);
  };

  const handleAssignStudent = (studentId: string, slotIndex: number) => {
    if (!activeEntry) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("templateId", activeEntry.task.id);
      formData.set("scheduledDate", activeEntry.day.date);
      formData.set("slotIndex", String(slotIndex));
      formData.set("studentId", studentId);
      await onAssign(formData);
      setPickerSlotIndex(null);
      setStudentQuery("");
    });
  };

  const handleAddSlot = () => {
    if (!activeEntry) return;
    const nextSlotCount = slotCount + 1;

    startTransition(async () => {
      const slotFormData = new FormData();
      slotFormData.set("templateId", activeEntry.task.id);
      slotFormData.set("scheduledDate", activeEntry.day.date);
      slotFormData.set("participantCount", String(nextSlotCount));
      await onUpdateSlotCount(slotFormData);
      setSlotCount(nextSlotCount);
    });
  };

  const handleDeleteSlot = (slotIndex: number) => {
    if (!activeEntry || slotCount <= 1) return;
    const assignments = [...activeEntry.task.assignments].sort((a, b) => a.slotIndex - b.slotIndex);
    const assignmentsToShift = assignments.filter((item) => item.slotIndex > slotIndex);
    const trailingAssignment = assignments
      .filter((item) => item.slotIndex >= slotIndex)
      .at(-1);

    startTransition(async () => {
      for (const assignment of assignmentsToShift) {
        const assignFormData = new FormData();
        assignFormData.set("templateId", activeEntry.task.id);
        assignFormData.set("scheduledDate", activeEntry.day.date);
        assignFormData.set("slotIndex", String(assignment.slotIndex - 1));
        assignFormData.set("studentId", assignment.studentId);
        await onAssign(assignFormData);
      }

      if (trailingAssignment) {
        const deleteFormData = new FormData();
        deleteFormData.set("templateId", activeEntry.task.id);
        deleteFormData.set("scheduledDate", activeEntry.day.date);
        deleteFormData.set("slotIndex", String(trailingAssignment.slotIndex));
        await onDeleteAssignment(deleteFormData);
      }

      const slotFormData = new FormData();
      slotFormData.set("templateId", activeEntry.task.id);
      slotFormData.set("scheduledDate", activeEntry.day.date);
      slotFormData.set("participantCount", String(slotCount - 1));
      await onUpdateSlotCount(slotFormData);
      setSlotCount((current) => Math.max(1, current - 1));
      setPickerSlotIndex((current) => {
        if (current === null) return null;
        if (current === slotIndex) return null;
        return current > slotIndex ? current - 1 : current;
      });
    });
  };

  const handleDeleteTemplate = (templateId: string, scheduledDate: string, taskName: string) => {
    if (!window.confirm(`Deseja excluir a atividade ${taskName} apenas deste sábado?`)) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("templateId", templateId);
      formData.set("scheduledDate", scheduledDate);
      await onDeleteTemplate(formData);
      if (activeEntry?.task.id === templateId) {
        resetModalState();
      }
    });
  };

  const renderPolaroidSlot = (assignment: TaskAssignment | undefined, slotIndex: number) => (
    (() => {
      const photoSrc = assignment?.studentId ? getStudentPhotoSrc(assignment.studentId, assignment.studentPhotoUrl) : null;

      return (
        <div
          key={`${activeEntry?.task.id}-${slotIndex}`}
          className="group relative flex flex-col items-center gap-3 text-left"
        >
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDeleteSlot(slotIndex)}
            className="absolute right-3 top-3 z-10 h-9 w-9 border-4 border-foreground bg-es-orange shadow-editorial-sm flex items-center justify-center disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4 stroke-[3]" />
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => setPickerSlotIndex(slotIndex)}
            className="w-full disabled:opacity-60"
          >
            <div className="w-full max-w-[210px] bg-white border-4 border-foreground shadow-editorial-sm p-3 transition-transform group-hover:translate-y-0.5 group-hover:translate-x-0.5">
              <div className="relative aspect-square w-full border-2 border-foreground bg-[#F0F0F0] overflow-hidden flex items-center justify-center">
                {photoSrc ? (
                  <Image
                    src={photoSrc}
                    alt={assignment?.studentName ?? "Aluno selecionado"}
                    fill
                    unoptimized
                    sizes="210px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-foreground/30">
                    <UserCircle2 className="w-16 h-16 stroke-[1.5]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Selecionar aluno</span>
                  </div>
                )}
              </div>

              <div className="flex min-h-[54px] flex-col justify-center pt-3 text-center">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-35">
                  Vaga {slotIndex + 1}
                </span>
                <strong className="text-sm font-black uppercase tracking-tight leading-tight">
                  {assignment?.studentName || "Sem aluno definido"}
                </strong>
              </div>
            </div>
          </button>
        </div>
      );
    })()
  );

  const openTask = (day: DayEntry, task: DayTask) => {
    setActiveTaskKey(`${day.date}-${task.id}`);
    setSlotCount(Math.max(task.participantCount, task.assignments.length));
    setPickerSlotIndex(null);
    setStudentQuery("");
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {days.map((day) => (
          <div key={day.date} className="flex min-h-[260px] flex-col gap-4 border-4 border-foreground bg-background p-4 shadow-editorial-sm md:min-h-[286px] md:p-5">
            {day.tasks.length > 0 ? (
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex flex-col gap-1 shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Sábado</span>
                      <h3 className="text-lg md:text-xl font-black uppercase tracking-tight">{day.fullLabel}</h3>
                    </div>
                    <Link
                      href={classSettingsHref}
                      className="h-10 w-10 border-4 border-foreground bg-es-green shadow-editorial-sm flex items-center justify-center hover:translate-y-0.5 hover:translate-x-0.5 transition-all shrink-0"
                      title="Adicionar atividade"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </Link>
                  </div>
                </div>

                <div className="relative flex-1 min-h-[160px] overflow-hidden border-4 border-foreground bg-[#f6f1df] p-3 shadow-editorial-sm md:p-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] bg-[size:22px_22px] opacity-30 pointer-events-none" />
                  <div className="relative flex flex-col gap-3">
                    {day.tasks.map((task) => {
                      const taskColor = getResponsibilityColor(task.id);
                      const filledCount = task.assignments.length;

                      return (
                        <div
                          key={`${day.date}-${task.id}-summary`}
                          className="relative"
                        >
                          <button
                            type="button"
                            onClick={() => openTask(day, task)}
                            className="relative flex w-full flex-col gap-3 border-4 border-foreground bg-white/90 px-3 py-3 pr-12 text-left shadow-editorial-sm transition-all hover:translate-y-0.5 hover:translate-x-0.5 md:px-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className={`w-9 h-9 border-4 border-foreground ${taskColor.icon} flex items-center justify-center shadow-editorial-sm shrink-0`}>
                                  <CalendarDays className="w-4 h-4 stroke-[3]" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-[13px] md:text-sm font-black uppercase tracking-tight leading-none">{task.name}</h4>
                                  <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-45">
                                    {filledCount === 0 ? "Nenhuma vaga preenchida" : `${filledCount}/${task.participantCount} vagas preenchidas`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {task.assignments.length > 0 ? (
                                task.assignments.map((assignment) => (
                                  <div
                                    key={assignment.id}
                                    className="px-3 py-1.5 border-2 border-foreground bg-background text-[10px] font-black uppercase tracking-[0.14em] shadow-editorial-sm"
                                  >
                                    {assignment.studentName}
                                  </div>
                                ))
                              ) : (
                                <div className="px-3 py-1.5 border-2 border-dashed border-foreground/35 bg-white text-[10px] font-black uppercase tracking-[0.14em] opacity-40">
                                  Aguardando alunos
                                </div>
                              )}
                            </div>
                          </button>

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDeleteTemplate(task.id, day.date, task.name)}
                            className="absolute right-3 top-3 h-8 w-8 border-4 border-foreground bg-es-orange shadow-editorial-sm flex items-center justify-center disabled:opacity-60"
                            title="Excluir atividade"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      );
                    })}

                    {day.tasks.every((task) => task.assignments.length === 0) ? (
                      <div className="w-full h-full min-h-[100px] flex items-center justify-center text-center">
                        <p className="text-base font-black uppercase tracking-tight opacity-25">
                          Atividades aguardando alunos
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Sábado</span>
                  <h3 className="text-xl font-black uppercase tracking-tight">{day.fullLabel}</h3>
                </div>
                <div className="border-4 border-dashed border-foreground/30 bg-white px-6 py-10 text-center min-h-[180px] flex items-center justify-center">
                  <p className="text-base font-black uppercase tracking-tight opacity-40">Sem atividades nesta aula</p>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {activeEntry ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-3 md:p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col gap-5 overflow-y-auto border-4 border-foreground bg-white p-4 shadow-editorial md:gap-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                  {activeEntry.day.fullLabel}
                </span>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">
                  {activeEntry.task.name}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-50">
                  {activeEntry.task.participantCount} participante(s) • a cada {activeEntry.task.frequencyWeeks} sábado(s)
                </span>
              </div>

              <button
                type="button"
                onClick={resetModalState}
                className="w-12 h-12 border-4 border-foreground bg-background shadow-editorial-sm flex items-center justify-center"
              >
                <X className="w-5 h-5 stroke-[3]" />
              </button>
            </div>

            <div className="flex justify-end">
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleAddSlot}
                  className="h-11 px-4 border-4 border-foreground bg-es-green font-black text-[10px] uppercase tracking-[0.18em] shadow-editorial-sm flex items-center gap-2 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  Adicionar vaga
                </button>

                <form action={onDraw}>
                  <input type="hidden" name="templateId" value={activeEntry.task.id} />
                  <input type="hidden" name="scheduledDate" value={activeEntry.day.date} />
                  <input type="hidden" name="participantCount" value={slotCount} />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="h-11 px-4 border-4 border-foreground bg-es-yellow font-black text-[10px] uppercase tracking-[0.18em] shadow-editorial-sm flex items-center gap-2"
                  >
                    <Shuffle className="w-4 h-4 stroke-[3]" />
                    Sortear
                  </button>
                </form>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 md:gap-5">
              {Array.from({ length: slotCount }, (_, slotIndex) => {
                const assignment = activeEntry.task.assignments.find((item) => item.slotIndex === slotIndex);
                return renderPolaroidSlot(assignment, slotIndex);
              })}
            </div>
          </div>
        </div>
      ) : null}

      {activeEntry && pickerSlotIndex !== null && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-3 md:p-4">
          <div className="flex h-[min(80vh,720px)] w-full max-w-2xl flex-col gap-5 border-4 border-foreground bg-white p-4 shadow-editorial md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                  {activeEntry.task.name} • vaga {pickerSlotIndex + 1}
                </span>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">Selecionar aluno</h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-50">
                  Lista em ordem alfabética
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPickerSlotIndex(null);
                  setStudentQuery("");
                }}
                className="w-12 h-12 border-4 border-foreground bg-background shadow-editorial-sm flex items-center justify-center"
              >
                <X className="w-5 h-5 stroke-[3]" />
              </button>
            </div>

            <div className="flex-1 border-4 border-foreground bg-background shadow-editorial-sm p-4 md:p-5 flex flex-col gap-4 min-h-0">
              <label className="flex items-center gap-3 h-14 border-4 border-foreground bg-white px-4 shadow-editorial-sm">
                <Search className="w-4 h-4 stroke-[3] opacity-50 shrink-0" />
                <input
                  type="text"
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  placeholder="Buscar aluno pelo nome..."
                  className="w-full bg-transparent outline-none text-sm font-black uppercase tracking-[0.12em] placeholder:opacity-30"
                />
              </label>

              <div className="flex-1 min-h-0 overflow-y-scroll border-4 border-foreground bg-white shadow-editorial-sm">
                <div className="flex min-h-full flex-col">
                  {filteredStudents.length > 0 ? filteredStudents.map((student, index) => {
                    const photoSrc = getStudentPhotoSrc(student.id, student.photo_url);

                    return (
                      <button
                        key={student.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleAssignStudent(student.id, pickerSlotIndex)}
                        className={`grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                          index > 0 ? "border-t-4 border-foreground" : ""
                        } ${index % 2 === 0 ? "bg-[#f8f4e8]" : "bg-white"} hover:bg-background`}
                      >
                        <div className="w-[72px] bg-white border-4 border-foreground shadow-editorial-sm p-2">
                          <div className="relative aspect-square w-full border-2 border-foreground bg-[#F0F0F0] overflow-hidden flex items-center justify-center">
                            {photoSrc ? (
                              <Image
                                src={photoSrc}
                                alt={student.full_name}
                                fill
                                unoptimized
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <UserCircle2 className="w-8 h-8 opacity-35" />
                            )}
                          </div>
                          <div className="pt-2 text-center">
                            <span className="text-[8px] font-black uppercase tracking-[0.18em] opacity-50">
                              {student.full_name.split(" ")[0]}
                            </span>
                          </div>
                        </div>

                        <div className="min-w-0 flex flex-col gap-1">
                          <span className="text-[8px] font-black uppercase tracking-[0.22em] opacity-35">Aluno disponível</span>
                          <strong className="text-lg font-black uppercase tracking-tight leading-tight break-words md:text-[22px]">
                            {student.full_name}
                          </strong>
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="flex min-h-full items-center justify-center px-6 py-10 text-center bg-background">
                      <p className="text-lg font-black uppercase tracking-tight opacity-35">Nenhum aluno encontrado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
