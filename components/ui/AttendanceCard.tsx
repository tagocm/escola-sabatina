"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { saveStudentAttendanceRecord } from "@/app/actions/attendance";
import { UserCircle, Loader2, Check, Save, Lock, Settings } from "lucide-react";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import type { AttendanceDisciplineEvent } from "@/lib/types/attendance";
import AttendanceStudentEditModal from "@/components/ui/AttendanceStudentEditModal";
import AttendanceDisciplinePenaltyModal from "@/components/ui/AttendanceDisciplinePenaltyModal";
import AttendanceDisciplineEventsCard from "@/components/ui/AttendanceDisciplineEventsCard";

interface Rule {
  id: string;
  name: string;
  category: "frequencia" | "participacao" | "espiritual" | "atividade";
  points: number;
}

interface AttendanceCardProps {
  classId: string;
  date: string;
  student: {
    id: string;
    class_id: string;
    full_name: string;
    photo_url: string | null;
    birth_date: string | null;
    sex: "masculino" | "feminino";
    guardian_name: string | null;
    whatsapp: string | null;
  };
  rules: Rule[];
  initialSelectedRuleIds: string[];
  initialExtraActivityPoints?: number;
  initialDisciplineEvents?: AttendanceDisciplineEvent[];
  isSaved?: boolean;
}

const CATEGORY_STYLES = {
  frequencia: { color: "bg-es-blue", border: "border-es-blue" },
  participacao: { color: "bg-es-orange", border: "border-es-orange" },
  espiritual: { color: "bg-es-lilac", border: "border-es-lilac" },
  atividade: { color: "bg-es-yellow", border: "border-es-yellow" },
};

function normalizeDisciplineEvent(event: AttendanceDisciplineEvent): AttendanceDisciplineEvent {
  return {
    id: event.id,
    points: Number.isFinite(event.points) ? Math.max(1, Math.trunc(event.points)) : 1,
    reason: String(event.reason || "").trim(),
    appliedBy: event.appliedBy || null,
    appliedByName: event.appliedByName || null,
    createdAt: event.createdAt || null,
    updatedAt: event.updatedAt || null,
  };
}

interface AttendanceAdjustmentPanelProps {
  title: string;
  subtitle: string;
  value: string;
  tone: "green" | "orange";
  actionLabel: string;
  onDecrease: () => void;
  onPrimary: () => void;
  onIncrease: () => void;
  decreaseDisabled?: boolean;
  primaryDisabled?: boolean;
  increaseDisabled?: boolean;
}

const ADJUSTMENT_PANEL_STYLES = {
  green: {
    title: "text-es-green",
    primary: "bg-es-green text-foreground",
  },
  orange: {
    title: "text-es-orange",
    primary: "bg-es-orange text-foreground",
  },
};

