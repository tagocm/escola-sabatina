"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AlertTriangle, Check, Minus, Plus, Save, UserCircle, X } from "lucide-react";
import { saveStudentAttendanceRecord } from "@/app/actions/attendance";
import AttendanceDisciplinePenaltyModal from "@/components/ui/AttendanceDisciplinePenaltyModal";
import { ButtonLoader } from "@/components/ui/AppLoader";
import { bottomSheetClass, fieldLabelClass, iconButtonClass } from "@/components/ui/design-system";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import { formatAttendanceStudentName } from "@/lib/attendance/student-display";
import type {
  AttendanceDisciplineEvent,
  AttendanceRule,
  AttendanceStudentListItem,
} from "@/lib/types/attendance";

interface AttendanceScoringSheetProps {
  classId: string;
  date: string;
  item: AttendanceStudentListItem;
  rules: AttendanceRule[];
  isSaved: boolean;
  onClose: () => void;
  onSaved: (item: AttendanceStudentListItem) => void;
}

const CATEGORY_STYLES = {
  frequencia: "bg-es-blue",
  participacao: "bg-es-orange",
  espiritual: "bg-es-lilac",
  atividade: "bg-es-yellow",
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

function getRuleShortName(name: string) {
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
}

export default function AttendanceScoringSheet({
  classId,
  date,
  item,
  rules,
  isSaved,
  onClose,
  onSaved,
}: AttendanceScoringSheetProps) {
  const [selectedIds, setSelectedIds] = useState(item.initialSelectedRuleIds);
  const [extraActivityPoints, setExtraActivityPoints] = useState(item.initialExtraActivityPoints);
  const [disciplineEvents, setDisciplineEvents] = useState<AttendanceDisciplineEvent[]>(() =>
    item.initialDisciplineEvents.map(normalizeDisciplineEvent),
  );
  const [changeReason, setChangeReason] = useState(() =>
    isSaved ? "" : "Lançamento regular da pontuação semanal.",
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDisciplineModalOpen, setIsDisciplineModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const displayName = formatAttendanceStudentName(item.student.full_name);
  const photoSrc = getStudentPhotoSrc(item.student.id, item.student.photo_url);
  const totalRulePoints = useMemo(
    () => rules
      .filter((rule) => selectedIds.includes(rule.id))
      .reduce((sum, rule) => sum + rule.points, 0),
    [rules, selectedIds],
  );
  const disciplinePenaltyPoints = disciplineEvents.reduce(
    (sum, event) => sum + Math.max(1, Number(event.points || 1)),
    0,
  );
  const totalPoints = totalRulePoints + extraActivityPoints - disciplinePenaltyPoints;
  const maxDisciplinePenaltyPoints = totalRulePoints + extraActivityPoints;
  const canAddDisciplinePenalty = disciplinePenaltyPoints < maxDisciplinePenaltyPoints;
  const hasInvalidDisciplinePenalty = disciplinePenaltyPoints > maxDisciplinePenaltyPoints;

  const handleToggleRule = (ruleId: string) => {
    setSaveError(null);
    setSelectedIds((current) =>
      current.includes(ruleId)
        ? current.filter((id) => id !== ruleId)
        : [...current, ruleId],
    );
  };

  const handleSave = () => {
    setSaveError(null);

    if (hasInvalidDisciplinePenalty) {
      setSaveError("O desconto por indisciplina excede os pontos disponíveis.");
      return;
    }

    const normalizedChangeReason = changeReason.trim();

    if (!normalizedChangeReason) {
      setSaveError("Informe o motivo do lançamento ou correção da pontuação.");
      return;
    }

    startTransition(async () => {
      const result = await saveStudentAttendanceRecord(
        classId,
        date,
        item.student.id,
        selectedIds,
        extraActivityPoints,
        disciplineEvents,
        normalizedChangeReason,
      );

      if ("error" in result && result.error) {
        setSaveError(result.error);
        return;
      }

      const savedDisciplineEvents = "disciplineEvents" in result && Array.isArray(result.disciplineEvents)
        ? result.disciplineEvents.map(normalizeDisciplineEvent)
        : disciplineEvents.map(normalizeDisciplineEvent);

      onSaved({
        ...item,
        initialSelectedRuleIds: selectedIds,
        initialExtraActivityPoints: extraActivityPoints,
        initialDisciplineEvents: savedDisciplineEvents,
      });
      onClose();
    });
  };

  const sheet = (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-foreground/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Fechar lançamento"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Lançar pontos de ${item.student.full_name}`}
        className={bottomSheetClass}
      >
        <div className="mx-auto mt-3 h-1.5 w-16 shrink-0 bg-foreground/20 sm:hidden" />

        <div className="grid grid-cols-[74px_minmax(0,1fr)_44px] items-center gap-3 border-b-4 border-foreground bg-surface px-4 py-4">
          <div className="relative h-16 w-16 rotate-[-2deg] border-4 border-foreground bg-background p-1 shadow-editorial-sm">
            <div className="relative h-full w-full overflow-hidden border-2 border-foreground bg-background">
              {photoSrc ? (
                <Image
                  src={photoSrc}
                  alt={item.student.full_name}
                  fill
                  unoptimized
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <UserCircle className="h-9 w-9 text-foreground/15" />
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35">
              {isSaved ? "Registro finalizado" : "Lançamento pendente"}
            </span>
            <h3 className="mt-1 truncate text-2xl font-black uppercase leading-none tracking-tighter">
              {displayName.compactName}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={iconButtonClass}
            aria-label="Fechar"
          >
            <X className="h-5 w-5 stroke-[3]" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-4 py-5">
          {saveError ? (
            <div className="flex items-center gap-3 border-4 border-foreground bg-es-orange px-4 py-3 shadow-editorial-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 stroke-[3]" />
              <p className="text-[10px] font-black uppercase tracking-[0.15em]">{saveError}</p>
            </div>
          ) : null}

          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h4 className="text-xl font-black uppercase leading-none tracking-tighter">Pontos do sábado</h4>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-foreground/35">
                  Toque para marcar ou remover
                </p>
              </div>
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center border-4 border-foreground bg-es-yellow shadow-editorial-sm">
                <span className="text-xl font-black leading-none">{totalPoints}</span>
                <span className="text-[8px] font-black uppercase tracking-widest opacity-50">Pts</span>
              </div>
            </div>

            {rules.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {rules.map((rule) => {
                  const isSelected = selectedIds.includes(rule.id);
                  const colorClass = CATEGORY_STYLES[rule.category];

                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => handleToggleRule(rule.id)}
                      className={`relative flex min-h-[64px] flex-col justify-center border-4 border-foreground px-3 py-3 text-left shadow-editorial-sm transition-all active:translate-y-0.5 ${
                        isSelected ? `${colorClass} translate-y-0.5` : "bg-surface hover:bg-background"
                      }`}
                    >
                      <span className="line-clamp-2 text-[12px] font-black uppercase leading-none tracking-tight">
                        {getRuleShortName(rule.name)}
                      </span>
                      <span className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-foreground/45">
                        {rule.points} {rule.points === 1 ? "ponto" : "pontos"}
                      </span>
                      {isSelected ? (
                        <Check className="absolute right-2 top-2 h-4 w-4 stroke-[4]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border-4 border-dashed border-foreground/30 bg-surface px-5 py-8 text-center">
                <p className="text-sm font-black uppercase tracking-tight opacity-40">
                  Cadastre os critérios de avaliação antes de lançar pontos
                </p>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border-4 border-foreground bg-surface p-4 shadow-editorial-sm">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-es-green">
                Atividade extra
              </span>
              <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExtraActivityPoints((current) => Math.max(0, current - 1))}
                  disabled={extraActivityPoints === 0}
                  className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm disabled:opacity-30"
                  aria-label="Remover ponto extra"
                >
                  <Minus className="h-4 w-4 stroke-[4]" />
                </button>
                <div className="flex h-11 items-center justify-center border-4 border-foreground bg-background text-lg font-black shadow-editorial-sm">
                  +{extraActivityPoints}
                </div>
                <button
                  type="button"
                  onClick={() => setExtraActivityPoints((current) => current + 1)}
                  className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-green shadow-editorial-sm"
                  aria-label="Adicionar ponto extra"
                >
                  <Plus className="h-4 w-4 stroke-[4]" />
                </button>
              </div>
            </div>

            <div className="border-4 border-foreground bg-surface p-4 shadow-editorial-sm">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-es-orange">
                Indisciplina
              </span>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2">
                <div className={`flex h-11 items-center justify-center border-4 border-foreground bg-background text-lg font-black shadow-editorial-sm ${hasInvalidDisciplinePenalty ? "text-es-orange" : ""}`}>
                  -{disciplinePenaltyPoints}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSaveError(null);
                    setIsDisciplineModalOpen(true);
                  }}
                  disabled={!canAddDisciplinePenalty}
                  className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-orange shadow-editorial-sm disabled:opacity-30"
                  aria-label="Adicionar desconto por indisciplina"
                >
                  <Plus className="h-4 w-4 stroke-[4]" />
                </button>
              </div>
              {hasInvalidDisciplinePenalty ? (
                <p className="mt-3 text-[9px] font-black uppercase leading-relaxed tracking-[0.12em] text-es-orange">
                  Remova um evento ou marque mais pontos antes de salvar.
                </p>
              ) : null}
            </div>
          </section>

          <section className="border-4 border-foreground bg-surface p-4 shadow-editorial-sm">
            <label className="flex flex-col gap-2">
              <span className={fieldLabelClass}>Motivo do lançamento</span>
              <textarea
                value={changeReason}
                onChange={(event) => {
                  setChangeReason(event.target.value);
                  if (saveError) {
                    setSaveError(null);
                  }
                }}
                rows={3}
                placeholder={isSaved ? "Descreva a correção" : "Lançamento regular da pontuação semanal"}
                className="min-h-[92px] w-full resize-none border-4 border-foreground bg-background px-3 py-3 text-sm font-bold leading-relaxed outline-none transition-colors focus:bg-es-lilac/10"
              />
            </label>
          </section>

          {disciplineEvents.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h4 className="text-sm font-black uppercase tracking-tight">Eventos de desconto</h4>
              <div className="flex flex-col gap-2">
                {disciplineEvents.map((event, index) => (
                  <div
                    key={event.id || `draft-event-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_40px] gap-3 border-4 border-foreground bg-surface px-3 py-3 shadow-editorial-sm"
                  >
                    <div className="min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-es-orange">
                        -{Math.max(1, Number(event.points || 1))} ponto
                      </span>
                      <p className="mt-1 line-clamp-2 text-[10px] font-bold uppercase leading-relaxed tracking-[0.08em]">
                        {event.reason}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDisciplineEvents((current) => current.filter((_, eventIndex) => eventIndex !== index))}
                      className="flex h-10 w-10 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm hover:bg-es-orange/10"
                      aria-label="Remover evento de indisciplina"
                    >
                      <X className="h-4 w-4 stroke-[3]" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t-4 border-foreground bg-surface px-4 py-4">
          <div className="min-w-0">
            <span className="text-[8px] font-black uppercase tracking-[0.18em] opacity-35">Total final</span>
            <p className="text-2xl font-black leading-none tracking-tighter">{totalPoints} pontos</p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || rules.length === 0}
            className="flex min-h-12 items-center justify-center gap-2 border-4 border-foreground bg-es-blue px-5 text-[11px] font-black uppercase tracking-[0.14em] shadow-editorial transition-all active:translate-y-0.5 disabled:opacity-60"
          >
            {isPending ? <ButtonLoader size="sm" label="Salvando pontuação" /> : <Save className="h-4 w-4 stroke-[3]" />}
            {isSaved ? "Atualizar" : "Salvar"}
          </button>
        </div>
      </div>

      {isDisciplineModalOpen ? (
        <AttendanceDisciplinePenaltyModal
          mode="create"
          studentName={item.student.full_name}
          currentPenaltyPoints={disciplinePenaltyPoints}
          eventPoints={1}
          initialReason=""
          initialAppliedByName=""
          onClose={() => setIsDisciplineModalOpen(false)}
          onConfirm={(reason) => {
            setDisciplineEvents((current) => [
              ...current,
              {
                points: 1,
                reason,
                appliedBy: null,
                appliedByName: null,
                createdAt: null,
                updatedAt: null,
              },
            ]);
            setIsDisciplineModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(sheet, document.body);
}
