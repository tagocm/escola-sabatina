"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  fieldLabelClass,
  primaryActionCenteredClass,
  secondaryActionClass,
} from "@/components/ui/design-system";

interface AttendanceDisciplinePenaltyModalProps {
  mode: "create" | "edit";
  studentName: string;
  currentPenaltyPoints: number;
  eventPoints?: number;
  initialReason?: string;
  initialAppliedByName?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export default function AttendanceDisciplinePenaltyModal({
  mode,
  studentName,
  currentPenaltyPoints,
  eventPoints = 1,
  initialReason = "",
  initialAppliedByName = "",
  onClose,
  onConfirm,
}: AttendanceDisciplinePenaltyModalProps) {
  const [reason, setReason] = useState(initialReason);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = () => {
    onConfirm(reason.trim());
  };

  const isEditing = mode === "edit";

  const modal = (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-foreground/35 p-3 backdrop-blur-[2px] md:items-center md:p-4">
      <button
        type="button"
        aria-label="Fechar janela de indisciplina"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${isEditing ? "Editar" : "Registrar"} evento de indisciplina para ${studentName}`}
        className="relative z-10 flex max-h-[90svh] w-full max-w-xl flex-col overflow-hidden border-4 border-foreground bg-surface-warm shadow-editorial"
      >
        <div className="flex items-start justify-between gap-4 border-b-4 border-foreground px-4 py-4 md:px-5 md:py-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
              Evento de desconto
            </span>
            <h3 className="text-lg font-black uppercase tracking-tight md:text-xl">
              {isEditing ? "Editar Evento" : "Novo Evento"}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm"
            aria-label="Fechar"
          >
            <X className="h-4 w-4 stroke-[3]" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border-2 border-foreground bg-surface px-4 py-3 sm:col-span-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Aluno</p>
              <p className="mt-1 text-sm font-black uppercase tracking-tight">{studentName}</p>
            </div>
            <div className="border-2 border-foreground bg-surface px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">Desconto</p>
              <p className="mt-1 text-sm font-black uppercase tracking-tight">-{eventPoints} ponto(s)</p>
            </div>
          </div>

          <div className="border-2 border-foreground bg-background px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
              Total perdido no lançamento
            </p>
            <p className="mt-1 text-sm font-black uppercase tracking-tight">
              -{isEditing ? currentPenaltyPoints : currentPenaltyPoints + eventPoints} ponto(s)
            </p>
          </div>

          <label className="flex flex-col gap-2">
            <span className={fieldLabelClass}>Motivo do desconto (opcional)</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Opcional: descreva o ocorrido"
              rows={5}
              className="min-h-[132px] w-full resize-none border-4 border-foreground bg-surface px-3 py-3 text-sm font-bold leading-relaxed outline-none transition-colors focus:bg-es-orange/10"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border-2 border-foreground bg-background px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                {isEditing ? "Motivo atual" : "Status do registro"}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase leading-relaxed tracking-[0.08em]">
                {isEditing ? initialReason || "Sem motivo informado" : "Será salvo junto com a frequência"}
              </p>
            </div>
            <div className="border-2 border-foreground bg-background px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                Professor responsável
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase leading-relaxed tracking-[0.08em]">
                {initialAppliedByName || "Será registrado ao salvar"}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t-4 border-foreground/10 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className={secondaryActionClass}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className={primaryActionCenteredClass}
            >
              {isEditing ? "Salvar evento" : "Registrar evento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modal, document.body);
}