function AttendanceAdjustmentPanel({
  title,
  subtitle,
  value,
  tone,
  actionLabel,
  onDecrease,
  onPrimary,
  onIncrease,
  decreaseDisabled = false,
  primaryDisabled = false,
  increaseDisabled = false,
}: AttendanceAdjustmentPanelProps) {
  const toneStyles = ADJUSTMENT_PANEL_STYLES[tone];

  return (
    <div className="grid h-[88px] grid-rows-[1fr_32px] gap-2 border-4 border-foreground bg-surface px-2.5 py-2.5 shadow-editorial-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1 pr-1">
          <span className={`text-[8px] font-black uppercase leading-none tracking-[0.18em] ${toneStyles.title}`}>
            {title}
          </span>
          <span className="text-[7px] font-bold uppercase leading-none tracking-[0.18em] text-foreground/40">
            {subtitle}
          </span>
        </div>

        <span className="flex h-6 min-w-[2.75rem] shrink-0 items-center justify-center border-2 border-foreground bg-background px-2 text-[11px] font-black uppercase tracking-tight">
          {value}
        </span>
      </div>

      <div className="grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2">
        <button
          type="button"
          onClick={onDecrease}
          disabled={decreaseDisabled}
          className="flex h-8 w-8 items-center justify-center border-4 border-foreground bg-surface text-[16px] font-black leading-none shadow-editorial-sm transition-all hover:bg-background disabled:opacity-30"
        >
          -
        </button>

        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className={`flex h-8 min-w-0 items-center justify-center overflow-hidden border-4 border-foreground px-2.5 text-[9px] font-black uppercase tracking-[0.12em] shadow-editorial-sm transition-all disabled:opacity-30 ${toneStyles.primary}`}
        >
          {actionLabel}
        </button>

        <button
          type="button"
          onClick={onIncrease}
          disabled={increaseDisabled}
          className="flex h-8 w-8 items-center justify-center border-4 border-foreground bg-surface text-[16px] font-black leading-none shadow-editorial-sm transition-all hover:bg-background disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function AttendanceCard({
  classId,
  date,
  student,
  rules,
  initialSelectedRuleIds,
  initialExtraActivityPoints = 0,
  initialDisciplineEvents = [],
  isSaved = false,
}: AttendanceCardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedRuleIds);
  const [extraActivityPoints, setExtraActivityPoints] = useState(initialExtraActivityPoints);
  const [disciplineEvents, setDisciplineEvents] = useState<AttendanceDisciplineEvent[]>(() =>
    initialDisciplineEvents.map(normalizeDisciplineEvent),
  );
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isDisciplineModalOpen, setIsDisciplineModalOpen] = useState(false);

  const getShortName = (name: string) => {
    if (name.includes("Participação")) {
      const action = name.replace("Participação ", "");
      if (action.includes("recolher")) return "Oferta";
      if (action.includes("cantar")) return "Cantar";
      if (action.includes("carta")) return "Carta";
      return action;
    }
    if (name.includes("Atividade")) return "Atividade";
    if (name.includes("Verso")) return "Verso";
    return name;
  };

  const getFormattedName = (fullName: string) => {
    const normalizedName = fullName.replace(/\s+/g, " ").trim();
    const parts = normalizedName ? normalizedName.split(" ") : [];

    return {
      first: parts[0]?.toUpperCase() || "ALUNO",
      remaining: parts.slice(1).join(" ").toUpperCase(),
    };
  };

  const handleToggle = (ruleId: string) => {
    if (isSaved && !isEditing) return;

    setSelectedIds((current) =>
      current.includes(ruleId)
        ? current.filter((id) => id !== ruleId)
        : [...current, ruleId],
    );
  };

  const closeDisciplineModal = () => {
    setIsDisciplineModalOpen(false);
  };

  const openCreateDisciplineEventModal = () => {
    if (!canInteract || disciplinePenaltyPoints >= maxDisciplinePenaltyPoints) return;

    setSaveError(null);
    setIsDisciplineModalOpen(true);
  };

  const handleSave = () => {
    setSaveError(null);

    startTransition(async () => {
      const result = await saveStudentAttendanceRecord(
        classId,
        date,
        student.id,
        selectedIds,
        rules.map((rule) => ({ id: rule.id, points: rule.points })),
        extraActivityPoints,
        disciplineEvents,
      );

      if ("error" in result && result.error) {
        setSaveError(result.error);
        return;
      }

      if ("disciplineEvents" in result && Array.isArray(result.disciplineEvents)) {
        setDisciplineEvents(result.disciplineEvents.map(normalizeDisciplineEvent));
      }

      setIsEditing(false);
    });
  };

  const totalPoints = rules
    .filter((rule) => selectedIds.includes(rule.id))
    .reduce((sum, rule) => sum + rule.points, 0);
  const disciplinePenaltyPoints = disciplineEvents.reduce(
    (sum, event) => sum + Math.max(1, Number(event.points || 1)),
    0,
  );
  const maxDisciplinePenaltyPoints = totalPoints + extraActivityPoints;
  const totalPointsWithAdjustments = totalPoints + extraActivityPoints - disciplinePenaltyPoints;

  const nameObj = getFormattedName(student.full_name);
  const canInteract = !isSaved || isEditing;
  const photoSrc = getStudentPhotoSrc(student.id, student.photo_url);

  return (
    <>
      <div
        className={`
          bg-surface border-4 border-foreground shadow-editorial p-4 md:p-4 flex flex-col gap-[18px] transition-all xl:grid xl:grid-cols-[124px_minmax(0,1fr)_152px] xl:items-start
          ${isSaved && !isEditing ? "opacity-60 grayscale bg-background/50 border-foreground/10" : "border-foreground"}
        `}
      >
        <div className="flex flex-col shrink-0 items-center lg:items-start group/card xl:self-start">
          <button
            type="button"
            onClick={() => setIsStudentModalOpen(true)}
            className="text-left focus:outline-none"
            aria-label={`Abrir cadastro de ${student.full_name}`}
          >
            <div className="bg-surface border-4 border-foreground shadow-editorial-sm p-1.5 pb-3.5 flex flex-col gap-2 transition-all group-hover/card:shadow-editorial group-active/card:translate-y-0.5">
              <div className="relative flex h-[92px] w-[92px] items-center justify-center overflow-hidden border-4 border-foreground bg-background md:h-[100px] md:w-[100px]">
                {photoSrc ? (
                  <Image
                    src={photoSrc}
                    alt={student.full_name}
                    fill
                    unoptimized
                    sizes="120px"
                    className={`object-cover transition-all ${isSaved && !isEditing ? "grayscale" : ""}`}
                  />
                ) : (
                  <UserCircle className="w-14 h-14 opacity-10" />
                )}
                {isSaved && !isEditing ? (
                  <div className="absolute inset-0 bg-es-green/10 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-es-green opacity-50" />
                  </div>
                ) : null}
              </div>
              <div className="flex min-h-[2.8rem] flex-col items-center justify-center px-1 py-1 leading-tight">
                <span className="w-full text-center text-[13px] font-black uppercase tracking-tighter text-foreground break-words">
                  {nameObj.first}
                </span>
                {nameObj.remaining ? (
                  <span className="mt-1 w-full text-center text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/50 break-words whitespace-normal">
                    {nameObj.remaining}
                  </span>
                ) : null}
              </div>
            </div>
          </button>
        </div>

        <div className="flex min-w-0 flex-col gap-3 xl:self-stretch xl:justify-between">
          <div className={`flex flex-row flex-wrap gap-2.5 items-center content-center ${!canInteract ? "pointer-events-none" : ""}`}>
            {rules.map((rule) => {
              const isSelected = selectedIds.includes(rule.id);
              const style = CATEGORY_STYLES[rule.category as keyof typeof CATEGORY_STYLES];
              const shortName = getShortName(rule.name);

              return (
                <button
                  key={rule.id}
                  onClick={() => handleToggle(rule.id)}
                  disabled={isPending || !canInteract}
                  className={`
                    relative min-h-10 min-w-[82px] px-2.5 py-2 flex flex-1 basis-[calc(50%-0.5rem)] flex-col items-start justify-center border-4 border-foreground transition-all select-none sm:flex-none
                    ${isSelected ? `${style.color} shadow-editorial-sm translate-y-0.5` : "bg-surface hover:bg-background shadow-none"}
                    ${canInteract ? "cursor-pointer" : "cursor-default opacity-50"}
                  `}
                >
                  <div className="flex flex-col items-start w-full text-left">
                    <span className="text-[10px] font-black uppercase tracking-tight leading-none truncate w-full">
                      {shortName}
                    </span>
                    <span className={`text-[8px] font-bold uppercase tracking-widest leading-none mt-1.5 ${isSelected ? "text-foreground" : "opacity-30"}`}>
                      {rule.points} {rule.points === 1 ? "PT" : "PTS"}
                    </span>
                  </div>

                  {isSelected ? (
                    <div className="absolute top-1 right-1">
                      <Check className="w-3 h-3 text-foreground stroke-[4px]" />
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px]">
            <AttendanceAdjustmentPanel
              title="Atividade Extra"
              subtitle="Pontos fora da lista"
              value={`+${extraActivityPoints}`}
              tone="green"
              actionLabel="Adicionar +1"
              onDecrease={() => setExtraActivityPoints((current) => Math.max(0, current - 1))}
              onPrimary={() => setExtraActivityPoints((current) => current + 1)}
              onIncrease={() => setExtraActivityPoints((current) => current + 1)}
              decreaseDisabled={!canInteract || extraActivityPoints === 0}
              primaryDisabled={!canInteract}
              increaseDisabled={!canInteract}
            />

            <AttendanceAdjustmentPanel
              title="Indisciplina"
              subtitle="Descontos por ocorrência"
              value={`-${disciplinePenaltyPoints}`}
              tone="orange"
              actionLabel="Descontar -1"
              onDecrease={() => {
                setDisciplineEvents((current) => {
                  if (current.length === 0) return current;

                  const nextEvents = [...current];
                  const lastEventIndex = nextEvents.length - 1;
                  const lastEvent = nextEvents[lastEventIndex];
                  const nextPoints = Math.max(0, Math.trunc((lastEvent.points || 1) - 1));

                  if (nextPoints === 0) {
                    nextEvents.pop();
                  } else {
                    nextEvents[lastEventIndex] = {
                      ...lastEvent,
                      points: nextPoints,
                    };
                  }

                  return nextEvents;
                });
              }}
              onPrimary={openCreateDisciplineEventModal}
              onIncrease={openCreateDisciplineEventModal}
              decreaseDisabled={!canInteract || disciplinePenaltyPoints === 0}
              primaryDisabled={!canInteract || disciplinePenaltyPoints >= maxDisciplinePenaltyPoints}
              increaseDisabled={!canInteract || disciplinePenaltyPoints >= maxDisciplinePenaltyPoints}
            />

            <AttendanceDisciplineEventsCard
              events={disciplineEvents}
              canDelete={canInteract}
              onDeleteEvent={(eventIndex) => {
                setDisciplineEvents((current) =>
                  current.filter((_, index) => index !== eventIndex),
                );
              }}
            />
          </div>
        </div>

        <div className="flex flex-row items-center justify-between gap-4 border-t-4 border-foreground/5 pt-4 xl:flex-col xl:items-end xl:justify-start xl:self-start xl:border-l-4 xl:border-t-0 xl:pl-5 xl:pt-0">
          <div className="flex flex-col items-center relative order-1 lg:order-none">
            {isSaved && !isEditing ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-es-green text-surface text-[8px] font-black px-2 py-0.5 shadow-editorial-sm whitespace-nowrap z-10 border-2 border-foreground uppercase tracking-widest">
                Salvo
              </span>
            ) : null}
            <div
              className={`
                h-[3.25rem] w-[3.25rem] border-4 border-foreground rounded-none flex flex-col items-center justify-center shrink-0 transition-all font-black
                ${isSaved && !isEditing ? "bg-es-green shadow-none grayscale-0" : "bg-es-yellow shadow-editorial-sm"}
              `}
            >
              <span className="text-base leading-none">{totalPointsWithAdjustments}</span>
              <span className="text-[8px] uppercase tracking-widest mt-1 opacity-50">Pts</span>
            </div>
          </div>

          <div className="order-2 flex min-w-[148px] flex-col gap-2 xl:w-full">
            {isSaved && !isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-surface hover:bg-background border-4 border-foreground py-2.5 px-4 shadow-editorial-sm hover:translate-y-0.5 active:translate-y-1 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[9px]"
              >
                <Settings className="w-3.5 h-3.5" />
                Editar
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isPending}
                className="border-4 border-foreground py-2.5 px-4 shadow-editorial-sm hover:translate-y-0.5 active:translate-y-1 transition-all flex items-center justify-center gap-2.5 font-black uppercase tracking-widest text-[9px] disabled:opacity-50 disabled:cursor-wait bg-es-blue"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaved ? "Atualizar" : "Salvar"}
              </button>
            )}

            {isEditing ? (
              <button
                onClick={() => setIsEditing(false)}
                className="text-[9px] font-black uppercase tracking-widest text-center py-1 opacity-40 hover:opacity-100 transition-opacity"
              >
                Cancelar
              </button>
            ) : null}

            {saveError ? (
              <p className="text-[9px] font-bold text-danger uppercase max-w-[150px] leading-tight text-center">
                {saveError}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {isStudentModalOpen ? (
        <AttendanceStudentEditModal
          student={student}
          onClose={() => setIsStudentModalOpen(false)}
        />
      ) : null}

      {isDisciplineModalOpen ? (
        <AttendanceDisciplinePenaltyModal
          mode="create"
          studentName={student.full_name}
          currentPenaltyPoints={disciplinePenaltyPoints}
          eventPoints={1}
          initialReason=""
          initialAppliedByName=""
          onClose={closeDisciplineModal}
          onConfirm={(reason) => {
            setDisciplineEvents((current) => {
              return [
                ...current,
                {
                  points: 1,
                  reason,
                  appliedBy: null,
                  appliedByName: null,
                  createdAt: null,
                  updatedAt: null,
                },
              ];
            });

            closeDisciplineModal();
          }}
        />
      ) : null}
    </>
  );
}
